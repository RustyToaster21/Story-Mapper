// Story operations shared by the HTTP API (web + desktop) and the Android app,
// so the rules for ids, conflicts and server-owned stats live in one place.
import { sampleStory } from './sample.js';
import { newId, normalizePath, normalizeStory } from './validate.js';

const emptyStats = () => ({ playthroughs: 0, visits: {}, endingsReached: {} });

// updatedAt doubles as the conflict-detection version, so it must change on
// every save, even two saves within the same millisecond.
function nextTimestamp(previous) {
  const now = Date.now();
  const prev = Date.parse(previous);
  return new Date(Number.isNaN(prev) || now > prev ? now : prev + 1).toISOString();
}

export async function seedIfEmpty(store) {
  if ((await store.list()).length > 0) return;
  const story = normalizeStory(sampleStory());
  await store.update(story.id, () => story);
}

export async function createStory(store, { title, description } = {}) {
  const startId = newId();
  const now = new Date().toISOString();
  const story = normalizeStory({
    id: newId(),
    title,
    description,
    startSceneId: startId,
    scenes: [{ id: startId, title: 'Opening scene', position: { x: 0, y: 0 } }],
    createdAt: now,
    updatedAt: now,
  });
  await store.update(story.id, () => story);
  return story;
}

// Imported files get a fresh story id so they never overwrite an existing story.
export async function importStory(store, doc) {
  const now = new Date().toISOString();
  const story = normalizeStory({ ...doc, id: newId(), createdAt: now, updatedAt: now });
  await store.update(story.id, () => story);
  return story;
}

// Replace a story's content. Returns { story }, { conflict: current } when
// baseUpdatedAt is stale (edited elsewhere), or null when the story is gone.
export async function saveStory(store, id, doc) {
  const base = doc?.baseUpdatedAt;
  let conflict = null;
  const saved = await store.update(id, (current) => {
    if (!current) return null;
    if (base && base !== current.updatedAt) { conflict = current; return null; }
    const next = normalizeStory({
      ...doc,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: nextTimestamp(current.updatedAt),
    });
    next.stats = normalizeStory({ ...next, stats: current.stats }).stats; // stats are server-owned
    return next;
  });
  if (conflict) return { conflict };
  return saved ? { story: saved } : null;
}

// Throws ValidationError for a malformed path; returns null when the story is gone.
export async function recordPlaythrough(store, id, path) {
  const saved = await store.update(id, (story) => {
    if (!story) return null;
    const byId = new Map(story.scenes.map((s) => [s.id, s]));
    const visited = normalizePath(path, new Set(byId.keys()));
    const { stats } = story;
    stats.playthroughs++;
    for (const sid of new Set(visited)) stats.visits[sid] = (stats.visits[sid] || 0) + 1;
    const last = visited.at(-1);
    if (last && byId.get(last).ending) stats.endingsReached[last] = (stats.endingsReached[last] || 0) + 1;
    return story; // updatedAt untouched: stats don't conflict with edits
  });
  return saved ? saved.stats : null;
}

export async function resetStats(store, id) {
  const saved = await store.update(id, (story) => {
    if (!story) return null;
    story.stats = emptyStats();
    return story;
  });
  return saved ? saved.stats : null;
}
