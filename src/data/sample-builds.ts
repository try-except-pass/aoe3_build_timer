import type { BuildOrder } from '@/lib/types';

/** Seeded into the library on first launch so the player has something to try. */
export const SAMPLE_BUILDS: BuildOrder[] = [
  {
    id: 'sample-british-commerce',
    title: 'Sample: British fast Commerce Age',
    civ: 'british',
    description:
      'A simple example to show how the app works. Press Start build when the match starts — the list scrolls itself as the timer reaches each step. Edit or delete it any time.',
    createdAt: 0,
    updatedAt: 0,
    steps: [
      { id: 's1', time: 0, icons: ['settler', 'food'], note: 'Settlers on berries / hunt. Queue Settlers non-stop from the Town Center.' },
      { id: 's2', time: 0, icons: ['explorer'], note: 'Explorer: grab nearby treasures and scout for hunts.' },
      { id: 's3', time: 20, icons: ['2-settlers'], note: 'First shipment: Settlers, as soon as you have the XP.' },
      { id: 's4', time: 40, icons: ['house', 'wood'], note: 'Move 2 Settlers to wood and build a Manor House.' },
      { id: 's5', time: 70, icons: ['house'], note: 'Second Manor House — each one gives a free Settler.' },
      { id: 's6', time: 90, icons: ['cords-of-300-wood'], note: 'Second shipment: wood crates for more Manors.' },
      { id: 's7', time: null, icons: ['food'], note: 'Everyone else stays on food — you need 800 food to age up.' },
      { id: 's8', time: 130, icons: ['age-2'], note: 'Click Commerce Age. Pick the politician that ships Settlers.' },
      { id: 's9', time: 135, icons: ['wood'], note: 'While aging: 5 Settlers to wood for the Barracks.' },
      { id: 's10', time: 165, icons: ['coin'], note: '4 Settlers to coin.' },
      { id: 's11', time: 180, icons: ['barracks'], note: 'Build a Barracks the moment you reach Commerce Age.' },
      { id: 's12', time: 195, icons: ['musketeer', 'skirmisher'], note: 'Start Musketeers and send your first military card.' },
      { id: 's13', time: 240, icons: ['market'], note: 'Market: research the first economy upgrades.' },
    ],
  },
];
