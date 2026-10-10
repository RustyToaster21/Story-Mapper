import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { Store } from './store.js';
import { sampleStory } from './sample.js';
import { normalizeStory } from './validate.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT) || 4777;
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || path.join(root, 'data', 'stories');

const store = new Store(DATA_DIR);
await store.init();
if ((await store.list()).length === 0) {
  const story = normalizeStory(sampleStory());
  await store.update(story.id, () => story);
}

createApp(store).listen(PORT, HOST, (err) => {
  if (err) {
    console.error(`Could not start server: ${err.message}`);
    process.exit(1);
  }
  console.log(`Story Mapper running at http://${HOST === '127.0.0.1' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Stories are saved in ${DATA_DIR}`);
});
