// Story Mapper desktop shell.
//
// The web app's Express server (server/, copied in by scripts/stage.mjs) runs
// in-process on a private Unix socket (a named pipe on Windows) — no TCP port
// is opened. The window loads
// app://story-mapper/, and every request on that scheme is proxied to the
// socket, so the page keeps a stable origin (localStorage survives restarts)
// and the server code runs unchanged.
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, protocol } from 'electron';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createApp } from './server/app.js';
import { Store } from './server/store.js';
import { nodeFs } from './server/node-fs.js';
import { seedIfEmpty } from './server/service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEME = 'app';
const HOST = 'story-mapper';
const START_URL = `${SCHEME}://${HOST}/`;
const FORWARDED_HEADERS = ['content-type', 'accept'];
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding']);
const FLUSH_TIMEOUT = 5000;

let mainWindow = null;
let server = null;
let socketDir = null;
let socketPath = null;

// Must happen before 'ready'. standard+secure gives the scheme a real origin
// (localStorage, CSP 'self', ES modules); supportFetchAPI lets fetch() use it.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const isAppUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === `${SCHEME}:` && u.host === HOST;
  } catch {
    return false;
  }
};

async function startServer() {
  const dataDir = process.env.DATA_DIR || path.join(app.getPath('userData'), 'stories');
  const store = new Store(dataDir, nodeFs);
  await store.init();
  await seedIfEmpty(store);

  if (process.platform === 'win32') {
    // Windows has no socket files; Node uses a named pipe instead. The random
    // name keeps it unguessable, and by default only this user may write to it.
    // Windows removes the pipe when the process exits.
    socketPath = `\\\\?\\pipe\\story-mapper-${randomBytes(16).toString('hex')}`;
  } else {
    // mkdtemp creates the directory with mode 0700, so only this user can reach the socket.
    const runtime = process.env.XDG_RUNTIME_DIR;
    try {
      if (!runtime || !path.isAbsolute(runtime)) throw new Error('no runtime dir');
      socketDir = await mkdtemp(path.join(runtime, 'story-mapper-'));
    } catch {
      socketDir = await mkdtemp(path.join(os.tmpdir(), 'story-mapper-'));
    }
    socketPath = path.join(socketDir, 'api.sock');
  }

  server = http.createServer(createApp(store));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, resolve);
  });
  console.log(`Stories are saved in ${dataDir}`);
}

async function stopServer() {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = null;
  if (socketDir) await rm(socketDir, { recursive: true, force: true }).catch(() => {});
  socketDir = null;
}

// Forward an app:// request to the Express app over the Unix socket.
async function proxy(request) {
  const url = new URL(request.url);
  if (url.host !== HOST) return new Response('Not found', { status: 404 });

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : null;
  // Host must be a local name for the server's DNS-rebinding check; no Origin is sent.
  const headers = { host: 'localhost' };
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  if (body) headers['content-length'] = String(body.length);

  return new Promise((resolve) => {
    const req = http.request(
      { socketPath, method: request.method, path: url.pathname + url.search, headers },
      (res) => {
        const out = new Headers();
        for (const [name, value] of Object.entries(res.headers)) {
          if (value === undefined || HOP_BY_HOP.has(name)) continue;
          for (const v of [].concat(value)) out.append(name, v);
        }
        const empty = request.method === 'HEAD' || res.statusCode === 204 || res.statusCode === 304;
        if (empty) res.resume();
        resolve(new Response(empty ? null : Readable.toWeb(res), {
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: out,
        }));
      },
    );
    req.on('error', (err) => {
      console.error(`proxy error: ${err.message}`);
      resolve(new Response(JSON.stringify({ error: 'Story Mapper server unavailable' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }));
    });
    req.end(body ?? undefined);
  });
}

// Electron's window.prompt() throws; preload.cjs routes it here instead.
function openPrompt(parent, message, value) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      parent,
      modal: true,
      width: 440,
      height: 180,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      title: app.getName(),
      backgroundColor: parent?.getBackgroundColor(),
      webPreferences: {
        preload: path.join(here, 'prompt', 'preload.cjs'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    win.setMenu(null);
    let answer = null;
    const onAnswer = (event, v) => {
      if (event.sender !== win.webContents) return;
      answer = typeof v === 'string' ? v : null;
      win.close();
    };
    ipcMain.on('story-mapper:prompt-answer', onAnswer);
    win.once('closed', () => {
      ipcMain.removeListener('story-mapper:prompt-answer', onAnswer);
      resolve(answer);
    });
    win.once('ready-to-show', () => win.show());
    win.loadFile(path.join(here, 'prompt', 'prompt.html'), { query: { message, value } });
  });
}

ipcMain.on('story-mapper:prompt', async (event, message, value) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    event.returnValue = null;
    return;
  }
  const answer = await openPrompt(mainWindow, String(message ?? ''), String(value ?? ''));
  try { event.returnValue = answer; } catch { /* window went away */ }
});

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    // macOS puts About / Hide / Quit in a menu named after the app.
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [isMac ? { role: 'close' } : { role: 'quit' }] },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Story Mapper',
    icon: path.join(here, 'assets', 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#15171b' : '#f6f5f1', // --bg in app.css
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Quitting stops the in-process server, so wait for pending edits to reach
  // disk before the window goes (the page's own pagehide save is best-effort).
  let flushed = false;
  mainWindow.on('close', (event) => {
    if (flushed) return;
    event.preventDefault();
    const win = mainWindow;
    const timeout = new Promise((resolve) => setTimeout(resolve, FLUSH_TIMEOUT));
    const flush = win.webContents.executeJavaScript('window.storyMapper?.flush()', true).catch(() => {});
    Promise.race([flush, timeout]).finally(() => {
      flushed = true;
      if (!win.isDestroyed()) win.close();
    });
  });
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.loadURL(START_URL);
}

// The page has no external links; refuse new windows, webviews and any
// navigation away from the app origin.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => { if (!isAppUrl(url)) event.preventDefault(); });
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on('window-all-closed', () => app.quit());
  // Ctrl+C / kill: quit normally so pending edits are saved and the socket is removed.
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.quit());

  let stopped = false;
  app.on('will-quit', (event) => {
    if (stopped) return;
    event.preventDefault();
    stopServer().finally(() => {
      stopped = true;
      app.quit();
    });
  });

  app.whenReady().then(async () => {
    try {
      await startServer();
    } catch (err) {
      dialog.showErrorBox('Story Mapper could not start', String(err?.message ?? err));
      app.exit(1);
      return;
    }
    protocol.handle(SCHEME, proxy);
    buildMenu();
    createWindow();
  });
}
