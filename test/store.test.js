// The Store and story service must run without Node APIs (the Android app
// uses them with a Capacitor filesystem adapter), so exercise them against an
// in-memory adapter that follows the same contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.js';
import { createStory, importStory, recordPlaythrough, saveStory, seedIfEmpty } from '../server/service.js';

function memoryFs() {
  const files = new Map();
  const enoent = (p) => Object.assign(new Error(`not found: ${p}`), { code: 'ENOENT' });
  return {
    files,
    join: (...parts) => parts.join('/'),
    mkdir: async () => {},
    readdir: async (dir) => [...files.keys()].filter((f) => f.startsWith(`${dir}/`)).map((f) => f.slice(dir.length + 1)),
    readFile: async (f) => { if (!files.has(f)) throw enoent(f); return files.get(f); },
    writeFile: async (f, d) => { files.set(f, d); },
    rename: async (a, b) => { if (!files.has(a)) throw enoent(a); files.set(b, files.get(a)); files.delete(a); },
    rm: async (f) => { if (!files.delete(f)) throw enoent(f); },
  };
}

test('store needs an adapter', () => {
  assert.throws(() => new Store('stories'), /adapter/);
});

test('seed, create, save with conflict detection, playthrough, remove', async () => {
  const fs = memoryFs();
  const store = new Store('stories', fs);
  await store.init();

  await seedIfEmpty(store);
  await seedIfEmpty(store); // idempotent
  assert.deepEqual((await store.list()).map((s) => s.id), ['sample-lighthouse']);

  const story = await createStory(store, { title: 'Pocket Story' });
  assert.ok(fs.files.has(`stories/${story.id}.json`), 'written via the adapter');
  assert.ok(![...fs.files.keys()].some((f) => f.endsWith('.tmp')), 'temp file renamed away');

  const ok = await saveStory(store, story.id, { ...story, title: 'Renamed', baseUpdatedAt: story.updatedAt });
  assert.equal(ok.story.title, 'Renamed');
  const stale = await saveStory(store, story.id, { ...story, title: 'Stale', baseUpdatedAt: story.updatedAt });
  assert.equal(stale.conflict.title, 'Renamed');
  assert.equal(await saveStory(store, 'missing', story), null);

  const stats = await recordPlaythrough(store, story.id, [story.startSceneId]);
  assert.equal(stats.playthroughs, 1);
  await assert.rejects(recordPlaythrough(store, story.id, 'nope'), { status: 400 });

  const imported = await importStory(store, { ...story, title: 'Copy' });
  assert.notEqual(imported.id, story.id);

  assert.equal(await store.remove(story.id), true);
  assert.equal(await store.remove(story.id), false);
  assert.equal(await store.get(story.id), null);
  assert.equal((await store.list()).length, 2);
});

test('unreadable files are skipped', async () => {
  const fs = memoryFs();
  const store = new Store('stories', fs);
  fs.files.set('stories/broken.json', '{not json');
  assert.deepEqual(await store.list(), []);
});
