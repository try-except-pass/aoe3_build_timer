export type IconCategory = 'age' | 'eco' | 'unit' | 'naval' | 'building' | 'card' | 'tech';

export type IconDef = {
  id: string;
  name: string;
  category: IconCategory;
  /** Other in-game names that share this exact image; used for search. */
  aliases: string[];
  /** Bit i set = civ CIV_BITS[i] can use it; -1 = every civ (mercenaries, natives, basics). */
  civMask: number;
  /** Metro asset id from require(). */
  source: number;
};

export const ICON_CATEGORY_LABELS: Record<IconCategory, string> = {
  age: 'Ages',
  eco: 'Economy',
  unit: 'Units',
  naval: 'Naval',
  building: 'Buildings',
  card: 'Cards',
  tech: 'Techs',
};
