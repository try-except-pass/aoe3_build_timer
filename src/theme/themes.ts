/**
 * One theme per Age of Empires III release. All themes are dark: the phone sits next to a
 * monitor during a match, so a bright screen would be distracting.
 */

export type DlcId =
  | 'base'
  | 'warchiefs'
  | 'asian-dynasties'
  | 'definitive'
  | 'united-states'
  | 'african-royals'
  | 'mexico'
  | 'mediterranean'
  | 'baltic';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  danger: string;
  /** Background of the step that is active right now in the player. */
  current: string;
};

export type AppTheme = {
  id: DlcId;
  /** DLC / expansion name as shown in the store. */
  name: string;
  year: number;
  tagline: string;
  /** Civ whose flag is used as the theme emblem (falls back to a monogram). */
  emblemCiv: string;
  colors: ThemeColors;
};

export const THEMES: AppTheme[] = [
  {
    id: 'base',
    name: 'Age of Empires III',
    year: 2005,
    tagline: 'The European powers set sail for the New World.',
    emblemCiv: 'british',
    colors: {
      background: '#0f1420',
      surface: '#171f31',
      surfaceAlt: '#1f2940',
      border: '#2e3a58',
      text: '#f1e9d2',
      textMuted: '#a9a28d',
      primary: '#d4a640',
      onPrimary: '#1a1405',
      accent: '#7c9be0',
      danger: '#e0574f',
      current: '#2b3352',
    },
  },
  {
    id: 'warchiefs',
    name: 'The WarChiefs',
    year: 2006,
    tagline: 'Aztecs, Haudenosaunee and Lakota take the field.',
    emblemCiv: 'lakota',
    colors: {
      background: '#1a120d',
      surface: '#251912',
      surfaceAlt: '#31221a',
      border: '#4a3426',
      text: '#f3e6d3',
      textMuted: '#b8a48c',
      primary: '#d0603f',
      onPrimary: '#fff4ea',
      accent: '#3fb5a8',
      danger: '#ff6b5b',
      current: '#3d2a20',
    },
  },
  {
    id: 'asian-dynasties',
    name: 'The Asian Dynasties',
    year: 2007,
    tagline: 'Chinese, Indians and Japanese — wonders over age-ups.',
    emblemCiv: 'japanese',
    colors: {
      background: '#120d0d',
      surface: '#1d1515',
      surfaceAlt: '#281d1c',
      border: '#3d2b29',
      text: '#f5ece0',
      textMuted: '#b3a597',
      primary: '#d94a36',
      onPrimary: '#fff8f2',
      accent: '#56b48c',
      danger: '#ff7a66',
      current: '#3a2220',
    },
  },
  {
    id: 'definitive',
    name: 'Definitive Edition',
    year: 2020,
    tagline: 'Inca and Swedes join the remastered classic.',
    emblemCiv: 'swedes',
    colors: {
      background: '#0b1118',
      surface: '#111b26',
      surfaceAlt: '#182534',
      border: '#263a50',
      text: '#eef3f8',
      textMuted: '#93a4b6',
      primary: '#f0b43c',
      onPrimary: '#1b1305',
      accent: '#4aa3df',
      danger: '#ef5b5b',
      current: '#1e3247',
    },
  },
  {
    id: 'united-states',
    name: 'United States Civilization',
    year: 2021,
    tagline: 'Federal states, Gatling guns and the Continental Army.',
    emblemCiv: 'americans',
    colors: {
      background: '#0b1226',
      surface: '#121b35',
      surfaceAlt: '#1a2546',
      border: '#2b3962',
      text: '#f4f6fb',
      textMuted: '#a3abc6',
      primary: '#d03a46',
      onPrimary: '#ffffff',
      accent: '#6b98f2',
      danger: '#ff6b75',
      current: '#23305a',
    },
  },
  {
    id: 'african-royals',
    name: 'The African Royals',
    year: 2021,
    tagline: 'Ethiopians and Hausa — influence, alliances and livestock.',
    emblemCiv: 'ethiopians',
    colors: {
      background: '#17110a',
      surface: '#22190f',
      surfaceAlt: '#2e2214',
      border: '#4d3820',
      text: '#f6ead2',
      textMuted: '#c2ac87',
      primary: '#e0a326',
      onPrimary: '#1c1303',
      accent: '#46a862',
      danger: '#e8604a',
      current: '#3b2c17',
    },
  },
  {
    id: 'mexico',
    name: 'Mexico Civilization',
    year: 2021,
    tagline: 'Haciendas, Insurgentes and a revolution of your own.',
    emblemCiv: 'mexicans',
    colors: {
      background: '#0d1712',
      surface: '#13211a',
      surfaceAlt: '#1a2d22',
      border: '#2a4535',
      text: '#f1f5ef',
      textMuted: '#a1b5a7',
      primary: '#2ea862',
      onPrimary: '#ffffff',
      accent: '#e0524a',
      danger: '#ff6a5f',
      current: '#1f3a2b',
    },
  },
  {
    id: 'mediterranean',
    name: 'Knights of the Mediterranean',
    year: 2022,
    tagline: 'Italians and the Order of St. John hold the sea lanes.',
    emblemCiv: 'maltese',
    colors: {
      background: '#0a1520',
      surface: '#0f1f2f',
      surfaceAlt: '#16293d',
      border: '#24405c',
      text: '#f2f6fa',
      textMuted: '#9eb2c6',
      primary: '#d0323a',
      onPrimary: '#ffffff',
      accent: '#46b0d3',
      danger: '#ff6a6f',
      current: '#1b3450',
    },
  },
  {
    id: 'baltic',
    name: 'The Baltic Powers',
    year: 2026,
    tagline: 'Danes and Poles contest the northern seas.',
    emblemCiv: 'poles',
    colors: {
      background: '#0e1317',
      surface: '#151c22',
      surfaceAlt: '#1c252d',
      border: '#2c3a46',
      text: '#eef2f4',
      textMuted: '#9aa8b3',
      primary: '#e7a23a',
      onPrimary: '#1a1104',
      accent: '#d04a55',
      danger: '#ff6a70',
      current: '#283541',
    },
  },
];

export const DEFAULT_THEME_ID: DlcId = 'definitive';

export const getTheme = (id: string | null | undefined): AppTheme =>
  THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
