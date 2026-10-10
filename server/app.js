import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createStory, importStory, recordPlaythrough, resetStats, saveStory } from './service.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const cytoscapeFile = path.join(path.dirname(require.resolve('cytoscape')), 'cytoscape.esm.min.mjs');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const hostname = (h) => (h || '').replace(/:\d+$/, '').toLowerCase();

export function createApp(store) {
  const app = express();
  app.disable('x-powered-by');

  // Only answer to local hostnames (DNS-rebinding defence) and refuse
  // cross-origin writes from other sites open in the same browser.
  app.use((req, res, next) => {
    if (!LOCAL_HOSTS.has(hostname(req.headers.host))) return res.status(403).send('Forbidden host');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.headers.origin;
      if (origin) {
        let originHost = '';
        try { originHost = new URL(origin).host; } catch { /* invalid origin */ }
        if (originHost !== req.headers.host) return res.status(403).json({ error: 'Cross-origin request refused' });
      }
      if (req.headers['content-length'] !== '0' && req.is('application/json') === false) {
        return res.status(415).json({ error: 'Expected application/json' });
      }
    }
    res.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });

  app.use(express.json({ limit: '20mb' }));
  app.get('/vendor/cytoscape.mjs', (req, res) => res.type('text/javascript').sendFile(cytoscapeFile, { dotfiles: 'allow' }));
  app.use(express.static(path.join(root, 'public')));

  const api = express.Router();

  api.get('/stories', async (req, res) => res.json(await store.list()));

  api.post('/stories', async (req, res) => {
    res.status(201).json(await createStory(store, { title: req.body?.title, description: req.body?.description }));
  });

  api.post('/stories/import', async (req, res) => {
    res.status(201).json(await importStory(store, req.body));
  });

  api.get('/stories/:id', async (req, res) => {
    const story = await store.get(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json(story);
  });

  api.put('/stories/:id', async (req, res) => {
    const result = await saveStory(store, req.params.id, req.body);
    if (result?.conflict) return res.status(409).json({ error: 'Story was changed elsewhere', story: result.conflict });
    if (!result) return res.status(404).json({ error: 'Story not found' });
    res.json(result.story);
  });

  api.delete('/stories/:id', async (req, res) => {
    if (!(await store.remove(req.params.id))) return res.status(404).json({ error: 'Story not found' });
    res.status(204).end();
  });

  api.post('/stories/:id/playthrough', async (req, res) => {
    const stats = await recordPlaythrough(store, req.params.id, req.body?.path);
    if (!stats) return res.status(404).json({ error: 'Story not found' });
    res.json(stats);
  });

  api.delete('/stories/:id/stats', async (req, res) => {
    const stats = await resetStats(store, req.params.id);
    if (!stats) return res.status(404).json({ error: 'Story not found' });
    res.json(stats);
  });

  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    // Only expose messages we wrote ourselves (validation, body-parser); never raw internals.
    res.status(status).json({ error: err.expose ? err.message : 'Internal server error' });
  });

  return app;
}
