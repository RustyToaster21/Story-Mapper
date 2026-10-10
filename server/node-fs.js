// Store filesystem adapter for Node (web server and desktop app).
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const nodeFs = {
  join: path.join,
  mkdir: (dir) => mkdir(dir, { recursive: true }),
  readdir: (dir) => readdir(dir),
  readFile: (file) => readFile(file, 'utf8'),
  writeFile: (file, data) => writeFile(file, data),
  rename: (from, to) => rename(from, to),
  rm: (file) => rm(file),
};
