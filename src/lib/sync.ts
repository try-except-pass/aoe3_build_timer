import { AppState } from 'react-native';

import { accountStore, getAccount } from './account';
import { libraryStore, librarySyncStore } from './library';
import { settingsStore, type Settings } from './settings';
import { rpc } from './supabase';
import type { BuildOrder } from './types';

/**
 * Keeps the build library and preferences in sync with the player's key on the server.
 * Library: per-build "last edit wins", deletes travel as tombstones. Preferences: the server copy
 * wins when a key is entered on a device, after that every local change is pushed.
 */

type RemoteItem = { id: string; data: BuildOrder | null; updatedAt: number; deleted: boolean };

/** Preferences that follow the key between devices (recent icons stay per device). */
const SYNCED_PREFS = ['themeId', 'stepSound', 'warnSeconds', 'haptics'] as const;
type SyncedPrefs = Partial<Pick<Settings, (typeof SYNCED_PREFS)[number]>>;

let status: { syncing: boolean; error: string | null; lastSyncedAt: number | null } = {
  syncing: false,
  error: null,
  lastSyncedAt: null,
};
const statusListeners = new Set<() => void>();
const setStatus = (patch: Partial<typeof status>) => {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
};
export const getSyncStatus = () => status;
export const subscribeSyncStatus = (l: () => void) => {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
};

let applyingRemote = false;
let running: Promise<void> | null = null;
let queued = false;

/** Runs a library sync now (coalesces overlapping calls). */
export function syncNow(): Promise<void> {
  if (running) {
    queued = true;
    return running;
  }
  running = syncLibrary()
    .then(() => setStatus({ error: null, lastSyncedAt: Date.now() }))
    .catch((e) => setStatus({ error: e instanceof Error ? e.message : String(e) }))
    .finally(() => {
      running = null;
      setStatus({ syncing: false });
      if (queued) {
        queued = false;
        syncNow();
      }
    });
  setStatus({ syncing: true });
  return running;
}

async function syncLibrary() {
  const account = getAccount();
  if (!account) return;
  const meta = librarySyncStore.get();
  const local = libraryStore.get();
  // First sync with this key on this device: offer everything we have (server keeps the newest).
  const ids = meta.lastSync ? meta.pending : [...new Set([...local.map((b) => b.id), ...meta.pending])];
  const pushed = new Map<string, number>();
  const changes = ids.slice(0, 500).map((id) => {
    const b = local.find((x) => x.id === id);
    const updatedAt = b ? b.updatedAt : (meta.tombstones[id] ?? Date.now());
    pushed.set(id, updatedAt);
    return b ? { id, data: b, updatedAt, deleted: false } : { id, updatedAt, deleted: true };
  });

  const res = await rpc<{ server_time: string; items: RemoteItem[] }>('sync_library', {
    p_key: account.key,
    p_changes: changes,
    p_since: meta.lastSync,
  });
  if (getAccount()?.key !== account.key) return; // key changed mid-sync

  applyingRemote = true;
  try {
    libraryStore.set((list) => mergeRemote(list, res.items));
  } finally {
    applyingRemote = false;
  }

  const now = libraryStore.get();
  librarySyncStore.set((m) => ({
    lastSync: res.server_time,
    // Keep anything edited again while the request was in flight.
    pending: m.pending.filter((id) => {
      if (!pushed.has(id)) return true;
      const b = now.find((x) => x.id === id);
      const current = b ? b.updatedAt : m.tombstones[id];
      return current !== pushed.get(id);
    }),
    tombstones: Object.fromEntries(Object.entries(m.tombstones).filter(([id]) => !pushed.has(id))),
  }));
}

function mergeRemote(list: BuildOrder[], items: RemoteItem[]): BuildOrder[] {
  let next = list;
  for (const item of items) {
    const local = next.find((b) => b.id === item.id);
    if (item.deleted) {
      if (local && local.updatedAt <= item.updatedAt) next = next.filter((b) => b.id !== item.id);
    } else if (item.data && (!local || item.updatedAt > local.updatedAt)) {
      const incoming = { ...item.data, id: item.id, updatedAt: item.updatedAt };
      next = local ? next.map((b) => (b.id === item.id ? incoming : b)) : [incoming, ...next];
    }
  }
  return next;
}

// --- preferences -------------------------------------------------------------------------------

const pickPrefs = (s: Settings): SyncedPrefs => Object.fromEntries(SYNCED_PREFS.map((k) => [k, s[k]])) as SyncedPrefs;

let applyingPrefs = false;

/** Applies preferences stored with the key (used right after entering a key on a device). */
export function applyRemotePrefs(prefs: Record<string, unknown>) {
  const patch = Object.fromEntries(Object.entries(prefs).filter(([k]) => (SYNCED_PREFS as readonly string[]).includes(k)));
  if (Object.keys(patch).length === 0) {
    pushPrefs(); // nothing saved yet: this device's preferences become the key's
    return;
  }
  applyingPrefs = true;
  try {
    settingsStore.set((s) => ({ ...s, ...patch }));
  } finally {
    applyingPrefs = false;
  }
}

function pushPrefs() {
  const account = getAccount();
  if (!account) return;
  rpc('update_player', { p_key: account.key, p_prefs: pickPrefs(settingsStore.get()) }).catch(() => {});
}

// --- wiring ------------------------------------------------------------------------------------

let started = false;

/** Starts background sync. Call once at app start. */
export function startSync() {
  if (started) return;
  started = true;

  let libTimer: ReturnType<typeof setTimeout> | undefined;
  libraryStore.subscribe(() => {
    if (applyingRemote || !getAccount()) return;
    clearTimeout(libTimer);
    libTimer = setTimeout(syncNow, 1500);
  });

  let prefsTimer: ReturnType<typeof setTimeout> | undefined;
  let lastPrefs = JSON.stringify(pickPrefs(settingsStore.get()));
  settingsStore.subscribe(() => {
    const now = JSON.stringify(pickPrefs(settingsStore.get()));
    if (now === lastPrefs) return;
    lastPrefs = now;
    if (applyingPrefs || !getAccount()) return;
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(pushPrefs, 1500);
  });

  // New key on this device: start from a full sync.
  let lastKey = getAccount()?.key;
  accountStore.subscribe(() => {
    const key = getAccount()?.key;
    if (key === lastKey) return;
    lastKey = key;
    librarySyncStore.set((m) => ({ ...m, lastSync: null }));
    if (key) syncNow();
  });

  AppState.addEventListener('change', (s) => {
    if (s === 'active' && getAccount()) syncNow();
  });
  if (getAccount()) syncNow();
}
