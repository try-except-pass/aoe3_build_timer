-- AoE3 Build Tracker — backend schema (Supabase / Postgres).
--
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Identity is a personal key ("K7QF-2M9X-HV4D-8TRA-PZ3N") instead of an account. The key itself
-- is never stored, only its SHA-256 hash. Clients get no direct table access: everything goes
-- through the functions at the bottom, which check the key first.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

-- Tables --------------------------------------------------------------------------------------

create table public.players (
  id uuid primary key default gen_random_uuid(),
  key_hash bytea not null unique,
  display_name text check (display_name is null or char_length(display_name) between 2 and 24),
  prefs jsonb not null default '{}'::jsonb check (octet_length(prefs::text) <= 4096),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- A player's personal build library, synced between devices (last edit wins).
create table public.library (
  player_id uuid not null references public.players on delete cascade,
  build_id text not null check (char_length(build_id) between 1 and 64),
  data jsonb check (data is null or octet_length(data::text) <= 200000),
  updated_at timestamptz not null,           -- client edit time, decides which edit wins
  deleted boolean not null default false,    -- tombstone so deletes sync too
  synced_at timestamptz not null default now(), -- server time, used for "changes since"
  primary key (player_id, build_id)
);
create index library_synced_idx on public.library (player_id, synced_at);

-- Community builds.
create table public.builds (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.players on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  civ text not null check (char_length(civ) <= 32),
  description text not null default '' check (char_length(description) <= 2000),
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 300),
  upvotes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index builds_top_idx on public.builds (upvotes desc, created_at desc);
create index builds_new_idx on public.builds (created_at desc);
create index builds_civ_idx on public.builds (civ);

create table public.votes (
  build_id uuid not null references public.builds on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  created_at timestamptz not null default now(),
  primary key (build_id, player_id)
);

-- No policies: with RLS on, the public API cannot read or write these tables directly.
alter table public.players enable row level security;
alter table public.library enable row level security;
alter table public.builds enable row level security;
alter table public.votes enable row level security;
revoke all on public.players, public.library, public.builds, public.votes from anon, authenticated;

-- Helpers (not exposed through the API) ---------------------------------------------------------

-- Crockford base32: case-insensitive, no I/L/O/U; I and L read as 1, O as 0.
create function private.normalize_key(p_key text) returns text
language sql immutable set search_path = '' as $$
  select translate(regexp_replace(upper(coalesce(p_key, '')), '[^0-9A-Z]', '', 'g'), 'ILO', '110');
$$;

create function private.key_hash(p_key text) returns bytea
language sql immutable set search_path = '' as $$
  select extensions.digest(private.normalize_key(p_key), 'sha256');
$$;

-- Resolves a key to a player id, or raises "invalid key".
create function private.player_id(p_key text) returns uuid
language plpgsql set search_path = '' as $$
declare
  pid uuid;
begin
  update public.players set last_seen_at = now()
    where key_hash = private.key_hash(p_key)
    returning id into pid;
  if pid is null then
    raise exception 'invalid key' using errcode = 'P0001';
  end if;
  return pid;
end $$;

create function private.author_name(p public.players) returns text
language sql immutable set search_path = '' as $$
  select coalesce(p.display_name, 'Player ' || upper(left(replace(p.id::text, '-', ''), 4)));
$$;

create function private.build_json(b public.builds, p public.players) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', b.id, 'author_id', b.author_id, 'author_name', private.author_name(p),
    'title', b.title, 'civ', b.civ, 'description', b.description, 'steps', b.steps,
    'upvotes', b.upvotes, 'created_at', b.created_at, 'updated_at', b.updated_at);
$$;

-- API: players ----------------------------------------------------------------------------------

-- Creates a player and returns its key. This is the only time the key is ever returned.
create function public.create_player(p_display_name text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea := extensions.gen_random_bytes(20);
  raw text := '';
  k text;
  p public.players;
begin
  for i in 0..19 loop
    raw := raw || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);  -- 256 % 32 = 0: unbiased
  end loop;
  k := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4) || '-' || substr(raw, 13, 4) || '-' || substr(raw, 17, 4);
  insert into public.players (key_hash, display_name)
    values (private.key_hash(k), nullif(trim(p_display_name), ''))
    returning * into p;
  return jsonb_build_object('key', k, 'player_id', p.id, 'display_name', p.display_name, 'author_name', private.author_name(p));
end $$;

create function public.get_player(p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := private.player_id(p_key);
  p public.players;
begin
  select * into p from public.players where id = pid;
  return jsonb_build_object('player_id', p.id, 'display_name', p.display_name, 'author_name', private.author_name(p), 'prefs', p.prefs);
end $$;

-- null = leave unchanged; '' clears the display name.
create function public.update_player(p_key text, p_display_name text default null, p_prefs jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := private.player_id(p_key);
  p public.players;
begin
  update public.players set
      display_name = case when p_display_name is null then display_name else nullif(trim(p_display_name), '') end,
      prefs = coalesce(p_prefs, prefs)
    where id = pid
    returning * into p;
  return jsonb_build_object('player_id', p.id, 'display_name', p.display_name, 'author_name', private.author_name(p), 'prefs', p.prefs);
end $$;

-- API: library sync -------------------------------------------------------------------------------

-- Pushes local changes ([{ id, data, updatedAt (ms), deleted }]) and returns everything that
-- changed on the server since p_since (server time from the previous sync, null = everything).
create function public.sync_library(p_key text, p_changes jsonb, p_since timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := private.player_id(p_key);
  started timestamptz := clock_timestamp();
  c jsonb;
begin
  if jsonb_array_length(coalesce(p_changes, '[]')) > 500 then
    raise exception 'too many changes in one sync' using errcode = 'P0001';
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_changes, '[]')) loop
    insert into public.library as l (player_id, build_id, data, updated_at, deleted, synced_at)
    values (
      pid,
      c ->> 'id',
      case when (c ->> 'deleted')::boolean then null else c -> 'data' end,
      to_timestamp((c ->> 'updatedAt')::double precision / 1000),
      coalesce((c ->> 'deleted')::boolean, false),
      clock_timestamp())
    on conflict (player_id, build_id) do update
      set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, synced_at = excluded.synced_at
      where excluded.updated_at > l.updated_at;  -- last edit wins
  end loop;
  if (select count(*) from public.library where player_id = pid and not deleted) > 1000 then
    raise exception 'library is full (1000 builds)' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'server_time', started,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', build_id, 'data', data, 'updatedAt', (extract(epoch from updated_at) * 1000)::bigint, 'deleted', deleted))
      from public.library
      where player_id = pid and (p_since is null or synced_at > p_since)
    ), '[]'::jsonb));
end $$;

-- API: community --------------------------------------------------------------------------------

create function public.search_builds(
  p_query text default null, p_civ text default null, p_sort text default 'top',
  p_limit integer default 25, p_offset integer default 0
) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(j order by ord), '[]'::jsonb)
  from (
    select private.build_json(b, p) as j,
      row_number() over (order by
        case when p_sort = 'new' then null else b.upvotes end desc nulls last,
        b.created_at desc) as ord
    from public.builds b join public.players p on p.id = b.author_id
    where (p_civ is null or b.civ = p_civ)
      and (coalesce(trim(p_query), '') = ''
        or b.title ilike '%' || trim(p_query) || '%'
        or b.description ilike '%' || trim(p_query) || '%')
    order by ord
    limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
  ) s;
$$;

create function public.get_build(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.build_json(b, p) from public.builds b join public.players p on p.id = b.author_id where b.id = p_id;
$$;

-- Creates (p_id null) or updates (own build) a community build.
create function public.publish_build(p_key text, p_id uuid, p_title text, p_civ text, p_description text, p_steps jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := private.player_id(p_key);
  b public.builds;
  p public.players;
begin
  if p_id is null then
    insert into public.builds (author_id, title, civ, description, steps)
      values (pid, coalesce(nullif(trim(p_title), ''), 'Untitled build'), p_civ, coalesce(p_description, ''), p_steps)
      returning * into b;
  else
    update public.builds
      set title = coalesce(nullif(trim(p_title), ''), 'Untitled build'), civ = p_civ,
          description = coalesce(p_description, ''), steps = p_steps, updated_at = now()
      where id = p_id and author_id = pid
      returning * into b;
    if b.id is null then
      raise exception 'build not found or not yours' using errcode = 'P0001';
    end if;
  end if;
  select * into p from public.players where id = pid;
  return private.build_json(b, p);
end $$;

create function public.unpublish_build(p_key text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := private.player_id(p_key);
begin
  delete from public.builds where id = p_id and author_id = pid;
end $$;

-- Sets or removes this player's upvote; returns the build's new vote count.
create function public.set_vote(p_key text, p_build_id uuid, p_vote boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := private.player_id(p_key);
  n integer;
begin
  if exists (select 1 from public.builds where id = p_build_id and author_id = pid) then
    raise exception 'you cannot vote on your own build' using errcode = 'P0001';
  end if;
  if p_vote then
    insert into public.votes (build_id, player_id) values (p_build_id, pid) on conflict do nothing;
    get diagnostics n = row_count;
    update public.builds set upvotes = upvotes + n where id = p_build_id;
  else
    delete from public.votes where build_id = p_build_id and player_id = pid;
    get diagnostics n = row_count;
    update public.builds set upvotes = greatest(upvotes - n, 0) where id = p_build_id;
  end if;
  return (select upvotes from public.builds where id = p_build_id);
end $$;

create function public.my_votes(p_key text, p_build_ids uuid[]) returns uuid[]
language sql security definer set search_path = '' as $$
  select coalesce(array_agg(build_id), '{}') from public.votes
  where player_id = (select private.player_id(p_key)) and build_id = any (p_build_ids);  -- once, not per row
$$;

-- Lightweight call for the keep-alive workflow (free projects pause after a week idle).
create function public.ping() returns text
language sql stable security definer set search_path = '' as $$ select 'pong'; $$;

-- Only the API functions are callable from the app.
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function
  public.create_player(text), public.get_player(text), public.update_player(text, text, jsonb),
  public.sync_library(text, jsonb, timestamptz), public.search_builds(text, text, text, integer, integer),
  public.get_build(uuid), public.publish_build(text, uuid, text, text, text, jsonb),
  public.unpublish_build(text, uuid), public.set_vote(text, uuid, boolean), public.my_votes(text, uuid[]),
  public.ping()
from public;
grant execute on function
  public.create_player(text), public.get_player(text), public.update_player(text, text, jsonb),
  public.sync_library(text, jsonb, timestamptz), public.search_builds(text, text, text, integer, integer),
  public.get_build(uuid), public.publish_build(text, uuid, text, text, text, jsonb),
  public.unpublish_build(text, uuid), public.set_vote(text, uuid, boolean), public.my_votes(text, uuid[]),
  public.ping()
to anon, authenticated;
