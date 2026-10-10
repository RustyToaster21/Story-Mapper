// Serves www/ on http://localhost:4790 to try the Android build of the
// frontend in a desktop browser. Capacitor's web implementations stand in for
// the native plugins (stories go to the browser's IndexedDB, not files).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const www = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'www');
const PORT = Number(process.env.PORT) || 4790;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
};

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.join(www, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);
  if (file !== www && !file.startsWith(www + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Serving www/ at http://localhost:${PORT}`));
