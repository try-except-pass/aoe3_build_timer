/** Step-alert sounds from the game, imported by scripts/import-sounds.mjs. */
export const STEP_SOUNDS = [
  { id: 'sword', name: 'Sword clank', source: require('@/assets/sounds/sword.wav') as number },
  { id: 'treasure', name: 'Treasure pickup', source: require('@/assets/sounds/treasure.wav') as number },
  { id: 'coin', name: 'Coin', source: require('@/assets/sounds/coin.wav') as number },
  { id: 'arrow', name: 'Arrow', source: require('@/assets/sounds/arrow.wav') as number },
  { id: 'musket', name: 'Musket shot', source: require('@/assets/sounds/musket.wav') as number },
] as const;

export type StepSoundId = (typeof STEP_SOUNDS)[number]['id'] | 'none';

export const DEFAULT_STEP_SOUND: StepSoundId = 'sword';

export const getStepSound = (id: StepSoundId) => STEP_SOUNDS.find((s) => s.id === id);

export const isStepSoundId = (id: unknown): id is StepSoundId =>
  id === 'none' || STEP_SOUNDS.some((s) => s.id === id);
