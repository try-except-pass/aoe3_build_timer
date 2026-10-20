# AoE3 Build Tracker

A phone companion for **Age of Empires III: Definitive Edition**. Keep it next to your keyboard, press **Start build** when the match starts, and it walks you through your build order in time with the game.

Built with Expo (React Native), so it runs on both iPhone and Android.

## Features

- **Build library**: create, edit, duplicate and delete timed build orders. Each step has a time, up to four game icons on the left, and notes on the right.
- **Build player**: a match timer that highlights the current step and scrolls the list on its own so the steps coming up are always on screen. It also:
  - flags the next step with a countdown and a progress bar, and vibrates when a step starts;
  - has −10s / +10s nudges and "long-press a step to set the timer to it" to line up with the in-game clock;
  - stops following if you scroll by hand, then picks up again after 8 s or when you tap **Follow**;
  - keeps the screen awake (for the whole app or only while following a build; see Settings).
- **Community**: publish your builds, search other players' builds (by text, civ, Top / New), upvote them and add them to your library.
- **Player key instead of an account**: one code syncs your library and preferences between your phone and the website.
- **Website**: the same app in the browser, on GitHub Pages.
- **2,690 in-game icons** (units, buildings, Home City cards, techs, ages, resources), searchable by in-game English name.
- **A theme for every release**: Age of Empires III, The WarChiefs, The Asian Dynasties, Definitive Edition, United States, The African Royals, Mexico, Knights of the Mediterranean, The Baltic Powers.

## Running it

Requirements: **Node.js 22.13 or newer**. The project uses Expo SDK 57, which is the version the App Store / Play Store Expo Go supports.

```bash
npm install
npx expo login   # once; use the same account in the Expo Go app
npm start
```

`npm start` runs the dev server behind a Cloudflare tunnel ([scripts/start-tunnel.mjs](scripts/start-tunnel.mjs)), so the phone can load the app from any network. On Windows it downloads `cloudflared` into `.tools/` the first time; on macOS run `brew install cloudflared`. Scan the QR code with **Expo Go** ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)), signed in to the same Expo account as the CLI. The tunnel address changes on every run.

`npm run start:lan` starts without the tunnel (the phone must be on the same Wi-Fi and able to reach the PC).

Other commands: `npm run typecheck`, `npm run lint`, `npx expo-doctor`.

## Player key and community backend

There are no accounts. Each player creates a **player key** (Settings → Player key): a random code like `K7QF-2M9X-HV4D-8TRA-PZ3N`, or one they choose (at least 12 letters or numbers; spaces, `-` `_` `.` allowed; case-insensitive). The key:

- syncs the build library between devices and the website automatically;
- stores preferences (theme, step sound, warning time, vibration): saved with the **Save** button in Settings, loaded whenever the app or website opens;
- is the identity for publishing and upvoting community builds (one vote per key per build);
- is never stored on the server, only its SHA-256 hash. There is no recovery, so players are told to save it.

The backend is a free [Supabase](https://supabase.com) project. Setup (once):

1. In the Supabase dashboard open **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
2. Then run each file in [`supabase/migrations/`](supabase/migrations) that came after you first ran the schema (a fresh `schema.sql` already includes them).
3. That is it: the app ships with the project's public URL and publishable key ([`src/lib/supabase.ts`](src/lib/supabase.ts)). To use another project, set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`.

Clients have no direct table access; everything goes through key-checked database functions. `npm run test:db` runs the schema and its security checks in a local Postgres (PGlite).

The [keep-alive workflow](.github/workflows/keep-supabase-awake.yml) pings the project twice a week, because free projects pause after a week without traffic.

## Website

The same code runs as a website (Expo web export), published to GitHub Pages by [`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml) on every push to `main`: <https://try-except-pass.github.io/aoe3_build_timer/>

One-time setup: repo **Settings → Pages → Source: GitHub Actions**. To try it locally: `npx expo start --web`.

Web differences: storage uses the browser's localStorage, the tab bar is a regular web tab bar, dialogs use the browser's, and there is no vibration.

## Game assets

Everything below is generated and committed, so you only need to re-run it after a game update.

**Icons** (`assets/icons`, `assets/flags`, `src/data/icons.generated.ts`). Extract the current game data from an installed copy of AoE3 DE, then build the icon pack. The [AoE3DEDatabase](https://github.com/rainsillwood/AoE3DEDatabase) dump (sparse checkout) is a second source for a few hand-picked images:

```bash
node scripts/extract-game-data.mjs "C:\XboxGames\Age of Empires III- Definitive Edition\Content" ../aoe3-data
npm run icons -- ../aoe3-data ../AoE3DEDatabase
```

The script names icons from the English string table and works out **which civs can use each icon** by following the game's tech tree from every civ's age-ups, Home City deck and starting units (units enabled, techs unlocked, cards added, revolutions). Mercenaries, outlaws, natives and native-settlement techs are available to every civ. The icon picker uses this to show only the build's civ (with an "All civs" toggle).

Icon ids are saved inside build orders, so `src/data/icon-ids.lock.json` keeps them stable between runs (a redrawn icon keeps its id). Commit it.

**Theme artwork** (`assets/themes`): `node scripts/build-theme-art.mjs "<install>\Content"` extracts the DLC key art and campaign art.

**Step sounds** (`assets/sounds`): game sound effects from the [Sounds Resource AoE3 pack](https://sounds.spriters-resource.com/pc_computer/ageofempiresiiiexpansions/asset/409094/) (download it in a browser), imported with `node scripts/import-sounds.mjs "<pack>\SFX"`, which converts to mono, trims and normalizes them.

[`scripts/bar.mjs`](scripts/bar.mjs) reads the game's `.bar` archives (version 6): plain and LZ4-compressed entries, with binary XMB converted to XML.

## Project layout

```
src/app/              screens (Expo Router)
  (tabs)/             Library, Community, Settings
  build/[id].tsx      build details
  edit/[id].tsx       build editor ("new" for a new build)
  play/[id].tsx       build player (timer + auto-scroll)
  community/[id].tsx  community build page
src/components/       UI pieces (step row, icon picker, civ picker…)
src/lib/              stores, Supabase client, community API, time helpers
src/theme/themes.ts   the per-DLC themes
src/data/             icon manifest, sample build
supabase/schema.sql   backend schema
scripts/              icon pipeline
```

## License

The code is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE): you can use, change and share it, and contributions are welcome, but it may not be used for commercial purposes. It stays free.

The game's icons, artwork and sounds are not covered by that license; they belong to Microsoft (see below).

## Legal

Unofficial fan project. Age of Empires III: Definitive Edition © Microsoft Corporation. AoE3 Build Tracker was created under Microsoft's "[Game Content Usage Rules](https://www.xbox.com/en-US/developers/rules)" using assets from Age of Empires III: Definitive Edition, and it is not endorsed by or affiliated with Microsoft. Under those rules the app must stay free and non-commercial.
