# Story Mapper

A local web app for planning, tracking and play-testing **choose-your-own-adventure** text games.

- **Map** — every scene is a node, every choice an arrow. Drag to arrange, or auto-arrange as a tree from the start scene.
- **Write** — scene text, author notes, tags, and a draft → review → done status per scene.
- **Branch logic** — choices can *require* a flag (`key`, or `!key` for "not set") and *set* one (`key`, or `!key` to clear it).
- **Find problems** — dead ends, unreachable scenes, choices with no target, flags that are required but never set, no reachable ending.
- **Track progress** — % done, word count, number of endings, distinct paths to an ending, longest path, loops.
- **Play-test** — run the story like a player, with flags and a Back button. The path is highlighted on the map. Runs from the start scene are recorded, giving you scene/ending coverage and an optional visit heatmap.
- **Import / export** stories as JSON, and save the map as a PNG.

## Download

Ready-to-run builds are attached to the [latest release](https://github.com/RustyToaster21/Story-Mapper/releases/latest):

| Platform | File | How to run |
|---|---|---|
| Windows 10/11 (x64) | `story-mapper-1.0.0-win-x64.zip` | Extract, double-click `Story Mapper.exe`. See [desktop/README.md](desktop/README.md). |
| macOS 13+ (Apple silicon) | `story-mapper-1.0.0-mac-arm64.zip` | Extract, drag to Applications, then allow it once in System Settings → Privacy & Security. See [desktop/README.md](desktop/README.md#macos-13-ventura-or-newer). |
| macOS 13+ (Intel) | `story-mapper-1.0.0-mac-x64.zip` | Same as above. |
| Linux (x86_64) | `story-mapper-1.0.0-x86_64.AppImage` | `chmod +x` it and run. See [desktop/README.md](desktop/README.md). |
| Android 7.0+ | `story-mapper-1.0.0-android.apk` | Open it on the device and allow the install. See [mobile/README.md](mobile/README.md). |
| Web app (any OS) | this repository | `npm install && npm start`, then open <http://localhost:4777>. Setup guides below for [Linux](#linux-setup), [macOS](#macos-setup) and [Windows](#windows-11-setup). |

`SHA256SUMS.txt` in the release lists each file's checksum. The builds aren't signed with a developer certificate, so Windows SmartScreen, macOS Gatekeeper and Android Play Protect will warn on first install.

## Linux setup

Works on any current x86_64 or arm64 distro. The only thing Story Mapper needs is **Node.js 22 or newer** (npm is included); everything else is installed by `npm install`. Not on Linux? See [macOS setup](#macos-setup) or [Windows 11 setup](#windows-11-setup) below.

### 1. Install Node.js 22 or newer

Pick your distro. Then check with `node -v`, which should print v22 or newer.

**Arch Linux, CachyOS, Manjaro, EndeavourOS**

```sh
sudo pacman -S --needed nodejs npm
```

**Debian 12 / 13, Ubuntu 22.04 / 24.04, Linux Mint, Pop!_OS**: these ship an older Node.js, so install it from NodeSource's repository:

```sh
sudo apt-get update && sudo apt-get install -y curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt-get install -y nodejs
```

**Ubuntu 26.04 or newer**: Node.js 22 is in the regular repositories:

```sh
sudo apt-get update && sudo apt-get install -y nodejs npm curl
```

**Fedora**

```sh
sudo dnf install -y nodejs
```

**RHEL, Rocky Linux, AlmaLinux 9**

```sh
sudo dnf module install -y nodejs:22
```

**RHEL, Rocky Linux, AlmaLinux 10**

```sh
sudo dnf install -y nodejs npm
```

### 2. Get the project

```sh
cd ~
curl -fsSL https://github.com/RustyToaster21/Story-Mapper/archive/refs/heads/master.tar.gz | tar -xz
mv Story-Mapper-master story-mapper
cd story-mapper
```

Or with Git (install it with `sudo pacman -S git`, `sudo apt-get install git` or `sudo dnf install git`):

```sh
git clone https://github.com/RustyToaster21/Story-Mapper.git ~/story-mapper
cd ~/story-mapper
```

### 3. Install dependencies and start

```sh
npm install        # first time only
npm start
```

Then open <http://localhost:4777>. A demo story ("The Lighthouse at Gull Point") is created on first run. **Ctrl+C** stops the server.

| Setting | Default | |
|---|---|---|
| `PORT` | `4777` | `PORT=8080 npm start` |
| `HOST` | `127.0.0.1` | Local-only by default. Other hostnames are refused by the Host-header check. |
| `DATA_DIR` | `./data/stories` | One `<id>.json` file per story — easy to back up or put in git. |

`npm run dev` restarts the server when files change; `npm test` runs the test suite.

### Keep it running in the background (optional)

Install it as a systemd user service. Run this from the project folder; it records that folder's path in the service:

```sh
mkdir -p ~/.config/systemd/user
sed "s#^WorkingDirectory=.*#WorkingDirectory=$PWD#" deploy/story-mapper.service > ~/.config/systemd/user/story-mapper.service
systemctl --user daemon-reload
systemctl --user enable --now story-mapper
```

It starts now and whenever you log in. To keep it running while you're logged out, and from boot, also run `sudo loginctl enable-linger $USER`. View its log with `journalctl --user -u story-mapper`. To stop and remove it:

```sh
systemctl --user disable --now story-mapper && rm ~/.config/systemd/user/story-mapper.service
```

## macOS setup

> **Just want to use it?** The macOS desktop app needs no setup at all: download the zip for your Mac from the [latest release](https://github.com/RustyToaster21/Story-Mapper/releases/latest) and see [desktop/README.md](desktop/README.md#macos-13-ventura-or-newer). The steps below are for running the web version from source.

This assumes a Mac running macOS 13 Ventura or newer, either Apple silicon or Intel, with nothing installed. The only thing Story Mapper needs is **Node.js 22 or newer** (npm is included); everything else is installed by `npm install`. You don't need Xcode, Git or Homebrew.

All commands below are typed into **Terminal**. Open it with **⌘ Space → type `Terminal` → Return**.

### 1. Install Node.js

**Official installer (simplest):** go to <https://nodejs.org>, download the **LTS** "macOS Installer (.pkg)" and run it with the default options. One installer works on both Apple silicon and Intel Macs.

**Or, if you already use [Homebrew](https://brew.sh):**

```sh
brew install node
```

Then **open a new Terminal window** and check:

```sh
node -v    # should print v22.x or newer
npm -v
```

### 2. Get the project

Download it from GitHub and unpack it into your home folder:

```sh
cd ~
curl -L -o story-mapper.zip https://github.com/RustyToaster21/Story-Mapper/archive/refs/heads/master.zip
unzip -q story-mapper.zip && rm story-mapper.zip
mv Story-Mapper-master story-mapper
cd story-mapper
```

<details>
<summary>Using Git instead</summary>

```sh
git clone https://github.com/RustyToaster21/Story-Mapper.git ~/story-mapper
cd ~/story-mapper
```

The first time you run `git`, macOS offers to install the **Command Line Developer Tools**. Click **Install**; it takes a few minutes. That's the only extra this route needs.
</details>

### 3. Install dependencies and start

```sh
npm install
npm start
```

You should see:

```
Story Mapper running at http://localhost:4777
Stories are saved in /Users/<you>/story-mapper/data/stories
```

Open **<http://localhost:4777>** in Safari, Chrome or Firefox, or type `open http://localhost:4777` in a second Terminal window. Leave the first Terminal window open while you work. **Ctrl+C** in it stops the server.

Optionally, run `npm test` to check everything works on your Mac. It should report `pass 18` and `fail 0`.

### Settings on macOS

The settings table above works as-is in Terminal:

```sh
PORT=8080 npm start                                     # use another port
DATA_DIR="$HOME/Documents/Story Mapper" npm start       # keep stories elsewhere, e.g. a folder you back up
```

The server listens on `127.0.0.1` only, so macOS normally doesn't ask about incoming connections. If it ever does, choose **Deny**. Nothing outside your Mac needs access.

### Start it automatically at login (optional)

This registers Story Mapper as a background service for your user account, using macOS's own `launchd`:

```sh
mkdir -p ~/Library/LaunchAgents ~/Library/Logs
cat > ~/Library/LaunchAgents/io.storymapper.web.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>io.storymapper.web</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v node)</string>
    <string>$HOME/story-mapper/server/index.js</string>
  </array>
  <key>WorkingDirectory</key><string>$HOME/story-mapper</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/story-mapper.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/story-mapper.log</string>
</dict>
</plist>
EOF
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/io.storymapper.web.plist
```

It starts now and at every login; macOS may show a "Background Items Added" notification. Then just open <http://localhost:4777>. The log is in `~/Library/Logs/story-mapper.log`. To stop it and remove the service:

```sh
launchctl bootout gui/$(id -u)/io.storymapper.web && rm ~/Library/LaunchAgents/io.storymapper.web.plist
```

If you move the project folder or reinstall Node.js, remove the service and set it up again, since it records both paths.

### macOS troubleshooting

| Problem | Fix |
|---|---|
| `zsh: command not found: node` | Open a **new** Terminal window after installing Node. With Homebrew on Apple silicon, also run the `eval "$(/opt/homebrew/bin/brew shellenv)"` line Homebrew printed at the end of its install, and add it to `~/.zprofile`. |
| A "Command Line Developer Tools" pop-up appears | You ran `git`. Click **Install**, or use the `curl` download in step 2, which doesn't need it. |
| `Could not start server: listen EADDRINUSE` | Something already uses port 4777, often an earlier Story Mapper window or the login service above. Close it, or start with `PORT=4778 npm start`. |
| `node -v` prints v20 or older | Install the current LTS from <https://nodejs.org>, or run `brew upgrade node`. |
| `npm install` fails with `EACCES` | Don't use `sudo`. Make sure the project is in your home folder (step 2), not somewhere like `/Applications`. |
| Page loads but is blank | Hard-refresh with **⌘ Shift R**. Check the Terminal window for errors. |

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

### 3. Get the project

Download it from GitHub and unpack it into your user folder:

```powershell
cd $HOME
Invoke-WebRequest https://github.com/RustyToaster21/Story-Mapper/archive/refs/heads/master.zip -OutFile story-mapper.zip
Expand-Archive story-mapper.zip -DestinationPath .
Remove-Item story-mapper.zip
Rename-Item Story-Mapper-master story-mapper
cd story-mapper
```

Prefer the browser? On the [GitHub page](https://github.com/RustyToaster21/Story-Mapper), click **Code → Download ZIP**, right-click the zip → **Extract All…** into your user folder, and rename the extracted `Story-Mapper-master` folder to `story-mapper`.

To bring stories from another computer, copy its `data\stories\` folder into `$HOME\story-mapper\data\stories\`.

<details>
<summary>Using Git instead</summary>

```powershell
winget install --id Git.Git -e --source winget
# open a new terminal, then:
git clone https://github.com/RustyToaster21/Story-Mapper.git "$HOME\story-mapper"
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

An offline Android version lives in [`mobile/`](mobile/README.md). It's the same frontend, wrapped with Capacitor, with stories saved on the device. Building the APK needs **Node.js 22.12+** (see [Linux setup](#linux-setup)), **JDK 21**, and the **Android SDK** (platform 36 + build-tools 36).

Pick the one-liner for your distro. Each one:
- installs JDK 21, from your distro if it has it, otherwise [Eclipse Temurin](https://adoptium.net) (Debian 12, Fedora 44+)
- downloads Google's Android command-line tools into `~/Android/Sdk`, checking the download's SHA-1
- installs the SDK packages and **accepts the Android SDK licenses on your behalf**
- adds `JAVA_HOME` and `ANDROID_HOME` to `~/.profile`, plus `~/.bashrc`, `~/.zshrc` and fish's config if you have them

It uses `sudo` and downloads about 1 GB.

**Arch Linux, CachyOS, Manjaro, EndeavourOS**

```bash
bash -c 'sudo pacman -S --needed jdk21-openjdk unzip curl && Z=commandlinetools-linux-16111833_latest.zip && A="$HOME/Android/Sdk" && J=$(dirname "$(dirname "$(readlink -f "$(ls /usr/lib/jvm/*21*/bin/javac | head -n1)")")") && [ -x "$J/bin/javac" ] && mkdir -p "$A/cmdline-tools" && cd /tmp && curl -fLO "https://dl.google.com/android/repository/$Z" && echo "e025545c62a8e64c7559119566a569fb1dec5f60  $Z" | sha1sum -c - && rm -rf "$A/cmdline-tools/latest" && unzip -q "$Z" -d "$A/cmdline-tools" && mv "$A/cmdline-tools/cmdline-tools" "$A/cmdline-tools/latest" && rm "$Z" && export JAVA_HOME="$J" && (yes | "$A/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null) && "$A/cmdline-tools/latest/bin/sdkmanager" "platform-tools" "platforms;android-36" "build-tools;36.0.0" && for f in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do { [ -f "$f" ] || [ "$f" = "$HOME/.profile" ]; } && ! grep -q ANDROID_HOME "$f" 2>/dev/null && printf "\nexport JAVA_HOME=\"%s\"\nexport ANDROID_HOME=\"\$HOME/Android/Sdk\"\nexport PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH\"\n" "$J" >> "$f"; done; F="$HOME/.config/fish/config.fish"; if [ -f "$F" ] && ! grep -q ANDROID_HOME "$F"; then printf "\nset -gx JAVA_HOME %s\nset -gx ANDROID_HOME \$HOME/Android/Sdk\nset -gx PATH \$ANDROID_HOME/cmdline-tools/latest/bin \$ANDROID_HOME/platform-tools \$PATH\n" "$J" >> "$F"; fi; "$J/bin/java" -version && echo "Android build tools installed - open a new terminal."'
```

**Debian 12 / 13, Ubuntu 22.04 or newer, Linux Mint, Pop!_OS**

```bash
bash -c 'sudo apt-get update && if apt-cache show openjdk-21-jdk-headless > /dev/null 2>&1; then sudo apt-get install -y openjdk-21-jdk-headless curl unzip; else sudo apt-get install -y curl unzip gpg && curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/adoptium.gpg > /dev/null && echo "deb https://packages.adoptium.net/artifactory/deb $(. /etc/os-release; echo ${UBUNTU_CODENAME:-$VERSION_CODENAME}) main" | sudo tee /etc/apt/sources.list.d/adoptium.list > /dev/null && sudo apt-get update && sudo apt-get install -y temurin-21-jdk; fi && Z=commandlinetools-linux-16111833_latest.zip && A="$HOME/Android/Sdk" && J=$(dirname "$(dirname "$(readlink -f "$(ls /usr/lib/jvm/*21*/bin/javac | head -n1)")")") && [ -x "$J/bin/javac" ] && mkdir -p "$A/cmdline-tools" && cd /tmp && curl -fLO "https://dl.google.com/android/repository/$Z" && echo "e025545c62a8e64c7559119566a569fb1dec5f60  $Z" | sha1sum -c - && rm -rf "$A/cmdline-tools/latest" && unzip -q "$Z" -d "$A/cmdline-tools" && mv "$A/cmdline-tools/cmdline-tools" "$A/cmdline-tools/latest" && rm "$Z" && export JAVA_HOME="$J" && (yes | "$A/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null) && "$A/cmdline-tools/latest/bin/sdkmanager" "platform-tools" "platforms;android-36" "build-tools;36.0.0" && for f in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do { [ -f "$f" ] || [ "$f" = "$HOME/.profile" ]; } && ! grep -q ANDROID_HOME "$f" 2>/dev/null && printf "\nexport JAVA_HOME=\"%s\"\nexport ANDROID_HOME=\"\$HOME/Android/Sdk\"\nexport PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH\"\n" "$J" >> "$f"; done; F="$HOME/.config/fish/config.fish"; if [ -f "$F" ] && ! grep -q ANDROID_HOME "$F"; then printf "\nset -gx JAVA_HOME %s\nset -gx ANDROID_HOME \$HOME/Android/Sdk\nset -gx PATH \$ANDROID_HOME/cmdline-tools/latest/bin \$ANDROID_HOME/platform-tools \$PATH\n" "$J" >> "$F"; fi; "$J/bin/java" -version && echo "Android build tools installed - open a new terminal."'
```

**Fedora, RHEL, Rocky Linux, AlmaLinux 9 / 10**

```bash
bash -c 'if dnf -q list --available java-21-openjdk-devel > /dev/null 2>&1 || rpm -q java-21-openjdk-devel > /dev/null 2>&1; then sudo dnf install -y java-21-openjdk-devel unzip; else printf "[Adoptium]\nname=Adoptium\nbaseurl=https://packages.adoptium.net/artifactory/rpm/%s/\$releasever/\$basearch\nenabled=1\ngpgcheck=1\ngpgkey=https://packages.adoptium.net/artifactory/api/gpg/key/public\n" "$(. /etc/os-release; echo $ID)" | sudo tee /etc/yum.repos.d/adoptium.repo > /dev/null && sudo dnf install -y temurin-21-jdk unzip; fi && Z=commandlinetools-linux-16111833_latest.zip && A="$HOME/Android/Sdk" && J=$(dirname "$(dirname "$(readlink -f "$(ls /usr/lib/jvm/*21*/bin/javac | head -n1)")")") && [ -x "$J/bin/javac" ] && mkdir -p "$A/cmdline-tools" && cd /tmp && curl -fLO "https://dl.google.com/android/repository/$Z" && echo "e025545c62a8e64c7559119566a569fb1dec5f60  $Z" | sha1sum -c - && rm -rf "$A/cmdline-tools/latest" && unzip -q "$Z" -d "$A/cmdline-tools" && mv "$A/cmdline-tools/cmdline-tools" "$A/cmdline-tools/latest" && rm "$Z" && export JAVA_HOME="$J" && (yes | "$A/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null) && "$A/cmdline-tools/latest/bin/sdkmanager" "platform-tools" "platforms;android-36" "build-tools;36.0.0" && for f in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do { [ -f "$f" ] || [ "$f" = "$HOME/.profile" ]; } && ! grep -q ANDROID_HOME "$f" 2>/dev/null && printf "\nexport JAVA_HOME=\"%s\"\nexport ANDROID_HOME=\"\$HOME/Android/Sdk\"\nexport PATH=\"\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$PATH\"\n" "$J" >> "$f"; done; F="$HOME/.config/fish/config.fish"; if [ -f "$F" ] && ! grep -q ANDROID_HOME "$F"; then printf "\nset -gx JAVA_HOME %s\nset -gx ANDROID_HOME \$HOME/Android/Sdk\nset -gx PATH \$ANDROID_HOME/cmdline-tools/latest/bin \$ANDROID_HOME/platform-tools \$PATH\n" "$J" >> "$F"; fi; "$J/bin/java" -version && echo "Android build tools installed - open a new terminal."'
```

Then, in a new terminal:

```sh
cd ~/story-mapper/mobile && npm install && npm run apk
# -> mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## iOS app

The same Capacitor app also targets iPhone and iPad (iOS 15+), from [`mobile/ios`](mobile/README.md#ios-iphone-and-ipad). iOS apps can only be built with Xcode on macOS, so a GitHub Actions workflow ([`.github/workflows/ios.yml`](.github/workflows/ios.yml)) builds it on a GitHub-hosted Mac; you don't need a Mac yourself. Every run tests the app on a simulated iPhone and uploads an unsigned build. With an Apple Developer Program membership, it can also produce signed Ad Hoc builds or upload to TestFlight. Setup steps are in [mobile/README.md](mobile/README.md#ios-iphone-and-ipad).

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
desktop/       Electron app: Windows zip, macOS zips (Apple silicon + Intel), Linux AppImage
mobile/        Capacitor Android and iOS apps (iOS built by .github/workflows/ios.yml)
test/          node:test suites (analysis, store, API)
docs/          Design notes
```
