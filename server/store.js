// One JSON file per story, written atomically (temp file + rename).
//
// The filesystem is passed in as an adapter so the same store runs on Node
// (node-fs.js) and inside the Android app (Capacitor Filesystem). An adapter
// provides: join(...parts), mkdir(dir), readdir(dir) -> names,
// readFile(file) -> utf8 string, writeFile(file, string), rename(from, to),
// rm(file). Missing files must reject with err.code === 'ENOENT'.
import { ID_RE, normalizeStory } from './validate.js';

const basename = (file) => file.split(/[\\/]/).pop();

export class Store {
  constructor(dir, fs) {
    if (!fs) throw new Error('Store needs a filesystem adapter');
    this.dir = dir;
    this.fs = fs;
    this.queues = new Map(); // per-story write serialisation
  }

  async init() {
    await this.fs.mkdir(this.dir);
  }

  file(id) {
    if (!ID_RE.test(id)) return null; // never let an id reach the filesystem unchecked
    return this.fs.join(this.dir, `${id}.json`);
  }

  async list() {
    const names = (await this.fs.readdir(this.dir)).filter((n) => n.endsWith('.json'));
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
      return { ...normalizeStory(JSON.parse(await this.fs.readFile(file))), id };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      if (err instanceof SyntaxError || err.status === 400) {
        console.warn(`skipping unreadable story file ${basename(file)}`);
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
    const tmp = `${file}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}.tmp`;
    await this.fs.writeFile(tmp, JSON.stringify(story, null, 2));
    await this.fs.rename(tmp, file);
  }

  async remove(id) {
    const file = this.file(id);
    if (!file) return false;
    try {
      await this.fs.rm(file);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }
}
