import { createPersistedStore } from './store';
import { rpc } from './supabase';

/**
 * The player key replaces accounts: it identifies the player for votes, published builds, the
 * synced library and synced preferences. It is stored only on this device.
 */
export type Account = {
  key: string;
  playerId: string;
  displayName: string | null;
  /** Name shown on published builds (display name, or "Player XXXX"). */
  authorName: string;
};

type PlayerRow = {
  player_id: string;
  display_name: string | null;
  author_name: string;
  prefs?: Record<string, unknown>;
};

export const accountStore = createPersistedStore<Account | null>('account.v1', null);

export const useAccount = () => accountStore.useValue();
export const getAccount = () => accountStore.get();

const toAccount = (key: string, p: PlayerRow): Account => ({
  key,
  playerId: p.player_id,
  displayName: p.display_name,
  authorName: p.author_name,
});

/**
 * Creates a new player. `customKey` empty = the server generates a random key.
 * Returns the account; the key is only ever shown at this point.
 */
export async function createKey(displayName: string, customKey = '') {
  const p = await rpc<PlayerRow & { key: string }>('create_player', {
    p_display_name: displayName.trim() || null,
    // Only sent when chosen, so random keys also work on databases without migration 002.
    ...(customKey.trim() ? { p_key: customKey.trim() } : {}),
  });
  const account = toAccount(p.key, p);
  accountStore.set(account);
  return account;
}

/** Signs this device in with an existing key. Returns the server-side preferences. */
export async function signInWithKey(key: string) {
  const p = await rpc<PlayerRow>('get_player', { p_key: key.trim() });
  accountStore.set(toAccount(key.trim(), p));
  return p.prefs ?? {};
}

export async function setDisplayName(name: string) {
  const account = getAccount();
  if (!account) return;
  const p = await rpc<PlayerRow>('update_player', { p_key: account.key, p_display_name: name.trim() });
  accountStore.set(toAccount(account.key, p));
}

export function forgetKey() {
  accountStore.set(null);
}

/** Letters and digits that count towards a key (same normalisation as the server). */
export const normalizeKey = (key: string) =>
  key
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');

export const MIN_KEY_LENGTH = 12;
export const KEY_CHARS = /^[A-Za-z0-9 ._-]*$/;

/** For display: everything except the last 4 characters hidden. */
export const maskKey = (key: string) => key.slice(0, -4).replace(/[^ -]/g, '•') + key.slice(-4);
