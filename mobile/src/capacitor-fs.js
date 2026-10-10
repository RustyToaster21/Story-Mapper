// Store filesystem adapter (see server/store.js) backed by Capacitor's
// Filesystem plugin. Paths are relative to the app's private data directory
// (Android: /data/data/<appId>/files), which is removed on uninstall.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

const DIR = Directory.Data;

// Native errors carry codes (OS-PLUG-FILE-0008 = missing, -0010 = exists);
// the web implementation (used when testing in a browser) only has messages.
const isMissing = (err) => err?.code === 'OS-PLUG-FILE-0008' || /does not exist/i.test(err?.message ?? '');
const isExisting = (err) => err?.code === 'OS-PLUG-FILE-0010' || /already exist/i.test(err?.message ?? '');

async function mapErrors(fn) {
  try {
    return await fn();
  } catch (err) {
    if (isMissing(err)) {
      const e = new Error(err.message);
      e.code = 'ENOENT';
      throw e;
    }
    throw err;
  }
}

export const capacitorFs = {
  join: (...parts) => parts.join('/'),

  async mkdir(dir) {
    try {
      await Filesystem.mkdir({ path: dir, directory: DIR, recursive: true });
    } catch (err) {
      if (!isExisting(err)) throw err;
    }
  },

  readdir: (dir) => mapErrors(async () => {
    const { files } = await Filesystem.readdir({ path: dir, directory: DIR });
    return files.map((f) => (typeof f === 'string' ? f : f.name));
  }),

  readFile: (file) => mapErrors(async () => {
    const { data } = await Filesystem.readFile({ path: file, directory: DIR, encoding: Encoding.UTF8 });
    return typeof data === 'string' ? data : await data.text();
  }),

  writeFile: (file, data) => mapErrors(() => Filesystem.writeFile({
    path: file, data, directory: DIR, encoding: Encoding.UTF8, recursive: true,
  })),

  // Prefer an atomic rename over the old file; if this platform refuses to
  // replace an existing file, remove it first and retry.
  rename: (from, to) => mapErrors(async () => {
    const opts = { from, to, directory: DIR, toDirectory: DIR };
    try {
      await Filesystem.rename(opts);
    } catch (err) {
      if (isMissing(err)) throw err;
      await Filesystem.deleteFile({ path: to, directory: DIR }).catch(() => {});
      await Filesystem.rename(opts);
    }
  }),

  rm: (file) => mapErrors(() => Filesystem.deleteFile({ path: file, directory: DIR })),
};
