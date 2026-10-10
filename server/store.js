// One JSON file per story, written atomically (temp file + rename).
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ID_RE, normalizeStory } from './validate.js';

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.queues = new Map(); // per-story write serialisation
  }

  async init() {
    await mkdir(this.dir, { recursive: true });
  }

  file(id) {
    if (!ID_RE.test(id)) return null; // never let an id reach the filesystem unchecked
    return path.join(this.dir, `${id}.json`);
  }

  async list() {
    const names = (await readdir(this.dir)).filter((n) => n.endsWith('.json'));
    const out = [];
    for (const name of names) {
      const story = await this.get(name.slice(0, -5));
      if (story) {
        out.push({
          id: story.id, title: story.title, description: story.description,
          sceneCount: story.scenes.length, updatedAt: story.updatedAt,
        });
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id) {
    const file = this.file(id);
    if (!file) return null;
    try {
      // Files on disk can be hand-edited or synced in; re-normalise on read.
      return { ...normalizeStory(JSON.parse(await readFile(file, 'utf8'))), id };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      if (err instanceof SyntaxError || err.status === 400) {
        console.warn(`skipping unreadable story file ${path.basename(file)}`);
        return null;
      }
      throw err;
    }
  }

  // Serialise read-modify-write cycles per story id.
  update(id, fn) {
    const prev = this.queues.get(id) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(async () => {
      const current = await this.get(id);
      const result = await fn(current);
      if (result) await this.#write(result);
      return result;
    });
    this.queues.set(id, next);
    next.finally(() => { if (this.queues.get(id) === next) this.queues.delete(id); }).catch(() => {});
    return next;
  }

  async #write(story) {
    const file = this.file(story.id);
    if (!file) throw new Error('invalid story id');
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(story, null, 2));
    await rename(tmp, file);
  }

  async remove(id) {
    const file = this.file(id);
    if (!file) return false;
    try {
      await rm(file);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }
}
