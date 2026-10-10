# Story Mapper

A local web app for planning, tracking and play-testing **choose-your-own-adventure** text games.

- **Map** — every scene is a node, every choice an arrow. Drag to arrange, or auto-arrange as a tree from the start scene.
- **Write** — scene text, author notes, tags, and a draft → review → done status per scene.
- **Branch logic** — choices can *require* a flag (`key`, or `!key` for "not set") and *set* one (`key`, or `!key` to clear it).
- **Find problems** — dead ends, unreachable scenes, choices with no target, flags that are required but never set, no reachable ending.
- **Track progress** — % done, word count, number of endings, distinct paths to an ending, longest path, loops.
- **Play-test** — run the story like a player, with flags and a Back button. The path is highlighted on the map. Runs from the start scene are recorded, giving you scene/ending coverage and an optional visit heatmap.
- **Import / export** stories as JSON, and save the map as a PNG.

Runs entirely on this machine: Node + Express, stories stored as JSON files, no CDN or network calls.

## Download

Ready-to-run builds are attached to the [latest release](https://github.com/RustyToaster21/Story-Mapper/releases/latest):

| Platform | File | How to run |
|---|---|---|
| Windows 10/11 (x64) | `story-mapper-1.0.0-win-x64.zip` | Extract, double-click `Story Mapper.exe`. See [desktop/README.md](desktop/README.md). |
| Linux (x86_64) | `story-mapper-1.0.0-x86_64.AppImage` | `chmod +x` it and run. See [desktop/README.md](desktop/README.md). |
| Android 7.0+ | `story-mapper-1.0.0-android.apk` | Open it on the device and allow the install. See [mobile/README.md](mobile/README.md). |
| Web app (any OS) | this repository | `npm install && npm start`, then open <http://localhost:4777> (below). |

`SHA256SUMS.txt` in the release lists each file's checksum. The builds are unsigned, so Windows SmartScreen and Android Play Protect will warn on first install.

## Run it (Linux / macOS)

Requires Node.js 22 or newer. On Windows, see [Windows 11 setup](#windows-11-setup) below.

```sh
cd ~/Projects/story-mapper
npm install        # first time only
npm start
```

Then open <http://localhost:4777>. A demo story ("The Lighthouse at Gull Point") is created on first run.

| Setting | Default | |
|---|---|---|
| `PORT` | `4777` | `PORT=8080 npm start` |
| `HOST` | `127.0.0.1` | Local-only by default. Other hostnames are refused by the Host-header check. |
| `DATA_DIR` | `./data/stories` | One `<id>.json` file per story — easy to back up or put in git. |

`npm run dev` restarts the server when files change; `npm test` runs the test suite.

### Keep it running in the background (optional, Linux)

```sh
mkdir -p ~/.config/systemd/user
cp deploy/story-mapper.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now story-mapper
```

## Windows 11 setup

> **Just want to use it?** The desktop build needs no setup at all: extract `story-mapper-1.0.0-win-x64.zip` and double-click `Story Mapper.exe`. No Node.js and no browser are needed. See [desktop/README.md](desktop/README.md); build the zip on Linux with `cd desktop && npm install && npm run dist:win`. The steps below are for running the web version from source.

This assumes a fresh Windows 11 PC with nothing installed. The only thing Story Mapper needs is **Node.js 22 or newer** (npm is included); everything else is installed by `npm install`. You don't need Git, Python, or Visual Studio build tools.

All commands below are typed into **Windows Terminal / PowerShell**. Open it with **Start → type `Terminal` → Enter**.

### 1. Install Node.js (LTS)

Windows 11 ships with **winget** (the Windows Package Manager), so one command does it:

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
```

Approve the administrator (UAC) prompt if one appears.

> **Close the terminal and open a new one** afterwards. Programs only see the updated `PATH` in new windows.

Check that it worked:

```powershell
node -v    # should print v22.x or newer
npm -v
```

<details>
<summary>No winget? Install Node.js by hand instead</summary>

1. Go to <https://nodejs.org> and download the **LTS** Windows Installer (`.msi`). Pick the **x64** build, or **ARM64** on Snapdragon / ARM laptops.
2. Run it and keep the defaults. You don't need the "Tools for native modules" checkbox, because Story Mapper has no native modules.
3. Open a new terminal and run `node -v`.

If `winget` itself is missing or broken, install or update **App Installer** from the Microsoft Store.
</details>

### 2. Allow npm to run in PowerShell (one time)

Windows 11 blocks PowerShell scripts by default, which breaks `npm` with:

```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```

Allow locally created and signed scripts for your user account only:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Answer `Y` if asked. To skip this step entirely, use **Command Prompt** (`cmd`) in place of PowerShell, or type `npm.cmd` wherever this guide says `npm`.

### 3. Get the project onto the PC

The project isn't published online, so copy it over from the machine that has it. On that Linux machine, make a zip of the latest committed code (this leaves out `node_modules/` and your local `data/`):

```sh
cd ~/Projects/story-mapper
git archive --format=zip -o ~/story-mapper.zip HEAD
```

Copy `story-mapper.zip` to the Windows PC (USB stick, network share, cloud drive…). Then, in PowerShell:

```powershell
Expand-Archive "$HOME\Downloads\story-mapper.zip" -DestinationPath "$HOME\story-mapper"
cd "$HOME\story-mapper"
```

Adjust the first path if the zip is somewhere other than Downloads. To bring your existing stories along too, copy the `data\stories\` folder from the old machine into `$HOME\story-mapper\data\stories\`.

<details>
<summary>Using Git instead (if you've pushed the repo somewhere)</summary>

```powershell
winget install --id Git.Git -e --source winget
# open a new terminal, then:
git clone <your-repo-url> "$HOME\story-mapper"
cd "$HOME\story-mapper"
```
</details>

### 4. Install dependencies and start

```powershell
npm install
npm start
```

You should see:

```
Story Mapper running at http://localhost:4777
Stories are saved in C:\Users\<you>\story-mapper\data\stories
```

Open **<http://localhost:4777>** in Edge, Chrome or Firefox. Leave the terminal window open while you work. **Ctrl+C** in it stops the server.

Optionally, run `npm test` to check everything works on your machine. It should report `pass 15` and `fail 0`.

### Settings on Windows

PowerShell sets environment variables differently from Linux:

```powershell
$env:PORT = "8080"; npm start                          # use another port
$env:DATA_DIR = "D:\Writing\stories"; npm start        # keep stories elsewhere (e.g. a synced folder)
```

In Command Prompt, run `set PORT=8080` on one line, then `npm start`. Either way, the setting only lasts for that terminal window.

The server listens on `127.0.0.1` only, so Windows Defender Firewall normally won't ask anything. If it does, choose **Cancel / don't allow**. Nothing outside your PC needs access.

### Start it with a double-click (optional)

Create a file named `Story Mapper.cmd` on your Desktop containing:

```bat
@echo off
cd /d "%USERPROFILE%\story-mapper"
start "" http://localhost:4777
npm start
```

Double-clicking it opens a console window running the server plus your browser. The page may need one refresh if the browser beats the server. To have it start every time you sign in, put a shortcut to that file in the Startup folder (**Win+R → `shell:startup`**).

### Windows troubleshooting

| Problem | Fix |
|---|---|
| `node` / `npm` is not recognized | Open a **new** terminal after installing Node. If it still fails, sign out and back in. |
| `npm.ps1 cannot be loaded … running scripts is disabled` | Do [step 2](#2-allow-npm-to-run-in-powershell-one-time), or use `cmd` / `npm.cmd`. |
| `Could not start server: listen EADDRINUSE` | Something already uses port 4777, often an earlier Story Mapper window. Close it, or start with `$env:PORT = "4778"; npm start`. |
| `node -v` prints v20 or older | Upgrade: `winget upgrade --id OpenJS.NodeJS.LTS -e`. |
| `npm install` fails with network / proxy errors | You're probably behind a company proxy. Ask IT for the proxy address, then run `npm config set proxy http://host:port` and `npm config set https-proxy http://host:port`. |
| Page loads but is blank | Hard-refresh with **Ctrl+F5**. Check the terminal window for errors. |

## Android app

An offline Android version lives in [`mobile/`](mobile/README.md). It's the same frontend, wrapped with Capacitor, with stories saved on the device. To build the APK on CachyOS / Arch you need JDK 21, the Android SDK (platform 36 + build-tools 36) and Node.js 22.12+. This one-liner installs or updates all of them. It uses sudo, pacman and paru, puts the SDK in `~/Android/Sdk`, and **accepts the Android SDK licenses on your behalf**:

```bash
bash -c 'S=; sudo pacman -S --needed jdk21-openjdk android-tools && sudo archlinux-java set java-21-openjdk && paru -S --needed android-sdk-cmdline-tools-latest && S=$(find /opt/android-sdk -path "*/bin/sdkmanager" -type f | head -1) && export ANDROID_HOME="$HOME/Android/Sdk" && mkdir -p "$ANDROID_HOME" && (yes | "$S" --sdk_root="$ANDROID_HOME" --licenses > /dev/null) && "$S" --sdk_root="$ANDROID_HOME" "cmdline-tools;latest" "platform-tools" "platforms;android-36" "build-tools;36.0.0" && cd /tmp && L=$(curl -fsS https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | grep "linux-x64.tar.xz$") && N=${L##* } && curl -fLO "https://nodejs.org/dist/latest-v22.x/$N" && echo "$L" | sha256sum -c - && rm -rf "$HOME/.local/node.new" && mkdir "$HOME/.local/node.new" && tar -xJf "$N" -C "$HOME/.local/node.new" --strip-components=1 && rm -rf "$HOME/.local/node" && mv "$HOME/.local/node.new" "$HOME/.local/node" && rm -f "$N" && for f in "$HOME/.zshrc" "$HOME/.profile"; do grep -q ANDROID_HOME "$f" || printf "\nexport ANDROID_HOME=\"\$HOME/Android/Sdk\"\nexport PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH\"\n" >> "$f"; done && (grep -q ANDROID_HOME "$HOME/.config/fish/config.fish" || printf "\nset -gx ANDROID_HOME \$HOME/Android/Sdk\nset -gx PATH \$ANDROID_HOME/cmdline-tools/latest/bin \$ANDROID_HOME/platform-tools \$PATH\n" >> "$HOME/.config/fish/config.fish") && java -version && "$HOME/.local/node/bin/node" -v && echo "All Android build tools installed - open a new terminal."'
```

Then:

```sh
cd mobile && npm install && npm run apk
# -> mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Using it

| Action | How |
|---|---|
| Add a scene | Double-click empty map space, press **N**, or use **+ Scene** |
| Link scenes | Select a scene, then **right-click** the scene it should lead to — or add a choice in the editor and pick a target (or "+ New scene…") |
| Delete a scene | Select it and press **Del**, or use the button in the editor |
| Search | Press **/** — non-matching scenes fade out |
| Play-test | **P** or **▶ Play-test**; "Play from here" in the editor starts at any scene |

On the map, the border color shows status (grey draft, amber review, green done). Endings are filled green/red/slate, the start scene has a double border, a dashed red outline marks a scene with an issue, and a dashed arrow is a choice that needs a flag.

## Layout

```
server/        Express API, input validation, demo story, plus code shared with the apps:
  store.js       JSON file store (filesystem passed in: node-fs.js, or Capacitor on Android)
  service.js     Story operations: create, import, save + conflict check, play-test stats
public/        Frontend (vanilla JS modules + Cytoscape.js served from node_modules)
  js/analysis.js   Story-structure analysis, shared with the tests
desktop/       Electron app: Linux AppImage, Windows zip
mobile/        Capacitor Android app
test/          node:test suites (analysis, store, API)
docs/          Design notes
```
