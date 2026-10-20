import { settingsStore } from '@/lib/settings';

import { getTheme } from './themes';

export function useAppTheme() {
  const themeId = settingsStore.useValue((s) => s.themeId);
  return getTheme(themeId);
}

export function useColors() {
  return useAppTheme().colors;
}
