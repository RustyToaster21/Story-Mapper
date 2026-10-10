# Story Mapper — desktop app (Linux AppImage, Windows zip)

The same Story Mapper as the web app, packaged as a desktop app with its own window. Nothing else to install: no Node.js and no web browser.

## Windows 10 / 11 (x64)

1. Copy `story-mapper-1.0.0-win-x64.zip` to the PC and **right-click → Extract All…**. Run it from the extracted folder, not from inside the zip.
2. Open the extracted folder and double-click **`Story Mapper.exe`**.
3. The first time, Windows SmartScreen may say *"Windows protected your PC"* because the app isn't code-signed. Click **More info → Run anyway**.

To get a Start-menu or desktop entry, right-click `Story Mapper.exe` → **Show more options → Create shortcut** and move the shortcut where you want it. Keep the whole folder together; the `.exe` needs the files next to it.

| | |
|---|---|
| Stories are saved in | `%APPDATA%\Story Mapper\stories\` (paste that into the Explorer address bar) |
| Override | Start it from PowerShell: `$env:DATA_DIR = "D:\Writing\stories"; & ".\Story Mapper.exe"` |
| Uninstall | Delete the folder. To remove your stories and settings too, delete `%APPDATA%\Story Mapper`. |

The window uses Electron's bundled Chromium. It doesn't use Edge or WebView2, and it opens no network port: the in-app server listens on a private, randomly named Windows named pipe.

## Linux

Download the AppImage, make it executable, run it.

```sh
chmod +x story-mapper-1.0.0-x86_64.AppImage
./story-mapper-1.0.0-x86_64.AppImage
```

It runs on any current x86_64 desktop distro: Ubuntu 22.04+, Debian 12+, Fedora, openSUSE, Arch/CachyOS, Linux Mint, Pop!_OS and others. It needs glibc 2.25+ and the usual desktop libraries (GTK 3, NSS, ALSA), which every desktop install already has. **FUSE / `libfuse2` is not required.** The AppImage uses the static runtime.

## Where stories are saved (Linux)

| | |
|---|---|
| Default | `~/.config/Story Mapper/stories/` (`$XDG_CONFIG_HOME` is respected) |
| Override | `DATA_DIR=/path/to/stories ./story-mapper-….AppImage` |

Files use the same one-JSON-file-per-story format as the web app's `data/stories/`. Copy them across in either direction, or point `DATA_DIR` at the web app's folder to share stories with it. Only run one of the two against a folder at a time. A demo story is created on first run if the folder is empty.

## How it works

The desktop app is the web app's own code, unchanged. `scripts/stage.mjs` copies `../server` and `../public` into this folder before every run or build. The copies are gitignored, so **edit the originals, never the copies**.

- `main.js` runs the web app's Express server **inside the app on a private Unix socket** (in a `0700` folder under `$XDG_RUNTIME_DIR`). On Windows it uses a randomly named named pipe instead (`\\?\pipe\story-mapper-<random>`), which only the current user can write to. No network port is opened.
- The window loads `app://story-mapper/`. Electron forwards every request on that scheme to the socket. The fixed origin keeps the app's saved UI state (last story, heatmap toggle) across restarts.
- The window is sandboxed with context isolation and no Node access. New windows, webviews and navigation away from the app are blocked.
- Electron doesn't support `window.prompt()`, which the web app uses to name new stories. `preload.cjs` replaces it with a small modal dialog (`prompt/`).
- Closing the window saves any pending edits first, and so do Ctrl+C and `kill`.

### Chromium sandbox (Linux)

The sandbox stays on by default. Some distros (Ubuntu 24.04+ with its default AppArmor policy) block the unprivileged user namespaces it needs. The AppImage's launcher detects that with `unshare -Ur true` and only then starts with `--no-sandbox`. To keep the sandbox on those systems, install the app properly (e.g. as a `.deb`) or allow user namespaces for it with an AppArmor profile.

## Development

Requires Node.js 22.12+. Run from this `desktop/` folder:

```sh
npm install          # first time only
npm start            # run the desktop app from source
npm test             # end-to-end smoke tests (Playwright driving Electron)
npm run dist         # build dist/story-mapper-<version>-x86_64.AppImage
npm run dist:win     # build dist/story-mapper-<version>-win-x64.zip (from Linux)
```

Building the Windows zip on Linux needs nothing beyond `npm install`. electron-builder downloads the Windows Electron runtime and converts `assets/icon.png` to an `.ico` itself. Wine is only required for Windows *installer* targets (NSIS / Squirrel), which aren't configured. The zip is unsigned, so Windows SmartScreen shows a warning on first launch. Signing needs a code-signing certificate, plus `osslsigncode` when signing on Linux.

To test the built AppImage instead of the source: `APPIMAGE_PATH=dist/story-mapper-1.0.0-x86_64.AppImage npm test`.

The tests open real windows. To keep them off your screen, run them in a virtual X display:

```sh
env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 xvfb-run -a npm test
```

The web app's own tests are unaffected: run `npm test` in the repository root.

| File | |
|---|---|
| `main.js` | App lifecycle, socket server, `app://` proxy, window, menu, prompt dialog |
| `preload.cjs` | `window.prompt()` replacement |
| `prompt/` | The prompt dialog (HTML/CSS/JS + its own preload) |
| `scripts/stage.mjs` | Copies `../server` and `../public` in |
| `assets/icon.png` | App icon, rendered from `public/favicon.svg` |
| `test/smoke.test.js` | End-to-end tests |
