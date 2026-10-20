/**
 * Extracts the per-DLC theme artwork from an installed copy of AoE3 DE.
 *
 *   node scripts/build-theme-art.mjs "<game dir>"
 *   e.g. node scripts/build-theme-art.mjs "C:\XboxGames\Age of Empires III- Definitive Edition\Content"
 *
 * Writes assets/themes/<theme id>.webp (header art) and <theme id>-thumb.webp (settings cards).
 * Only plain UI images are read (Game/UI/UIResources*.bar); see scripts/bar.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { listBar, readEntry } from './bar.mjs';

/** Theme id -> image inside the UI archives (paths under Data/wpfg/resources/). */
const ART = {
  base: 'images/icons/singleplayer/SPC_load_screen_05.png', // Morgan Black's Caribbean campaign map
  warchiefs: 'images/icons/singleplayer/spcx_load_screen_09.png', // Fort Laramie, Great Plains
  'asian-dynasties': 'images/icons/singleplayer/spcy_load_screen_jc4a.png', // Japan, Fushimi Castle
  definitive: 'images/historicalbattles/Historical Battles/age3zhb1.png', // DE historical battle
  'united-states': 'art/dlc_banners/dlc_us.png',
  'african-royals': 'art/dlc/dlc_africa.png',
  mexico: 'art/dlc/dlc_mexico.png',
  mediterranean: 'art/dlc/dlc_ItalianMaltese.png',
  baltic: 'art/dlc/dlc_baltic.png',
};

const content = process.argv[2];
const uiDir = content && [path.join(content, 'Game', 'UI'), path.join(content, 'UI')].find((d) => fs.existsSync(d));
if (!uiDir) {
  console.error('Usage: node scripts/build-theme-art.mjs "<AoE3 DE install>/Content"');
  process.exit(1);
}
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'themes');
fs.mkdirSync(out, { recursive: true });

const archives = fs
  .readdirSync(uiDir)
  .filter((f) => /^UIResources\d*\.bar$/i.test(f))
  .map((f) => path.join(uiDir, f));
const index = new Map();
for (const file of archives) {
  for (const e of listBar(file)) index.set(e.name.toLowerCase(), { file, e });
}

for (const [theme, rel] of Object.entries(ART)) {
  const hit = index.get(`data/wpfg/resources/${rel}`.toLowerCase());
  if (!hit) {
    console.warn(`missing art for ${theme}: ${rel}`);
    continue;
  }
  const png = readEntry(hit.file, hit.e);
  await sharp(png)
    .resize(900, 400, { fit: 'cover', position: 'attention' })
    .webp({ quality: 78 })
    .toFile(path.join(out, `${theme}.webp`));
  await sharp(png)
    .resize(320, 140, { fit: 'cover', position: 'attention' })
    .webp({ quality: 75 })
    .toFile(path.join(out, `${theme}-thumb.webp`));
  console.log(`${theme}: ${rel}`);
}
