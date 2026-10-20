import { SAMPLE_BUILDS } from '@/data/sample-builds';

import { createPersistedStore } from './store';
import { newId } from './time';
import type { BuildOrder, CommunityBuild } from './types';

export const libraryStore = createPersistedStore<BuildOrder[]>('library.v1', SAMPLE_BUILDS);

/**
 * Bookkeeping for cloud sync: which builds changed locally since the last sync, when deleted
 * builds were deleted (so deletes sync too), and the server time of the last sync.
 */
export type LibrarySyncMeta = { pending: string[]; tombstones: Record<string, number>; lastSync: string | null };
export const librarySyncStore = createPersistedStore<LibrarySyncMeta>('librarySync.v1', {
  pending: [],
  tombstones: {},
  lastSync: null,
});

const markPending = (id: string) =>
  librarySyncStore.set((m) => (m.pending.includes(id) ? m : { ...m, pending: [...m.pending, id] }));

export const useLibrary = () => libraryStore.useValue();

export const useBuild = (id: string | undefined) => libraryStore.useValue((list) => list.find((b) => b.id === id));

export const getBuild = (id: string) => libraryStore.get().find((b) => b.id === id);

export function saveBuild(build: BuildOrder) {
  const stamped = { ...build, updatedAt: Date.now() };
  libraryStore.set((list) =>
    list.some((b) => b.id === build.id) ? list.map((b) => (b.id === build.id ? stamped : b)) : [stamped, ...list]
  );
  markPending(stamped.id);
  return stamped;
}

export function deleteBuild(id: string) {
  libraryStore.set((list) => list.filter((b) => b.id !== id));
  librarySyncStore.set((m) => ({ ...m, tombstones: { ...m.tombstones, [id]: Date.now() } }));
  markPending(id);
}

export function duplicateBuild(id: string) {
  const src = getBuild(id);
  if (!src) return undefined;
  const now = Date.now();
  const copy: BuildOrder = {
    ...src,
    id: newId(),
    title: `${src.title} (copy)`,
    steps: src.steps.map((s) => ({ ...s, id: newId() })),
    createdAt: now,
    updatedAt: now,
    remote: undefined,
  };
  libraryStore.set((list) => [copy, ...list]);
  markPending(copy.id);
  return copy;
}

export const findByRemoteId = (remoteId: string) => libraryStore.get().find((b) => b.remote?.id === remoteId);

/** Copies a community build into the local library (or refreshes an earlier import). */
export function importCommunityBuild(cb: CommunityBuild, myPlayerId: string | undefined) {
  const existing = findByRemoteId(cb.id);
  const now = Date.now();
  const build: BuildOrder = {
    id: existing?.id ?? newId(),
    title: cb.title,
    civ: cb.civ,
    description: cb.description,
    steps: cb.steps.map((s) => ({ ...s, id: s.id || newId() })),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    remote: { id: cb.id, authorId: cb.author_id, authorName: cb.author_name, mine: cb.author_id === myPlayerId },
  };
  return saveBuild(build);
}

export function emptyBuild(): BuildOrder {
  const now = Date.now();
  return {
    id: newId(),
    title: '',
    civ: 'any',
    description: '',
    steps: [{ id: newId(), time: 0, icons: [], note: '' }],
    createdAt: now,
    updatedAt: now,
  };
}
