// Vice Cover Studio — hand-in program.
//
// The app itself lives in app/: plain static files (index.html, style.css and
// ES modules under src/, plus three sample photos) that a desktop browser
// loads fully offline. In the editor you arrange photos across multi-panel
// poster layouts, grade the result, stamp a title and export a PNG. This
// program is only the plumbing around it: it copies app/ and screenshots/
// into the output directory and writes dossier.json with the vendored
// make.fun library, after checking the screenshots obey the scorer's caps.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_SHOTS = 4;
const MAX_SHOT_BYTES = 262144;

// Verification pass: the scorer refuses an entry with more than 4
// screenshots or any single one over 256 KiB, so refuse first, loudly.
const shotDir = join(here, 'screenshots');
const shots = existsSync(shotDir)
  ? readdirSync(shotDir).filter((name) => /\.(?:png|jpe?g)$/i.test(name)).sort()
  : [];
if (shots.length > MAX_SHOTS) {
  throw new Error(`screenshots/: ${shots.length} images, more than the ${MAX_SHOTS} allowed`);
}
let shotBytes = 0;
for (const name of shots) {
  const path = join(shotDir, name);
  const bytes = statSync(path).size;
  if (bytes > MAX_SHOT_BYTES) {
    throw new Error(`screenshots/${name}: ${bytes} bytes, over the ${MAX_SHOT_BYTES} allowed`);
  }
  const head = readFileSync(path).subarray(0, 3);
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e;
  if (!isJpeg && !isPng) throw new Error(`screenshots/${name}: not a PNG or JPEG by its first bytes`);
  shotBytes += bytes;
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotDir)) cpSync(shotDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`Vice Cover Studio: handed in app/ + ${shots.length} screenshots [${shots.join(', ')}] (${shotBytes} bytes), dossier ${dossier.length} bytes -> ${out}`);
