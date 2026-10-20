/**
 * Extracts what the icon pipeline needs from an installed copy of AoE3 DE into a folder laid out
 * like the AoE3DEDatabase dump (Data/*.xml, Data/strings/..., Data/wpfg/resources/...).
 *
 *   node scripts/extract-game-data.mjs "<AoE3 DE install>/Content" <out-dir>
 *   node scripts/build-icons.mjs <out-dir> <AoE3DEDatabase checkout>
 */
import fs from 'node:fs';
import path from 'node:path';

import { listBar, readEntry, xmbToXml } from './bar.mjs';

const [content, out] = process.argv.slice(2);
const game = content && [path.join(content, 'Game'), content].find((d) => fs.existsSync(path.join(d, 'Data', 'Data.bar')));
if (!game || !out) {
  console.error('Usage: node scripts/extract-game-data.mjs "<AoE3 DE install>/Content" <out-dir>');
  process.exit(1);
}

const DATA = /^Data\/((civs|protoy|techtreey)\.xml|homecity[a-z_]+\.xml|strings\/English\/stringtabley\.xml)\.XMB$/i;
const IMAGES = /^Data\/wpfg\/resources\/(art\/units|art\/buildings|images\/icons\/(techs|home_city|ingame|flags))\/.+\.png$/i;

function extract(archive, filter) {
  let n = 0;
  for (const e of listBar(archive)) {
    if (!filter.test(e.name)) continue;
    const isXmb = /\.xmb$/i.test(e.name);
    const dest = path.join(out, isXmb ? e.name.replace(/\.xmb$/i, '') : e.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const data = readEntry(archive, e);
    fs.writeFileSync(dest, isXmb ? xmbToXml(data) : data);
    n++;
  }
  return n;
}

let total = extract(path.join(game, 'Data', 'Data.bar'), DATA);
const uiDir = path.join(game, 'UI');
for (const f of fs.readdirSync(uiDir).filter((f) => /^UIResources\d*\.bar$/i.test(f))) {
  total += extract(path.join(uiDir, f), IMAGES);
}
console.log(`extracted ${total} files to ${out}`);
