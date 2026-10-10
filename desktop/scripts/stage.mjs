// Copies the web app's server/ and public/ into desktop/ so Electron (and
// electron-builder) see the same layout the web app expects. The originals are
// only read, never changed; the copies are gitignored and refreshed every run.
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.dirname(desktop);

for (const dir of ['server', 'public']) {
  const dest = path.join(desktop, dir);
  await rm(dest, { recursive: true, force: true });
  await cp(path.join(repo, dir), dest, { recursive: true });
}
console.log('Staged server/ and public/ from the web app.');
