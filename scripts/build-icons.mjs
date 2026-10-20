/**
 * Builds the in-app icon pack from an extracted AoE3 DE game-data dump.
 *
 * Sources, in priority order (the first one that has a file wins):
 *   - data extracted from an installed game by scripts/extract-game-data.mjs (current patch, all DLCs)
 *   - https://github.com/rainsillwood/AoE3DEDatabase (sparse checkout; older, but has a few extra
 *     images the hand-picked icons below use)
 *
 *   node scripts/build-icons.mjs <source-dir> [more source dirs...]
 *
 * Output:
 *   assets/icons/<id>.webp          64x64 icons
 *   assets/flags/<civ>.webp         civilization flags
 *   src/data/icons.generated.ts     manifest (id -> name, category, require())
 *
 * Icon ids are derived from in-game English names and are persisted inside saved and shared
 * build orders, so existing ids are kept stable across re-runs via src/data/icon-ids.lock.json.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const roots = process.argv.slice(2).map((r) => path.resolve(r));
if (!roots.length || !roots.some((r) => fs.existsSync(path.join(r, 'Data', 'protoy.xml')))) {
  console.error('Usage: node scripts/build-icons.mjs <source-dir> [more source dirs...]');
  process.exit(1);
}
/** First source dir that has `rel`, or null. */
const find = (rel) => roots.map((r) => path.join(r, rel)).find((p) => fs.existsSync(p)) ?? null;
const relToRoot = (file) => path.relative(roots.find((r) => file.startsWith(r)) ?? '', file);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICON_OUT = path.join(root, 'assets', 'icons');
const FLAG_OUT = path.join(root, 'assets', 'flags');
const MANIFEST = path.join(root, 'src', 'data', 'icons.generated.ts');
const LOCK = path.join(root, 'src', 'data', 'icon-ids.lock.json');
const SIZE = 64;

// ---------------------------------------------------------------------------------------------
// Game data parsing

const decode = (s) =>
  s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\\n/g, ' ')
    .trim();

const strings = new Map();
{
  const xml = fs.readFileSync(find('Data/strings/English/stringtabley.xml'), 'utf8');
  for (const m of xml.matchAll(/<string _locid="(\d+)"[^>]*>([^<]*)<\/string>/g)) {
    if (!strings.has(m[1])) strings.set(m[1], decode(m[2]));
  }
}

/** Game icon paths look like `resources\art\units\...png`; they live under Data/wpfg/. */
function resolveGamePath(p) {
  if (!p) return null;
  const rel = p.trim().replace(/\\/g, '/');
  const candidates = [`Data/wpfg/${rel}`];
  if (!rel.endsWith('.png')) candidates.push(`Data/wpfg/${rel}.png`);
  // Some protos point at a large portrait; the matching small icon sits right next to it.
  if (rel.includes('_portrait')) candidates.push(`Data/wpfg/${rel.replace('_portrait', '_icon')}`);
  for (const c of candidates) {
    const hit = find(c);
    if (hit) return hit;
  }
  return null;
}

const tag = (body, name) => body.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];
const tags = (body, name) => [...body.matchAll(new RegExp(`<${name}>([^<]*)</${name}>`, 'g'))].map((m) => m[1]);

const SKIP_NAME = /(^|_)(spc|sp|deco|tutorial|campaign|story|cine|scenario|placeholder|test|fake|dummy|proxy)/i;
const isPlausibleName = (n) => n && n.length <= 48 && !/^\s*$/.test(n) && !/[{}%]/.test(n);

/**
 * `key` is the game object behind the entry ("p:Musketeer" for a proto unit, "t:HCShipSettlers1"
 * for a tech/card); it's what the civ-access walk below matches against.
 * @type {{ file: string, name: string, category: string, aliases?: string[], key?: string }[]}
 */
const entries = [];

/** @type {Map<string, { types: Set<string>, techs: string[] }>} every proto unit, for the civ walk */
const protos = new Map();
/** @type {Map<string, { obtainable: boolean, body: string }>} every tech, for the civ walk */
const techs = new Map();

// Units & buildings
{
  const xml = fs.readFileSync(find('Data/protoy.xml'), 'utf8');
  for (const m of xml.matchAll(/<unit id="\d+" name="([^"]+)">([\s\S]*?)<\/unit>/g)) {
    const [, protoName, body] = m;
    protos.set(protoName, {
      types: new Set(tags(body, 'unittype')),
      // Buildings list their research as <tech row=".." page=".." column="..">Name</tech>.
      techs: [...body.matchAll(/<tech\b[^>]*>([^<]+)<\/tech>/g)].map((t) => t[1]),
    });
    if (SKIP_NAME.test(protoName)) continue;
    const name = strings.get(tag(body, 'displaynameid') ?? '');
    const file = resolveGamePath(tag(body, 'icon'));
    if (!isPlausibleName(name) || !file) continue;
    const types = new Set(tags(body, 'unittype'));
    const trainable = /<trainpoints>/.test(body) || /<buildpoints>/.test(body) || types.has('Hero');
    if (!trainable) continue;
    let category = 'unit';
    if (types.has('Building') || types.has('AbstractBuilding')) category = 'building';
    else if (types.has('AbstractVillager') || types.has('AbstractFishingBoat')) category = 'eco';
    else if (types.has('Ship') || types.has('AbstractWarShip')) category = 'naval';
    entries.push({ file, name, category, key: `p:${protoName}` });
  }
}

// Techs & home-city cards
{
  const xml = fs.readFileSync(find('Data/techtreey.xml'), 'utf8');
  for (const m of xml.matchAll(/<tech name="([^"]+)" type="[^"]*">([\s\S]*?)<\/tech>/g)) {
    const [, techName, body] = m;
    techs.set(techName, { obtainable: tag(body, 'status') !== 'UNOBTAINABLE', body });
    if (SKIP_NAME.test(techName)) continue;
    const name = strings.get(tag(body, 'displaynameid') ?? '');
    const file = resolveGamePath(tag(body, 'icon'));
    if (!isPlausibleName(name) || !file) continue;
    const flags = new Set(tags(body, 'flag'));
    const category = flags.has('HomeCity') ? 'card' : 'tech';
    if (category === 'tech' && !/<researchpoints>/.test(body)) continue;
    entries.push({ file, name, category, key: `t:${techName}` });
  }
}

// ---------------------------------------------------------------------------------------------
// Civ access: which units/techs/cards each civ can actually use. Starting from a civ's age-up
// techs and Home City deck, follow every tech effect that enables a unit, unlocks a tech, adds a
// card or starts a revolution, plus the techs researchable at each reachable building.

/** App civ id -> civ name in civs.xml. Bit position = index, so keep the order stable. */
const CIV_KEYS = [
  ['british', 'British'], ['dutch', 'Dutch'], ['french', 'French'], ['germans', 'Germans'],
  ['ottomans', 'Ottomans'], ['portuguese', 'Portuguese'], ['russians', 'Russians'], ['spanish', 'Spanish'],
  ['aztecs', 'XPAztec'], ['haudenosaunee', 'XPIroquois'], ['lakota', 'XPSioux'], ['chinese', 'Chinese'],
  ['indians', 'Indians'], ['japanese', 'Japanese'], ['incas', 'DEInca'], ['swedes', 'DESwedish'],
  ['americans', 'DEAmericans'], ['ethiopians', 'DEEthiopians'], ['hausa', 'DEHausa'], ['mexicans', 'DEMexicans'],
  ['italians', 'DEItalians'], ['maltese', 'DEMaltese'], ['danes', 'DEDanish'], ['poles', 'DEPolish'],
];

/** Things every civ can get: mercenaries, outlaws, native warriors and native-settlement techs. */
const generalKeys = new Set();
for (const [name, p] of protos) {
  if (['Mercenary', 'AbstractOutlaw', 'AbstractNativeWarrior'].some((t) => p.types.has(t))) generalKeys.add(`p:${name}`);
  if (p.types.has('NativeSocket') || p.types.has('NativeBuilding') || name === 'TradingPost') {
    for (const t of p.techs) generalKeys.add(`t:${t}`);
  }
}

const civsXml = fs.readFileSync(find('Data/civs.xml'), 'utf8');

/** A civ's age-up techs, Home City deck and starting units. */
function civStart(civName) {
  const civ = [...civsXml.matchAll(/<civ>([\s\S]*?)<\/civ>/g)].map((m) => m[1]).find((b) => tag(b, 'name') === civName);
  if (!civ) {
    // Older data dumps predate some DLCs; that civ then gets no civ-specific icons.
    console.warn(`civ ${civName} not in civs.xml`);
    return { startTechs: [], startProtos: [] };
  }
  const startTechs = [...tags(civ, 'tech'), tag(civ, 'postindustrialtech'), tag(civ, 'postimperialtech')].filter(Boolean);
  const hcFile = find(`Data/${tag(civ, 'homecityfilename') ?? ''}`);
  if (hcFile) {
    const hc = fs.readFileSync(hcFile, 'utf8');
    for (const card of hc.matchAll(/<card>([\s\S]*?)<\/card>/g)) startTechs.push(tag(card[1], 'name'));
  }
  const startProtos = [...tags(civ, 'startingunit'), ...tags(civ, 'townstartingunit'), tag(civ, 'settlerprotoname')].filter(Boolean);
  return { startTechs, startProtos };
}

function reachableKeys(civName) {
  const seenTechs = new Set();
  const seenProtos = new Set();
  const { startTechs, startProtos } = civStart(civName);
  const queue = [...startTechs];
  const addProto = (name) => {
    if (seenProtos.has(name) || !protos.has(name)) return;
    seenProtos.add(name);
    // Techs researched at this building/unit that need no unlock.
    for (const t of protos.get(name).techs) if (techs.get(t)?.obtainable) queue.push(t);
  };
  startProtos.forEach(addProto);
  while (queue.length) {
    const t = queue.pop();
    if (seenTechs.has(t) || !techs.has(t)) continue;
    seenTechs.add(t);
    for (const e of techs.get(t).body.matchAll(/<effect ([^>]*)>([\s\S]*?)<\/effect>|<effect ([^>]*)\/>/g)) {
      const attrs = e[1] ?? e[3];
      const inner = e[2] ?? '';
      const attr = (n) => attrs.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1];
      const type = attr('type');
      if (type === 'TechStatus' && /obtainable|active/.test(attr('status') ?? '')) queue.push(inner.trim());
      else if (type === 'AddHomeCityCard' || type === 'CommandAdd') {
        if (attr('tech')) queue.push(attr('tech'));
        if (attr('proto')) addProto(attr('proto'));
      } else if (type === 'TransformUnit' || type === 'ReplaceUnit') {
        addProto(attr('toprotoid') ?? '');
      } else if (type === 'Data') {
        const sub = attr('subtype');
        if (sub === 'Enable' && parseFloat(attr('amount') ?? '0') > 0) {
          for (const p of inner.matchAll(/<target type="ProtoUnit">([^<]+)<\/target>/g)) addProto(p[1]);
        }
        if (attr('unittype')) addProto(attr('unittype'));
      }
    }
  }
  return new Set([...[...seenTechs].map((t) => `t:${t}`), ...[...seenProtos].map((p) => `p:${p}`)]);
}

const civAccess = CIV_KEYS.map(([id, civName]) => ({ id, keys: reachableKeys(civName) }));
for (const c of civAccess) console.log(`civ ${c.id}: ${c.keys.size} reachable`);

// Hand-picked basics that don't come out cleanly from the data files.
const manual = [
  ['Art/ui/ingame/score_age_1.(0,1,8,1).png', 'Exploration Age', 'age', 'age-1', ['age 1', 'age i']],
  ['Data/wpfg/resources/images/icons/ingame/icon_age_ii.png', 'Commerce Age', 'age', 'age-2', ['age 2', 'age ii', 'age up', 'colonial']],
  ['Data/wpfg/resources/images/icons/ingame/icon_age_iii.png', 'Fortress Age', 'age', 'age-3', ['age 3', 'age iii', 'age up']],
  ['Data/wpfg/resources/images/icons/ingame/icon_age_iv.png', 'Industrial Age', 'age', 'age-4', ['age 4', 'age iv', 'age up']],
  ['Data/wpfg/resources/images/icons/ingame/icon_age_v.png', 'Imperial Age', 'age', 'age-5', ['age 5', 'age v', 'age up']],
  ['Art/ui/command/generate_food_icon.(0,0,4,1).png', 'Food', 'eco', 'food', ['gather food', 'hunt', 'berries', 'farm']],
  ['Art/ui/command/generate_wood_icon.(0,0,4,1).png', 'Wood', 'eco', 'wood', ['gather wood', 'chop', 'trees']],
  ['Art/ui/command/generate_coin_icon.(0,0,4,1).png', 'Coin', 'eco', 'coin', ['gold', 'gather coin', 'mine']],
  ['Art/ui/resource/hc_food_crate/hc_food_crate_64.(0,0,1,5).png', 'Food Crates', 'eco', 'food-crate', ['shipment', 'crates']],
  ['Art/ui/resource/hc_wood_crate/hc_wood_crate_64.(0,0,1,5).png', 'Wood Crates', 'eco', 'wood-crate', ['shipment', 'crates']],
  ['Art/ui/resource/hc_coin_crate/hc_coin_crate_64.(0,0,1,5).png', 'Coin Crates', 'eco', 'coin-crate', ['shipment', 'crates', 'gold']],
];
/** Names players still use for things DE renamed. */
const EXTRA_ALIASES = {
  Estate: ['Plantation'],
  Settler: ['Villager'],
  'Town Center': ['TC'],
  'Trading Post': ['TP'],
};
for (const e of entries) {
  if (EXTRA_ALIASES[e.name]) e.aliases = [...(e.aliases ?? []), ...EXTRA_ALIASES[e.name]];
}

/** @type {Map<string, string>} file -> forced id */
const forcedIds = new Map();
for (const [rel, name, category, id, aliases] of manual) {
  const file = find(rel);
  if (!file) {
    console.warn('missing manual icon', rel);
    continue;
  }
  forcedIds.set(file, id);
  entries.unshift({ file, name, category, aliases });
}

// ---------------------------------------------------------------------------------------------
// Dedupe by image content. One entry per image gives the name/category, the rest become aliases.
// Preference: hand-picked entries, then an entry whose name matches the image's file path
// (so town_center/towncenter_icon.png is "Town Center", not the "Covered Wagon" that reuses it),
// then category priority.

const CATEGORY_PRIORITY = { age: 0, eco: 1, unit: 2, naval: 3, building: 4, card: 5, tech: 6 };
const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const JUNK_ALIAS = /\b(PROP|SPC|SP|Tutorial)\b/;

const hashOf = new Map();
const fileHash = (f) => {
  if (!hashOf.has(f)) hashOf.set(f, createHash('sha1').update(fs.readFileSync(f)).digest('hex'));
  return hashOf.get(f);
};

/** @type {Map<string, typeof entries>} */
const groups = new Map();
for (const e of entries) {
  const h = fileHash(e.file);
  if (!groups.has(h)) groups.set(h, []);
  groups.get(h).push(e);
}

const rank = (e) => [
  forcedIds.has(e.file) ? 0 : 1,
  squash(relToRoot(e.file)).includes(squash(e.name)) ? 0 : 1,
  CATEGORY_PRIORITY[e.category],
];
const cmpRank = (a, b) => {
  const ra = rank(a);
  const rb = rank(b);
  return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
};

/** @type {Map<string, { file: string, name: string, category: string, aliases: Set<string>, forcedId?: string }>} */
const byHash = new Map();
for (const [h, group] of groups) {
  const [primary, ...rest] = [...group].sort(cmpRank);
  const aliases = new Set(primary.aliases ?? []);
  for (const e of rest) {
    if (e.name !== primary.name && !JUNK_ALIAS.test(e.name)) aliases.add(e.name);
    for (const a of e.aliases ?? []) aliases.add(a);
  }
  // Civ bitmask over every game object sharing this image. -1 = usable by everyone; decided by the
  // primary entry only, so a mercenary reusing the Musketeer art doesn't make Musketeers universal.
  const keys = group.map((e) => e.key).filter(Boolean);
  const general = !primary.key || generalKeys.has(primary.key);
  let civMask = 0;
  if (general) civMask = -1;
  else civAccess.forEach((c, bit) => keys.some((k) => c.keys.has(k)) && (civMask |= 1 << bit));
  byHash.set(h, {
    file: primary.file,
    name: primary.name,
    category: primary.category,
    aliases,
    forcedId: forcedIds.get(primary.file),
    civMask,
  });
}

// ---------------------------------------------------------------------------------------------
// Stable ids

const lock = fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) : {};
const slug = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'icon';

// Ids still pointing at an image that exists are taken. Ids whose image disappeared (art changed in
// a game patch) are free again, so the same unit keeps its id when its icon is redrawn.
const usedIds = new Set(Object.entries(lock).filter(([hash]) => byHash.has(hash)).map(([, id]) => id));
const nextLock = { ...lock };

const icons = [];
// Locked images first, then new ones in priority order, so a redrawn primary icon reclaims its id.
const ordered = [...byHash].sort(([ha, a], [hb, b]) => (lock[ha] ? 0 : 1) - (lock[hb] ? 0 : 1) || CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category]);
for (const [hash, e] of ordered) {
  let id = lock[hash] ?? (e.forcedId && !usedIds.has(e.forcedId) ? e.forcedId : undefined);
  if (!id) {
    const base = slug(e.name);
    id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
  }
  usedIds.add(id);
  // Drop stale hashes that pointed at this id, then record the current one.
  for (const [h, v] of Object.entries(nextLock)) if (v === id && h !== hash) delete nextLock[h];
  nextLock[hash] = id;
  icons.push({ id, hash, ...e });
}
icons.sort((a, b) => CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] || a.name.localeCompare(b.name));

// ---------------------------------------------------------------------------------------------
// Emit images

fs.mkdirSync(ICON_OUT, { recursive: true });
fs.mkdirSync(FLAG_OUT, { recursive: true });
for (const f of fs.readdirSync(ICON_OUT)) fs.rmSync(path.join(ICON_OUT, f));

// Read through Node (handles Windows paths over 260 chars, which libvips cannot open by name).
const toWebp = (src, dest, w = SIZE, h = SIZE) =>
  sharp(fs.readFileSync(src)).resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 82 }).toFile(dest);

let failed = 0;
const ok = [];
await Promise.all(
  icons.map(async (icon) => {
    try {
      await toWebp(icon.file, path.join(ICON_OUT, `${icon.id}.webp`));
      ok.push(icon);
    } catch (e) {
      failed++;
      console.warn(`skipped ${icon.id} (${relToRoot(icon.file)}): ${e.message}`);
    }
  })
);
ok.sort((a, b) => CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category] || a.name.localeCompare(b.name));

// Civilization flags: civ id -> flag file stem.
const FLAGS = {
  british: 'British', dutch: 'Dutch', french: 'French', germans: 'German', ottomans: 'Ottoman',
  portuguese: 'Portuguese', russians: 'Russian', spanish: 'Spanish', aztecs: 'Aztec',
  haudenosaunee: 'Iroquois', lakota: 'Sioux', chinese: 'Chinese', indians: 'Indian',
  japanese: 'Japanese', incas: 'Incan', swedes: 'Swedish', americans: 'USA', ethiopians: 'Ethiopian',
  hausa: 'Hausa', mexicans: 'Mexican', italians: 'Italian', maltese: 'Maltese', danes: 'Danes', poles: 'Poles',
};
const flags = [];
for (const [civ, stem] of Object.entries(FLAGS)) {
  const src = find(`Data/wpfg/resources/images/icons/flags/Flag_${stem}.png`);
  if (!src) {
    console.warn('missing flag', civ);
    continue;
  }
  await sharp(fs.readFileSync(src)).resize({ height: 64 }).webp({ quality: 85 }).toFile(path.join(FLAG_OUT, `${civ}.webp`));
  flags.push(civ);
}

// ---------------------------------------------------------------------------------------------
// Emit manifest

const q = (s) => JSON.stringify(s);
const lines = [
  '// AUTO-GENERATED by scripts/build-icons.mjs — do not edit by hand.',
  '// Icon art © Microsoft Corporation. Used under the Microsoft Game Content Usage Rules.',
  "import type { IconCategory, IconDef } from './icon-types';",
  '',
  '// Metadata is a JSON string (one [id, name, category, aliases, civMask] row per icon) because a',
  '// ~2,700-element object literal is too large for the TypeScript checker.',
  `const META: string = ${q(JSON.stringify(ok.map((i) => [i.id, i.name, i.category, [...i.aliases].slice(0, 12), i.civMask])))};`,
  '',
  'const SOURCES: number[] = [',
  ...ok.map((i) => `  require('@/assets/icons/${i.id}.webp'),`),
  '];',
  '',
  'export const ICON_LIST: IconDef[] = (JSON.parse(META) as [string, string, IconCategory, string[], number][]).map(',
  '  ([id, name, category, aliases, civMask], i) => ({ id, name, category, aliases, civMask, source: SOURCES[i] })',
  ');',
  '',
  '/** Bit i of an icon civMask = CIV_BITS[i] can use it. */',
  `export const CIV_BITS: string[] = ${q(CIV_KEYS.map(([id]) => id))};`,
  '',
  'export const CIV_FLAGS: Record<string, number> = {',
  ...flags.map((c) => `  ${q(c)}: require('@/assets/flags/${c}.webp'),`),
  '};',
  '',
  `export const ICON_COUNTS: Partial<Record<IconCategory, number>> = ${JSON.stringify(
    ok.reduce((acc, i) => ((acc[i.category] = (acc[i.category] ?? 0) + 1), acc), {})
  )};`,
  '',
];
fs.writeFileSync(MANIFEST, lines.join('\n'));
fs.writeFileSync(LOCK, JSON.stringify(Object.fromEntries(Object.entries(lock).sort()), null, 0) + '\n');

const counts = ok.reduce((acc, i) => ((acc[i.category] = (acc[i.category] ?? 0) + 1), acc), {});
console.log(`icons: ${ok.length} (failed ${failed})`, counts, `flags: ${flags.length}`);
