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
server/        Express API, JSON file store, input validation, demo story
public/        Frontend (vanilla JS modules + Cytoscape.js served from node_modules)
  js/analysis.js   Story-structure analysis, shared with the tests
test/          node:test suites (analysis + API)
docs/          Design notes
```
