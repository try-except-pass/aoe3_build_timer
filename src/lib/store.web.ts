import { useSyncExternalStore } from 'react';

/**
 * Web version of store.ts: same API, persisted in the browser's localStorage (expo-sqlite's
 * key-value store needs cross-origin isolation headers, which GitHub Pages can't send).
 */
export function createPersistedStore<T>(key: string, initial: T, migrate?: (raw: any) => T) {
  let state = initial;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw != null) state = migrate ? migrate(JSON.parse(raw)) : JSON.parse(raw);
  } catch (e) {
    console.warn(`Failed to load ${key}`, e);
  }

  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };

  const set = (next: T | ((prev: T) => T)) => {
    state = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
    listeners.forEach((l) => l());
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn(`Failed to save ${key}`, e);
    }
  };

  const get = () => state;

  /** Selector must return a stable reference (a slice of state, not a new object). */
  function useValue(): T;
  function useValue<S>(selector: (s: T) => S): S;
  function useValue<S>(selector?: (s: T) => S) {
    return useSyncExternalStore(subscribe, () => (selector ? selector(state) : state));
  }

  return { get, set, useValue, subscribe };
}
