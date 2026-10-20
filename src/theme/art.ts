import type { DlcId } from './themes';

/** Header and thumbnail artwork per theme, extracted by scripts/build-theme-art.mjs. */
export const THEME_ART: Record<DlcId, { header: number; thumb: number }> = {
  base: { header: require('@/assets/themes/base.webp'), thumb: require('@/assets/themes/base-thumb.webp') },
  warchiefs: { header: require('@/assets/themes/warchiefs.webp'), thumb: require('@/assets/themes/warchiefs-thumb.webp') },
  'asian-dynasties': {
    header: require('@/assets/themes/asian-dynasties.webp'),
    thumb: require('@/assets/themes/asian-dynasties-thumb.webp'),
  },
  definitive: { header: require('@/assets/themes/definitive.webp'), thumb: require('@/assets/themes/definitive-thumb.webp') },
  'united-states': {
    header: require('@/assets/themes/united-states.webp'),
    thumb: require('@/assets/themes/united-states-thumb.webp'),
  },
  'african-royals': {
    header: require('@/assets/themes/african-royals.webp'),
    thumb: require('@/assets/themes/african-royals-thumb.webp'),
  },
  mexico: { header: require('@/assets/themes/mexico.webp'), thumb: require('@/assets/themes/mexico-thumb.webp') },
  mediterranean: {
    header: require('@/assets/themes/mediterranean.webp'),
    thumb: require('@/assets/themes/mediterranean-thumb.webp'),
  },
  baltic: { header: require('@/assets/themes/baltic.webp'), thumb: require('@/assets/themes/baltic-thumb.webp') },
};
