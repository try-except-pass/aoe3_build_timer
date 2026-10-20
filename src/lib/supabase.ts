import { createClient } from '@supabase/supabase-js';

/**
 * Community backend. These are the project's *public* values (the publishable key is meant to be
 * shipped in apps and websites); all data access goes through the key-checked functions in
 * supabase/schema.sql. Override with EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY for another project.
 */
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://sjqzurpfdavedbpzvbwk.supabase.co';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_jdnFjn8T-5skhFkM6sWmjQ_5cVki7ED';

// No Supabase Auth: identity is the player key passed to each function.
const client = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** Calls a database function and returns its result, throwing a readable Error on failure. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(friendlyError(error.message));
  return data as T;
}

function friendlyError(message: string) {
  if (/invalid key/i.test(message)) return 'That key was not found. Check it and try again.';
  if (/fetch|network/i.test(message)) return 'Could not reach the community server. Check your connection.';
  return message;
}
