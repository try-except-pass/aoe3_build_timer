import type { CivId } from '@/constants/civs';

import { getAccount } from './account';
import { saveBuild } from './library';
import { rpc } from './supabase';
import type { BuildOrder, CommunityBuild } from './types';

export type SortMode = 'top' | 'new';

const PAGE_SIZE = 25;

function requireKey() {
  const account = getAccount();
  if (!account) throw new Error('Set up your player key first (Settings → Player key).');
  return account;
}

/** Adds `voted` flags for the current player. */
async function withVotes(builds: CommunityBuild[]): Promise<CommunityBuild[]> {
  const account = getAccount();
  if (!account || builds.length === 0) return builds;
  const voted = new Set(await rpc<string[]>('my_votes', { p_key: account.key, p_build_ids: builds.map((b) => b.id) }));
  return builds.map((b) => ({ ...b, voted: voted.has(b.id) }));
}

export async function searchBuilds(opts: { query?: string; civ?: CivId | null; sort: SortMode; page?: number }) {
  const page = opts.page ?? 0;
  const rows = await rpc<CommunityBuild[]>('search_builds', {
    p_query: opts.query?.trim() || null,
    p_civ: opts.civ ?? null,
    p_sort: opts.sort,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  });
  return { builds: await withVotes(rows), hasMore: rows.length === PAGE_SIZE };
}

export async function fetchCommunityBuild(id: string) {
  const row = await rpc<CommunityBuild | null>('get_build', { p_id: id });
  if (!row) throw new Error('This build was removed by its author.');
  const [build] = await withVotes([row]);
  return build;
}

/** Sets or removes the player's upvote; returns the new vote count. */
export async function setVote(buildId: string, vote: boolean) {
  const { key } = requireKey();
  return rpc<number>('set_vote', { p_key: key, p_build_id: buildId, p_vote: vote });
}

/** Publishes a library build, or pushes changes if this player already published it. */
export async function publishBuild(build: BuildOrder) {
  const account = requireKey();
  const isUpdate = build.remote && build.remote.authorId === account.playerId;
  const cb = await rpc<CommunityBuild>('publish_build', {
    p_key: account.key,
    p_id: isUpdate ? build.remote!.id : null,
    p_title: build.title,
    p_civ: build.civ,
    p_description: build.description,
    p_steps: build.steps,
  });
  saveBuild({ ...build, remote: { id: cb.id, authorId: cb.author_id, authorName: cb.author_name, mine: true } });
  return cb;
}

export async function unpublishBuild(build: BuildOrder) {
  if (!build.remote?.mine) return;
  const { key } = requireKey();
  await rpc('unpublish_build', { p_key: key, p_id: build.remote.id });
  saveBuild({ ...build, remote: undefined });
}
