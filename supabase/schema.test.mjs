// npm run test:db — runs supabase/schema.sql in PGlite with Supabase-like roles and exercises every API function as `anon`.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create role anon nologin; create role authenticated nologin; create schema extensions;
  grant usage on schema public to anon, authenticated;`);
await db.exec(schema);

let pass = 0;
const ok = (cond, msg) => {
  if (!cond) throw new Error('FAIL: ' + msg);
  pass++;
  console.log('ok -', msg);
};
const asAnon = async (sql, params = []) => {
  await db.exec('set role anon');
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
};
const rpc = async (fn, ...args) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await asAnon(`select public.${fn}(${ph}) as r`, args))[0].r;
};
const fails = async (p, msg) => {
  try {
    await p;
  } catch (e) {
    ok(true, `${msg} (${e.message})`);
    return;
  }
  throw new Error('FAIL: expected error: ' + msg);
};

// Direct table access is blocked.
await fails(asAnon('select * from public.players'), 'anon cannot read players table');
await fails(asAnon("insert into public.builds (author_id,title,civ,steps) values (gen_random_uuid(),'x','y','[]')"), 'anon cannot insert builds');
await fails(asAnon("select private.normalize_key('x')"), 'anon cannot call private helpers');

// Players
const a = await rpc('create_player', 'Miguel');
ok(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/.test(a.key), `key format ${a.key}`);
const b = await rpc('create_player', null);
ok(b.author_name.startsWith('Player '), `anonymous author name: ${b.author_name}`);
const sloppy = a.key.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
ok((await rpc('get_player', sloppy)).player_id === a.player_id, 'key works lowercase, with spaces, O/0 and L/1 mixed up');
await fails(rpc('get_player', 'AAAA-BBBB-CCCC-DDDD-EEEE'), 'unknown key rejected');
const upd = await rpc('update_player', a.key, null, { themeId: 'baltic', stepSound: 'sword' });
ok(upd.display_name === 'Miguel' && upd.prefs.themeId === 'baltic', 'prefs saved, name unchanged with null');
ok((await rpc('update_player', a.key, '', null)).display_name === null, "'' clears display name");
await rpc('update_player', a.key, 'Miguel', null);
await fails(rpc('update_player', a.key, 'x'.repeat(30), null), 'too-long display name rejected');

// Custom keys
const custom = await rpc('create_player', 'Chooser', 'My Fortress Key 2026');
ok(custom.key === 'My Fortress Key 2026', 'custom key is accepted and returned as typed');
ok((await rpc('get_player', 'my-fortress-key-2026')).player_id === custom.player_id, 'custom key works with other case and separators');
await fails(rpc('create_player', null, 'MY FORTRESS KEY 2026'), 'same key (different case) is taken');
await fails(rpc('create_player', null, 'short key'), 'too-short custom key rejected');
await fails(rpc('create_player', null, 'emoji key 🙂🙂🙂🙂🙂🙂'), 'disallowed characters rejected');

// Library sync
const s1 = await rpc('sync_library', a.key, JSON.stringify([
  { id: 'b1', data: { title: 'One' }, updatedAt: 1000, deleted: false },
  { id: 'b2', data: { title: 'Two' }, updatedAt: 1000, deleted: false },
]), null);
ok(s1.items.length === 2, 'first sync pushes and returns 2 builds');
const s2 = await rpc('sync_library', a.key, JSON.stringify([{ id: 'b1', data: { title: 'Old' }, updatedAt: 500 }]), s1.server_time);
ok(s2.items.every((i) => i.id !== 'b1' || i.data.title === 'One'), 'older edit ignored (last edit wins)');
const s3 = await rpc('sync_library', a.key, JSON.stringify([{ id: 'b2', updatedAt: 2000, deleted: true }]), s1.server_time);
ok(s3.items.some((i) => i.id === 'b2' && i.deleted && i.data === null), 'delete syncs as tombstone');
const all = await rpc('sync_library', a.key, '[]', null);
ok(all.items.find((i) => i.id === 'b1').data.title === 'One' && all.items.find((i) => i.id === 'b1').updatedAt === 1000, 'full pull keeps newest data and ms timestamps');
ok((await rpc('sync_library', b.key, '[]', null)).items.length === 0, "other player's library is separate");

// Community
const pub = await rpc('publish_build', a.key, null, 'Fast Fortress', 'british', 'desc', JSON.stringify([{ id: 's', time: 0, icons: [], note: 'go' }]));
ok(pub.author_name === 'Miguel' && pub.upvotes === 0, 'publish returns build with author name');
const pub2 = await rpc('publish_build', a.key, pub.id, 'Fast Fortress v2', 'british', 'desc', '[]');
ok(pub2.title === 'Fast Fortress v2', 'author can update own build');
await fails(rpc('publish_build', b.key, pub.id, 'hijack', 'british', '', '[]'), "cannot update someone else's build");
await rpc('publish_build', b.key, null, 'Japanese rush', 'japanese', '', '[]');
await fails(rpc('set_vote', a.key, pub.id, true), 'cannot vote on own build');
ok((await rpc('set_vote', b.key, pub.id, true)) === 1, 'vote counts 1');
ok((await rpc('set_vote', b.key, pub.id, true)) === 1, 'double vote still 1');
ok((await rpc('my_votes', b.key, `{${pub.id}}`)).includes(pub.id), 'my_votes reports the vote');
const top = await rpc('search_builds', null, null, 'top', 25, 0);
ok(top.length === 2 && top[0].id === pub.id, 'top sort puts upvoted build first');
const newest = await rpc('search_builds', null, null, 'new', 25, 0);
ok(newest[0].title === 'Japanese rush', 'new sort puts newest first');
ok((await rpc('search_builds', 'fortress', null, 'top', 25, 0)).length === 1, 'text search');
ok((await rpc('search_builds', null, 'japanese', 'top', 25, 0)).length === 1, 'civ filter');
ok((await rpc('search_builds', null, null, 'top', 1, 1)).length === 1, 'paging');
ok((await rpc('set_vote', b.key, pub.id, false)) === 0, 'unvote back to 0');
ok((await rpc('get_build', pub.id)).title === 'Fast Fortress v2', 'get_build');
await rpc('unpublish_build', b.key, pub.id);
ok((await rpc('get_build', pub.id)) !== null, "unpublish of someone else's build does nothing");
await rpc('unpublish_build', a.key, pub.id);
ok((await rpc('get_build', pub.id)) === null, 'author can unpublish');
ok((await rpc('ping')) === 'pong', 'ping');

console.log(`\nall ${pass} checks passed`);
