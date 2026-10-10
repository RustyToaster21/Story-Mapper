// Android platform shell for the Story Mapper web frontend.
//
// Loaded (bundled by scripts/stage.mjs) before js/app.js. There is no server
// on Android, so this provides the same api methods as public/js/api.js, backed
// by the shared Store + story service writing JSON files through Capacitor,
// plus a saveFile() that hands exports to the Android share sheet.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Store } from '../../server/store.js';
import {
  createStory, importStory, recordPlaythrough, resetStats, saveStory, seedIfEmpty,
} from '../../server/service.js';
import { capacitorFs } from './capacitor-fs.js';

const store = new Store('stories', capacitorFs);
const ready = store.init().then(() => seedIfEmpty(store));

function createApi(ApiError) {
  const notFound = () => { throw new ApiError(404, 'Story not found'); };
  // Mirror the HTTP API: results are copies, validation failures are 400s.
  const call = async (fn) => {
    await ready;
    try {
      return structuredClone(await fn());
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err?.status === 400) throw new ApiError(400, err.message);
      throw err;
    }
  };

  return {
    list: () => call(() => store.list()),
    get: (id) => call(async () => (await store.get(id)) ?? notFound()),
    create: (title) => call(() => createStory(store, { title })),
    import: (doc) => call(() => importStory(store, doc)),
    save: (story) => call(async () => {
      const result = await saveStory(store, story.id, { ...story, baseUpdatedAt: story.updatedAt });
      if (result?.conflict) throw new ApiError(409, 'Story was changed elsewhere', { story: result.conflict });
      return result ? result.story : notFound();
    }),
    remove: (id) => call(async () => { if (!(await store.remove(id))) notFound(); return null; }),
    playthrough: (id, path) => call(async () => (await recordPlaythrough(store, id, path)) ?? notFound()),
    resetStats: (id) => call(async () => (await resetStats(store, id)) ?? notFound()),
  };
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

// Export JSON / Save PNG. Android WebViews can't do browser downloads, so write
// the file to the cache folder (the only one the share sheet may read by
// default) and let the user pick where it goes: Drive, Files, email, etc.
async function saveFile(filename, blob) {
  if (!Capacitor.isNativePlatform()) {
    // Running in a desktop browser (e.g. `npm run serve`): plain download.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { uri } = await Filesystem.writeFile({
    path: `exports/${filename}`, data: await blobToBase64(blob), directory: Directory.Cache, recursive: true,
  });
  try {
    await Share.share({ title: filename, files: [uri], dialogTitle: 'Save or send' });
  } catch (err) {
    if (/cancel/i.test(err?.message ?? '')) return; // user closed the share sheet
    throw err;
  }
}

globalThis.storyMapperPlatform = { name: Capacitor.getPlatform(), createApi, saveFile };
