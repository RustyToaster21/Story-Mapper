// Builds www/ (Capacitor's webDir) from the web app:
//   - copies ../public unchanged (edit the originals, never www/)
//   - copies the vendored cytoscape module to www/vendor/cytoscape.mjs
//   - bundles src/platform.js (+ the shared server/store.js and service.js
//     and the Capacitor plugins) into www/js/platform.js
//   - adds <script type="module" src="/js/platform.js"> before app.js, so the
//     platform is in place before the app's modules evaluate.
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.dirname(mobile);
const www = path.join(mobile, 'www');
const require = createRequire(path.join(mobile, 'package.json'));

await rm(www, { recursive: true, force: true });
await cp(path.join(repo, 'public'), www, { recursive: true });

await mkdir(path.join(www, 'vendor'), { recursive: true });
const cytoscapeDist = path.dirname(require.resolve('cytoscape'));
await cp(path.join(cytoscapeDist, 'cytoscape.esm.min.mjs'), path.join(www, 'vendor', 'cytoscape.mjs'));

await build({
  entryPoints: [path.join(mobile, 'src', 'platform.js')],
  outfile: path.join(www, 'js', 'platform.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
  logLevel: 'warning',
});

const indexFile = path.join(www, 'index.html');
const html = await readFile(indexFile, 'utf8');
const appScript = '<script type="module" src="/js/app.js"></script>';
if (!html.includes(appScript)) throw new Error(`stage: ${appScript} not found in public/index.html`);
await writeFile(indexFile, html.replace(appScript, `<script type="module" src="/js/platform.js"></script>\n  ${appScript}`));

console.log('Staged www/ from the web app (+ bundled js/platform.js).');
