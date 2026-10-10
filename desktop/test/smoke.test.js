// End-to-end smoke test of the desktop shell.
//   npm test                                   -> runs `electron .` from desktop/
//   APPIMAGE_PATH=dist/….AppImage npm test     -> runs the packaged AppImage
// Each launch gets throwaway DATA_DIR and XDG_CONFIG_HOME folders.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';

const desktop = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP_URL = 'app://story-mapper/';

let root; let dataDir; let configDir; let downloadDir;

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'story-mapper-desktop-test-'));
  dataDir = path.join(root, 'stories');
  configDir = path.join(root, 'config');
  downloadDir = path.join(root, 'downloads');
  await mkdir(downloadDir);
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

async function launch() {
  const env = { ...process.env, DATA_DIR: dataDir, XDG_CONFIG_HOME: configDir };
  const app = process.env.APPIMAGE_PATH
    ? await electron.launch({ executablePath: path.resolve(process.env.APPIMAGE_PATH), env })
    : await electron.launch({ args: [desktop], cwd: desktop, env });
  try {
    const win = await app.firstWindow();
    await win.waitForSelector('#story-select option', { state: 'attached' });
    return { app, win };
  } catch (err) {
    await app.close(); // a leftover instance would hold the single-instance lock
    throw err;
  }
}

const storyFiles = async () => {
  const out = [];
  for (const name of await readdir(dataDir)) {
    if (name.endsWith('.json')) out.push(JSON.parse(await readFile(path.join(dataDir, name), 'utf8')));
  }
  return out;
};

// prompt() blocks the page until the dialog answers, so don't await the click first.
async function answerPrompt(app, win, selector, answer) {
  const dialogOpened = app.waitForEvent('window');
  const clicking = win.click(selector);
  const dialog = await dialogOpened;
  await dialog.waitForSelector('#value');
  assert.equal(await dialog.inputValue('#value'), 'Untitled story', 'default value shown');
  const closed = dialog.waitForEvent('close');
  // The dialog closes as soon as it answers, which can race Playwright's own action.
  if (answer === null) {
    await dialog.press('#value', 'Escape').catch(() => {});
  } else {
    await dialog.fill('#value', answer);
    await dialog.click('button[type=submit]').catch(() => {});
  }
  await closed;
  await clicking;
}

test('loads the app origin with the demo story and the map', async () => {
  const { app, win } = await launch();
  try {
    assert.equal(win.url(), APP_URL);
    const options = await win.$$eval('#story-select option', (els) => els.map((e) => e.textContent));
    assert.ok(options.some((t) => t.includes('Lighthouse')), `demo story listed: ${options}`);
    await win.waitForSelector('#cy canvas');
    // ES modules, CSP and the vendored cytoscape all loaded through the proxy.
    assert.equal(await win.evaluate(() => typeof window.storyMapper), 'object');
  } finally {
    await app.close();
  }
});

test('prompt() opens a dialog; OK creates a story, Escape cancels', async () => {
  const { app, win } = await launch();
  try {
    const before = (await storyFiles()).length;
    await answerPrompt(app, win, '#btn-new', null);
    assert.equal((await storyFiles()).length, before, 'cancel creates nothing');

    await answerPrompt(app, win, '#btn-new', 'Desktop Story');
    await win.waitForFunction(() => window.storyMapper.story?.title === 'Desktop Story');
    const created = (await storyFiles()).find((s) => s.title === 'Desktop Story');
    assert.ok(created, 'story file written to DATA_DIR');
  } finally {
    await app.close();
  }
});

test('edits are flushed on close and the last story reopens after restart', async () => {
  let { app, win } = await launch();
  const id = await win.evaluate(() => window.storyMapper.story.id);
  // Close straight after an edit: the shell must flush before the server stops.
  await win.evaluate(() => {
    localStorage.setItem('desktop-test', 'kept');
    window.storyMapper.mutate((st) => { st.description = 'flushed on close'; }, { storyMeta: true });
  });
  await app.close();

  const saved = (await storyFiles()).find((s) => s.id === id);
  assert.equal(saved.description, 'flushed on close');

  ({ app, win } = await launch());
  try {
    // The app:// origin is fixed, so localStorage (and the app's lastStory) survives restarts.
    assert.equal(await win.evaluate(() => localStorage.getItem('desktop-test')), 'kept');
    assert.equal(await win.evaluate(() => localStorage.getItem('lastStory')), id);
    await win.waitForFunction((want) => window.storyMapper.story?.id === want, id);
  } finally {
    await app.close();
  }
});

test('blocks new windows and off-origin navigation; API errors are JSON', async () => {
  const { app, win } = await launch();
  try {
    assert.equal(await win.evaluate(() => window.open('https://example.com') === null), true);
    assert.equal(app.windows().length, 1);

    await win.evaluate(() => { location.href = 'https://example.com/'; });
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(win.url(), APP_URL);

    const [status, body] = await win.evaluate(async () => {
      const res = await fetch('/api/nope');
      return [res.status, await res.json()];
    });
    assert.equal(status, 404);
    assert.deepEqual(body, { error: 'Not found' });
  } finally {
    await app.close();
  }
});

test('Export JSON downloads a file', async () => {
  const { app, win } = await launch();
  try {
    // Setting the save path in will-download skips the native save dialog.
    const done = app.evaluate(({ session }, dir) => new Promise((resolve) => {
      session.defaultSession.once('will-download', (_e, item) => {
        item.setSavePath(`${dir}/${item.getFilename()}`);
        item.once('done', (_ev, state) => resolve(state));
      });
    }), downloadDir);
    await win.click('#btn-export');
    assert.equal(await done, 'completed');
    const [file] = await readdir(downloadDir);
    const doc = JSON.parse(await readFile(path.join(downloadDir, file), 'utf8'));
    assert.equal(doc.format, 'story-mapper/1');
  } finally {
    await app.close();
  }
});
