import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';

let server; let base; let dir;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'story-mapper-test-'));
  const store = new Store(dir);
  await store.init();
  server = createApp(store).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

const api = (p, { method = 'GET', body, headers = {} } = {}) => fetch(base + p, {
  method,
  headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test('create, list, update, delete a story', async () => {
  const created = await (await api('/api/stories', { method: 'POST', body: { title: 'Cave' } })).json();
  assert.equal(created.title, 'Cave');
  assert.equal(created.scenes.length, 1);
  assert.equal(created.startSceneId, created.scenes[0].id);

  const list = await (await api('/api/stories')).json();
  assert.ok(list.some((s) => s.id === created.id && s.sceneCount === 1));

  const edited = { ...created, baseUpdatedAt: created.updatedAt, title: 'Cave 2' };
  edited.scenes = [...created.scenes, { id: 'second', title: 'Second' }];
  edited.scenes[0] = { ...edited.scenes[0], choices: [{ label: 'go', target: 'second' }] };
  const res = await api(`/api/stories/${created.id}`, { method: 'PUT', body: edited });
  assert.equal(res.status, 200);
  const saved = await res.json();
  assert.equal(saved.title, 'Cave 2');
  assert.equal(saved.scenes[0].choices[0].target, 'second');
  assert.ok(saved.scenes[0].choices[0].id, 'choice gets an id');

  // stale baseUpdatedAt => conflict
  const stale = await api(`/api/stories/${created.id}`, { method: 'PUT', body: { ...edited, title: 'stale' } });
  assert.equal(stale.status, 409);

  assert.equal((await api(`/api/stories/${created.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await api(`/api/stories/${created.id}`)).status, 404);
});

test('import sanitises untrusted documents and assigns a new id', async () => {
  const res = await api('/api/stories/import', {
    method: 'POST',
    body: {
      id: '../../etc/passwd',
      title: 'Imported',
      scenes: [
        { id: 'a', title: 'A', status: 'bogus', ending: 'weird', tags: ['x', 'x', 7], position: { x: 'no', y: 1 },
          choices: [{ label: 'bad target', target: '../x' }, { label: 'ok', target: 'b', requires: 'has space', sets: 'gem' }] },
        { id: 'b', title: 'B', ending: 'good' },
      ],
      stats: { playthroughs: -5, visits: { a: 3, nope: 9 } },
      extraField: 'dropped',
    },
  });
  assert.equal(res.status, 201);
  const s = await res.json();
  assert.match(s.id, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(s.id, '../../etc/passwd');
  assert.equal(s.extraField, undefined);
  const a = s.scenes[0];
  assert.equal(a.status, 'draft');
  assert.equal(a.ending, '');
  assert.deepEqual(a.tags, ['x']);
  assert.equal(a.position, null);
  assert.equal(a.choices[0].target, '');
  assert.equal(a.choices[1].requires, '');
  assert.equal(a.choices[1].sets, 'gem');
  assert.deepEqual(s.stats, { playthroughs: 0, visits: { a: 3 }, endingsReached: {} });
  assert.deepEqual(await readdir(dir).then((f) => f.filter((n) => n.includes('passwd'))), []);
});

test('duplicate scene ids are rejected with a 400', async () => {
  const res = await api('/api/stories/import', { method: 'POST', body: { scenes: [{ id: 'a' }, { id: 'a' }] } });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /duplicate/);
});

test('playthroughs update stats without bumping updatedAt; PUT cannot forge stats', async () => {
  const s = await (await api('/api/stories/import', {
    method: 'POST',
    body: { scenes: [{ id: 'a', choices: [{ target: 'b' }] }, { id: 'b', ending: 'bad' }] },
  })).json();
  const stats = await (await api(`/api/stories/${s.id}/playthrough`, { method: 'POST', body: { path: ['a', 'b', 'zzz'] } })).json();
  assert.deepEqual(stats, { playthroughs: 1, visits: { a: 1, b: 1 }, endingsReached: { b: 1 } });

  const after1 = await (await api(`/api/stories/${s.id}`)).json();
  assert.equal(after1.updatedAt, s.updatedAt);

  const put = await (await api(`/api/stories/${s.id}`, {
    method: 'PUT', body: { ...after1, baseUpdatedAt: after1.updatedAt, stats: { playthroughs: 999 } },
  })).json();
  assert.equal(put.stats.playthroughs, 1);

  assert.equal((await api(`/api/stories/${s.id}/playthrough`, { method: 'POST', body: { path: 'nope' } })).status, 400);
  const reset = await (await api(`/api/stories/${s.id}/stats`, { method: 'DELETE' })).json();
  assert.equal(reset.playthroughs, 0);
});

test('rejects foreign Host headers, cross-origin writes and non-JSON writes', async () => {
  // fetch() won't let us override Host, so use node:http directly.
  const http = await import('node:http');
  const status = await new Promise((resolve) => {
    http.get(`${base}/api/stories`, { headers: { host: 'evil.example:4777' } }, (res) => resolve(res.statusCode));
  });
  assert.equal(status, 403);

  const cross = await api('/api/stories', { method: 'POST', body: {}, headers: { origin: 'http://evil.example' } });
  assert.equal(cross.status, 403);

  const form = await fetch(`${base}/api/stories`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });
  assert.equal(form.status, 415);
});

test('path-traversal ids never reach the filesystem', async () => {
  assert.equal((await api('/api/stories/..%2F..%2Fpackage')).status, 404);
  assert.equal((await api('/api/stories/a.b', { method: 'DELETE' })).status, 404);
});

test('corrupt story files are skipped, not fatal', async () => {
  await writeFile(path.join(dir, 'broken.json'), '{not json');
  const res = await api('/api/stories');
  assert.equal(res.status, 200);
  assert.equal((await api('/api/stories/broken')).status, 404);
});

test('serves the app shell with a strict CSP and the vendored cytoscape', async () => {
  const res = await api('/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  const cy = await api('/vendor/cytoscape.mjs');
  assert.equal(cy.status, 200);
  assert.match(cy.headers.get('content-type'), /javascript/);
});
