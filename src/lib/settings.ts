import { DEFAULT_STEP_SOUND, isStepSoundId, type StepSoundId } from '@/data/sounds';
import { DEFAULT_THEME_ID, type DlcId } from '@/theme/themes';

import { createPersistedStore } from './store';

export type Settings = {
  themeId: DlcId;
  haptics: boolean;
  /** Played when the player reaches a new step. */
  stepSound: StepSoundId;
  /** Seconds before a step is due when the player starts flagging it as "up next". */
  warnSeconds: number;
  recentIcons: string[];
};

const DEFAULTS: Settings = {
  themeId: DEFAULT_THEME_ID,
  haptics: true,
  stepSound: DEFAULT_STEP_SOUND,
  warnSeconds: 10,
  recentIcons: [],
};

export const settingsStore = createPersistedStore<Settings>('settings.v1', DEFAULTS, (raw) => ({
  ...DEFAULTS,
  ...raw,
  // Sounds get replaced over time; fall back to the default if the saved one is gone.
  stepSound: isStepSoundId(raw?.stepSound) ? raw.stepSound : DEFAULT_STEP_SOUND,
}));

export const updateSettings = (patch: Partial<Settings>) => settingsStore.set((s) => ({ ...s, ...patch }));

export const rememberIcon = (id: string) =>
  settingsStore.set((s) => ({ ...s, recentIcons: [id, ...s.recentIcons.filter((r) => r !== id)].slice(0, 20) }));
