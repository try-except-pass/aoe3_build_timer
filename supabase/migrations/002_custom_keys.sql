-- Migration 002 (2026-10-21): players can choose their own key.
-- Run in the Supabase SQL Editor on a database created from an earlier schema.sql.

drop function if exists public.create_player(text);

-- Creates a player and returns its key. The player can choose the key (at least 12 letters or
-- numbers; spaces, - _ . allowed and ignored when matching) or leave it empty to get a random one.
-- This is the only time the key is ever returned.
create function public.create_player(p_display_name text default null, p_key text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea;
  raw text := '';
  k text := trim(coalesce(p_key, ''));
  p public.players;
begin
  if k <> '' then
    if k !~ '^[A-Za-z0-9 ._-]+$' then
      raise exception 'Keys can only use letters, numbers, spaces, - _ and .' using errcode = 'P0001';
    end if;
    if char_length(k) > 64 then
      raise exception 'Keys can be at most 64 characters' using errcode = 'P0001';
    end if;
    if char_length(private.normalize_key(k)) < 12 then
      raise exception 'Choose a key with at least 12 letters or numbers' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.players where key_hash = private.key_hash(k)) then
      raise exception 'That key is already taken. Choose another one.' using errcode = 'P0001';
    end if;
  else
    bytes := extensions.gen_random_bytes(20);
    for i in 0..19 loop
      raw := raw || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);  -- 256 % 32 = 0: unbiased
    end loop;
    k := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4) || '-' || substr(raw, 13, 4) || '-' || substr(raw, 17, 4);
  end if;
  insert into public.players (key_hash, display_name)
    values (private.key_hash(k), nullif(trim(p_display_name), ''))
    returning * into p;
  return jsonb_build_object('key', k, 'player_id', p.id, 'display_name', p.display_name, 'author_name', private.author_name(p));
end $$;

revoke all on function public.create_player(text, text) from public;
grant execute on function public.create_player(text, text) to anon, authenticated;
