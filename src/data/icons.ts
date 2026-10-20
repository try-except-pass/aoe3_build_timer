import type { IconCategory, IconDef } from './icon-types';
import { CIV_BITS, CIV_FLAGS, ICON_LIST } from './icons.generated';

const byId = new Map<string, IconDef>(ICON_LIST.map((i) => [i.id, i]));

export const getIcon = (id: string) => byId.get(id);

export const getCivFlag = (civId: string): number | undefined => CIV_FLAGS[civId];

const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const searchIndex = ICON_LIST.map((i) => ({
  icon: i,
  name: normalize(i.name),
  haystack: normalize([i.name, ...i.aliases].join(' ')),
}));

/**
 * Whether a civ can use an icon. Civs without game data (e.g. newer DLC civs) and "any civ"
 * see everything.
 */
export function iconAvailableTo(icon: IconDef, civ: string): boolean {
  const bit = CIV_BITS.indexOf(civ);
  return bit < 0 || icon.civMask === -1 || (icon.civMask & (1 << bit)) !== 0;
}

/** True when the civ has its own icon set (so a "show all civs" toggle makes sense). */
export const hasCivIconData = (civ: string) => CIV_BITS.includes(civ);

/** Name-prefix matches first, then name contains, then alias matches. */
export function searchIcons(query: string, category: IconCategory | 'all', civ = 'any'): IconDef[] {
  const q = normalize(query.trim());
  const pool = searchIndex.filter(
    (e) => (category === 'all' || e.icon.category === category) && iconAvailableTo(e.icon, civ)
  );
  if (!q) return pool.map((e) => e.icon);
  const terms = q.split(/\s+/);
  const scored: { icon: IconDef; score: number }[] = [];
  for (const e of pool) {
    if (!terms.every((t) => e.haystack.includes(t))) continue;
    const score = e.name.startsWith(q) ? 0 : e.name.includes(q) ? 1 : 2;
    scored.push({ icon: e.icon, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.icon);
}
