import type { DlcId } from '@/theme/themes';

export type CivId =
  | 'british'
  | 'dutch'
  | 'french'
  | 'germans'
  | 'ottomans'
  | 'portuguese'
  | 'russians'
  | 'spanish'
  | 'aztecs'
  | 'haudenosaunee'
  | 'lakota'
  | 'chinese'
  | 'indians'
  | 'japanese'
  | 'incas'
  | 'swedes'
  | 'americans'
  | 'ethiopians'
  | 'hausa'
  | 'mexicans'
  | 'italians'
  | 'maltese'
  | 'danes'
  | 'poles'
  | 'any';

export type Civ = {
  id: CivId;
  name: string;
  dlc: DlcId;
  /** Fallback badge colour for civs without a bundled flag. */
  color: string;
};

export const CIVS: Civ[] = [
  { id: 'british', name: 'British', dlc: 'base', color: '#b8262e' },
  { id: 'dutch', name: 'Dutch', dlc: 'base', color: '#e07a1f' },
  { id: 'french', name: 'French', dlc: 'base', color: '#2b4fa8' },
  { id: 'germans', name: 'Germans', dlc: 'base', color: '#3a3a3a' },
  { id: 'ottomans', name: 'Ottomans', dlc: 'base', color: '#a6192e' },
  { id: 'portuguese', name: 'Portuguese', dlc: 'base', color: '#1f6f3f' },
  { id: 'russians', name: 'Russians', dlc: 'base', color: '#2a5cad' },
  { id: 'spanish', name: 'Spanish', dlc: 'base', color: '#d4a017' },
  { id: 'aztecs', name: 'Aztecs', dlc: 'warchiefs', color: '#1e8c7e' },
  { id: 'haudenosaunee', name: 'Haudenosaunee', dlc: 'warchiefs', color: '#5b3b8c' },
  { id: 'lakota', name: 'Lakota', dlc: 'warchiefs', color: '#b5562b' },
  { id: 'chinese', name: 'Chinese', dlc: 'asian-dynasties', color: '#c8102e' },
  { id: 'indians', name: 'Indians', dlc: 'asian-dynasties', color: '#f08a24' },
  { id: 'japanese', name: 'Japanese', dlc: 'asian-dynasties', color: '#bc002d' },
  { id: 'incas', name: 'Inca', dlc: 'definitive', color: '#d9a21b' },
  { id: 'swedes', name: 'Swedes', dlc: 'definitive', color: '#1d5fa8' },
  { id: 'americans', name: 'United States', dlc: 'united-states', color: '#3c3b6e' },
  { id: 'ethiopians', name: 'Ethiopians', dlc: 'african-royals', color: '#078930' },
  { id: 'hausa', name: 'Hausa', dlc: 'african-royals', color: '#c98a1b' },
  { id: 'mexicans', name: 'Mexico', dlc: 'mexico', color: '#006847' },
  { id: 'italians', name: 'Italians', dlc: 'mediterranean', color: '#1f7a3e' },
  { id: 'maltese', name: 'Maltese', dlc: 'mediterranean', color: '#cf142b' },
  { id: 'danes', name: 'Danes', dlc: 'baltic', color: '#c60c30' },
  { id: 'poles', name: 'Poles', dlc: 'baltic', color: '#dc143c' },
];

export const ANY_CIV: Civ = { id: 'any', name: 'Any civ', dlc: 'base', color: '#6b6b6b' };

const byId = new Map<string, Civ>(CIVS.map((c) => [c.id, c]));
export const getCiv = (id: string | null | undefined): Civ => (id && byId.get(id)) || ANY_CIV;
