import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { newId, normalizePath, normalizeStory } from './validate.js';

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
    const startId = newId();
    const now = new Date().toISOString();
    const story = normalizeStory({
      id: newId(),
      title: req.body?.title,
      description: req.body?.description,
      startSceneId: startId,
      scenes: [{ id: startId, title: 'Opening scene', position: { x: 0, y: 0 } }],
      createdAt: now,
      updatedAt: now,
    });
    await store.update(story.id, () => story);
    res.status(201).json(story);
  });

  api.post('/stories/import', async (req, res) => {
    const now = new Date().toISOString();
    // Imported files get a fresh story id so they never overwrite an existing story.
    const story = normalizeStory({ ...req.body, id: newId(), createdAt: now, updatedAt: now });
    await store.update(story.id, () => story);
    res.status(201).json(story);
  });

  api.get('/stories/:id', async (req, res) => {
    const story = await store.get(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    res.json(story);
  });

  api.put('/stories/:id', async (req, res) => {
    const base = req.body?.baseUpdatedAt;
    let conflict = null;
    const saved = await store.update(req.params.id, (current) => {
      if (!current) return null;
      if (base && base !== current.updatedAt) { conflict = current; return null; }
      const next = normalizeStory({
        ...req.body,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      });
      next.stats = normalizeStory({ ...next, stats: current.stats }).stats; // stats are server-owned
      return next;
    });
    if (conflict) return res.status(409).json({ error: 'Story was changed elsewhere', story: conflict });
    if (!saved) return res.status(404).json({ error: 'Story not found' });
    res.json(saved);
  });

  api.delete('/stories/:id', async (req, res) => {
    if (!(await store.remove(req.params.id))) return res.status(404).json({ error: 'Story not found' });
    res.status(204).end();
  });

  api.post('/stories/:id/playthrough', async (req, res) => {
    let invalid = null;
    const saved = await store.update(req.params.id, (story) => {
      if (!story) return null;
      const byId = new Map(story.scenes.map((s) => [s.id, s]));
      let visited;
      try { visited = normalizePath(req.body?.path, new Set(byId.keys())); } catch (err) { invalid = err; return null; }
      const { stats } = story;
      stats.playthroughs++;
      for (const sid of new Set(visited)) stats.visits[sid] = (stats.visits[sid] || 0) + 1;
      const last = visited.at(-1);
      if (last && byId.get(last).ending) stats.endingsReached[last] = (stats.endingsReached[last] || 0) + 1;
      return story; // updatedAt untouched: stats don't conflict with edits
    });
    if (invalid) throw invalid;
    if (!saved) return res.status(404).json({ error: 'Story not found' });
    res.json(saved.stats);
  });

  api.delete('/stories/:id/stats', async (req, res) => {
    const saved = await store.update(req.params.id, (story) => {
      if (!story) return null;
      story.stats = { playthroughs: 0, visits: {}, endingsReached: {} };
      return story;
    });
    if (!saved) return res.status(404).json({ error: 'Story not found' });
    res.json(saved.stats);
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
