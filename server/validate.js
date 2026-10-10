// Normalises any incoming story document (API writes and file imports alike).
// Everything here is untrusted: clamp sizes, coerce types, drop unknown fields.
import { randomUUID } from 'node:crypto';

export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const FLAG_RE = /^!?[A-Za-z0-9_.-]{1,64}$/;
const STATUSES = new Set(['draft', 'review', 'done']);
const ENDINGS = new Set(['', 'good', 'bad', 'neutral']);

const LIMITS = {
  title: 200, description: 5000, scenes: 2000, body: 50000, notes: 10000,
  tags: 20, tag: 40, choices: 50, label: 500, path: 5000,
};

export class ValidationError extends Error {
  constructor(message) { super(message); this.status = 400; this.expose = true; }
}

export const newId = () => randomUUID().replaceAll('-', '').slice(0, 16);

const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);
const id = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : newId());
const flag = (v) => (typeof v === 'string' && FLAG_RE.test(v.trim()) ? v.trim() : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
const count = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);

function normalizeChoice(c) {
  if (!c || typeof c !== 'object') return null;
  return {
    id: id(c.id),
    label: str(c.label, LIMITS.label),
    target: typeof c.target === 'string' && ID_RE.test(c.target) ? c.target : '',
    requires: flag(c.requires),
    sets: flag(c.sets),
  };
}

function normalizeScene(s) {
  if (!s || typeof s !== 'object') throw new ValidationError('scene must be an object');
  const x = num(s.position?.x);
  const y = num(s.position?.y);
  const tags = Array.isArray(s.tags) ? s.tags : [];
  const choices = Array.isArray(s.choices) ? s.choices : [];
  if (choices.length > LIMITS.choices) throw new ValidationError(`a scene may have at most ${LIMITS.choices} choices`);
  return {
    id: id(s.id),
    title: str(s.title, LIMITS.title) || 'Untitled scene',
    body: str(s.body, LIMITS.body),
    status: STATUSES.has(s.status) ? s.status : 'draft',
    ending: ENDINGS.has(s.ending) ? s.ending : '',
    tags: [...new Set(tags.map((t) => str(t, LIMITS.tag).trim()).filter(Boolean))].slice(0, LIMITS.tags),
    notes: str(s.notes, LIMITS.notes),
    position: x !== null && y !== null ? { x, y } : null,
    choices: choices.map(normalizeChoice).filter(Boolean),
  };
}

function normalizeStats(stats, sceneIds) {
  const pick = (obj) => {
    const out = {};
    if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) if (sceneIds.has(k) && count(v)) out[k] = v;
    }
    return out;
  };
  return {
    playthroughs: count(stats?.playthroughs),
    visits: pick(stats?.visits),
    endingsReached: pick(stats?.endingsReached),
  };
}

export function normalizeStory(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('story must be a JSON object');
  }
  const rawScenes = Array.isArray(input.scenes) ? input.scenes : [];
  if (rawScenes.length > LIMITS.scenes) throw new ValidationError(`a story may have at most ${LIMITS.scenes} scenes`);
  const scenes = rawScenes.map(normalizeScene);

  const sceneIds = new Set();
  for (const s of scenes) {
    if (sceneIds.has(s.id)) throw new ValidationError(`duplicate scene id: ${s.id}`);
    sceneIds.add(s.id);
  }
  const startSceneId = typeof input.startSceneId === 'string' && sceneIds.has(input.startSceneId)
    ? input.startSceneId : (scenes[0]?.id ?? '');

  return {
    id: id(input.id),
    title: str(input.title, LIMITS.title).trim() || 'Untitled story',
    description: str(input.description, LIMITS.description),
    startSceneId,
    scenes,
    stats: normalizeStats(input.stats, sceneIds),
    createdAt: typeof input.createdAt === 'string' ? input.createdAt.slice(0, 40) : new Date().toISOString(),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt.slice(0, 40) : new Date().toISOString(),
  };
}

export function normalizePath(path, sceneIds) {
  if (!Array.isArray(path) || path.length === 0 || path.length > LIMITS.path) {
    throw new ValidationError('path must be a non-empty array of scene ids');
  }
  return path.filter((p) => typeof p === 'string' && sceneIds.has(p));
}
