// electron-builder afterPack hook: ad-hoc sign the macOS app bundle with
// rcodesign (https://github.com/indygreg/apple-platform-rs).
//
// electron-builder can only code-sign on macOS, and packaging invalidates the
// signature Electron ships with. Apple Silicon Macs refuse to run unsigned
// native code, so without this the arm64 build would be reported as "damaged".
// An ad-hoc signature (no certificate) satisfies that check; it is not a
// Developer ID signature, so Gatekeeper still asks the user to approve the
// app on first launch. Runs before the zip is made; no-op for other platforms.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  try {
    execFileSync('rcodesign', ['sign', app], { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (err) {
    const hint = err.code === 'ENOENT' ? ' rcodesign is not installed (cargo install apple-codesign).' : '';
    throw new Error(`Ad-hoc signing ${app} failed.${hint} ${err.message}`);
  }
  console.log(`  • ad-hoc signed  ${path.basename(app)} (${context.arch === 3 ? 'arm64' : 'x64'})`);
};
