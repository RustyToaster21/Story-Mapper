# Story Mapper — Android and iOS apps

The same Story Mapper as the web and desktop apps, packaged as an Android and iOS app with [Capacitor](https://capacitorjs.com). It runs fully offline on the phone or tablet, with no server and no account. Requires Android 7.0 (API 24) or newer, or iOS / iPadOS 15 or newer. It's most comfortable on a tablet or a large phone. For iOS, see [iOS (iPhone and iPad)](#ios-iphone-and-ipad) below.

## Install the APK

1. Copy `story-mapper-debug.apk` to the device (USB, cloud drive, email…) and open it.
2. Android will ask to allow installing apps from that source (Files, Chrome, Drive…). Allow it, then tap **Install**. Play Protect may warn about an unknown developer, because this is a debug build that isn't from the Play Store. Choose **Install anyway**.

Or with a USB cable and *USB debugging* turned on: `adb install -r story-mapper-debug.apk`.

## Using it on a touchscreen

| Action | Touch |
|---|---|
| Select a scene | Tap it |
| Add a scene | **+ Scene**, or double-tap empty map space |
| Link scenes | Select a scene, then **tap with two fingers** on the scene it should lead to, or add a choice in the editor and pick its target |
| Move a scene | Drag it |
| Pan / zoom the map | Drag empty space / pinch |
| Export JSON, Save PNG | Opens the Android share sheet: save to Files or Drive, email it, etc. |
| Import | Opens the file picker |
| New story | Asks for a name in a native dialog. Its text box starts empty (Capacitor's dialog doesn't show a default); leave it blank for "Untitled story". |

## Where stories are saved

In the app's private storage (`/data/data/io.storymapper.app/files/stories/`), one JSON file per story, in the same format as the web and desktop apps. Use **Export JSON** / **Import** to move stories between devices. **Uninstalling the app deletes its stories**, so export anything you want to keep first.

## Building it

Needs JDK 21, the Android SDK (platform 36, build-tools 36) and Node.js 22.12+. See the main README for a one-line installer. Then, from this `mobile/` folder:

```sh
npm install          # first time only
npm run apk          # -> android/app/build/outputs/apk/debug/app-debug.apk
npm run serve        # try the Android build of the frontend in a desktop browser (localhost:4790)
```

`npm run apk` stages the web app into `www/`, syncs it into the Android project and runs Gradle. Gradle finds the SDK through `ANDROID_HOME`, which the installers in the main README set. Alternatively, put `sdk.dir=/home/<you>/Android/Sdk` in `android/local.properties` (gitignored). To open the project in Android Studio instead, run `npm run sync && npx cap open android`.

### Testing in the emulator

```sh
sdkmanager "emulator" "system-images;android-36;google_apis;x86_64"        # ~1.5 GB, once
avdmanager create avd -n storymapper36 -k "system-images;android-36;google_apis;x86_64" -d pixel_8
emulator -avd storymapper36 &                                              # add -no-window for headless
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell run-as io.storymapper.app ls files/stories                       # see the saved story files
```

Debug builds allow WebView debugging (Capacitor's default; release builds don't). With the app open, `chrome://inspect` in desktop Chrome or Chromium shows its page for DevTools.

The debug APK is signed with the SDK's debug key, which is fine for installing on your own devices. Publishing to the Play Store needs a release build signed with your own key (`./gradlew bundleRelease` plus a keystore made with `keytool`).

## iOS (iPhone and iPad)

iOS apps can only be built with Apple's Xcode on macOS, so the iOS app is built by GitHub Actions on a GitHub-hosted Mac ([`.github/workflows/ios.yml`](../.github/workflows/ios.yml)). You don't need a Mac yourself.

**Status: working.** The unsigned build has been sideloaded onto a real device, and it runs flawlessly. Every workflow run also tests it on a simulated iPhone.

### Getting a build

The workflow runs on every push to `master` that changes the app, and on demand from **Actions → iOS → Run workflow**. Each run uploads an artifact called **story-mapper-ios**:

| File | What it's for |
|---|---|
| `simulator-screenshot.png` | The app running on a simulated iPhone in that run |
| `story-mapper-ios-simulator.zip` | The app for the iOS Simulator, if you have a Mac: unzip, then `xcrun simctl install booted App.app` |
| `story-mapper-ios-unsigned.ipa` | An unsigned build for real devices. Sideloading tools such as Sideloadly or AltStore can sign it with a free Apple ID and install it on your own iPhone or iPad. Apps signed that way stop opening after 7 days until re-signed. |

The run fails unless the app launches on the simulated iPhone and saves its demo story through the native file storage, so a green run means the build actually works.

### Install on your iPhone or iPad (sideloading, free)

This is how the app has been tested on a real device. It needs a computer, a USB cable and a free Apple ID; no developer membership is required.

1. Download the **story-mapper-ios** artifact from the latest run under **Actions → iOS** (you need to be signed in to GitHub), and unzip it to get `story-mapper-ios-unsigned.ipa`.
2. Install a sideloading tool on your computer, such as [Sideloadly](https://sideloadly.io) (Windows / macOS) or [AltStore](https://altstore.io).
3. Connect the iPhone or iPad, open the `.ipa` in the tool, sign in with your Apple ID when asked, and start the install. The tool signs the app with your Apple ID and installs it.
4. On the device, the first time:
   - **iOS 16 or newer:** turn on **Settings → Privacy & Security → Developer Mode** and restart when asked.
   - Trust the signature under **Settings → General → VPN & Device Management**: tap your Apple ID and choose **Trust**.
5. Open **Story Mapper**.

With a free Apple ID, sideloaded apps stop opening after 7 days. Re-install the same way to renew; your stories are kept. A free Apple ID can have up to 3 sideloaded apps at a time. A [signed build](#signed-builds-apple-developer-program) from a paid membership doesn't have these limits.

### Signed builds (Apple Developer Program)

With a paid Apple Developer Program membership ($99/year), the workflow can also produce properly signed builds: Ad Hoc builds for your registered devices, or App Store builds for TestFlight. Signing is automatic through an App Store Connect API key, so there are no certificate or provisioning-profile files to manage.

1. In [App Store Connect](https://appstoreconnect.apple.com), go to **Users and Access → Integrations → App Store Connect API** and create a team key with the **Admin** role, which Xcode needs to create signing certificates. Download the `AuthKey_XXXXXXXXXX.p8` file (Apple only lets you download it once) and note the **Key ID** and **Issuer ID**.
2. Find your **Team ID** under **Membership details** at [developer.apple.com/account](https://developer.apple.com/account).
3. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add four repository secrets:

   | Secret | Value |
   |---|---|
   | `APPLE_TEAM_ID` | Your 10-character Team ID |
   | `ASC_KEY_ID` | The key's Key ID |
   | `ASC_ISSUER_ID` | The Issuer ID |
   | `ASC_KEY_P8_BASE64` | The `.p8` file, base64-encoded: `base64 -w0 AuthKey_XXXXXXXXXX.p8` on Linux, `base64 -i AuthKey_XXXXXXXXXX.p8` on macOS |

4. Go to **Actions → iOS → Run workflow** and pick a build type:
   - **release-testing** (Ad Hoc): installs directly on devices registered in your developer account. Register each device's UDID under **Certificates, IDs & Profiles → Devices** first. The signed `.ipa` is uploaded as the artifact `story-mapper-ios-signed-release-testing`.
   - **app-store-connect**: for TestFlight and the App Store. Create the app in App Store Connect first (bundle ID `io.storymapper.app`), then tick **Upload app-store-connect builds to TestFlight** to send the build there.

Signed builds only run when you start the workflow by hand; pushes still produce just the unsigned builds. Each build's number is the workflow run number, so TestFlight uploads never clash.

### Where stories are saved on iOS

In the app's Documents folder, one JSON file per story. They're visible in the **Files** app under **On My iPhone / iPad → Story Mapper → stories**, so you can copy them out for backup or to another device. **Deleting the app deletes its stories**, so export or copy anything you want to keep first.

### What's iOS-specific

- `ios/` is the Xcode project, generated by Capacitor and committed. It uses Swift Package Manager, not CocoaPods, and targets iOS 15+ on iPhone and iPad.
- `ios/App/App/PrivacyInfo.xcprivacy` is Apple's required privacy manifest: no tracking, no data collected, and the file-timestamp access the Filesystem plugin needs (reason `C617.1`).
- `Info.plist` adds Files-app access to the stories folder (`UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`) and declares no non-exempt encryption (`ITSAppUsesNonExemptEncryption`), so App Store Connect doesn't ask about export compliance.
- `scripts/icons.sh` also generates the iOS app icon (1024 px, no transparency, as Apple requires) and launch-screen images.
- `npm run sync:ios` stages the web app into `ios/App/App/public` (gitignored). On a Mac, `npx cap open ios` then opens the project in Xcode.

## How it works

The Android app is the web app's frontend, unchanged, plus a small platform layer:

- `scripts/stage.mjs` copies `../public` into `www/` (gitignored, so **edit the originals**), adds the vendored Cytoscape, and bundles `src/platform.js` with esbuild. It injects that bundle into `index.html` ahead of `app.js`.
- There's no server on Android. `src/platform.js` gives the frontend the same API as `public/js/api.js`, backed by the **same** `server/store.js` and `server/service.js` the web server uses. Files are read and written through Capacitor's Filesystem plugin (`src/capacitor-fs.js`). Validation, conflict detection and play-test stats behave identically on every platform.
- Exports go through the share sheet, because Android WebViews can't do browser downloads.
- `scripts/icons.sh` regenerates the launcher icons and splash screens from the favicon design.
- Story text is rendered as plain text everywhere, as in the web app. The app loads nothing from the network.

| File | |
|---|---|
| `src/platform.js` | Local API, share-sheet export |
| `src/capacitor-fs.js` | Store filesystem adapter over `@capacitor/filesystem` |
| `scripts/stage.mjs` | Builds `www/` from `../public` |
| `scripts/serve.mjs` | Static server for testing `www/` in a browser |
| `scripts/icons.sh` | Android and iOS app icons + splash screens |
| `capacitor.config.json` | App id `io.storymapper.app`, name, web dir |
| `android/` | The native Android project (generated by Capacitor, committed) |
| `ios/` | The native iOS project (generated by Capacitor, committed) |
| `../.github/workflows/ios.yml` | Builds and tests the iOS app on a GitHub-hosted Mac |
