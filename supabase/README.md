# Supabase setup — deck_builder

Project URL: `https://jrzstndscpobuqfcpffx.supabase.co`

## 1. Run the schema SQL

In Supabase Dashboard → **SQL Editor** → New query, paste and run:

`supabase/migrations/001_initial_schema.sql`

Then run (in order):

- `supabase/migrations/002_rejoin_game.sql` — reclaim seat by `session_id` / player id on rejoin
- `supabase/migrations/003_single_game_per_session.sql` — one game per session, `resume_session` RPC, purge stale seats on create/join
- `supabase/migrations/004_gallery_tested_cards.sql` — shared gallery “tested” checklist for QA (all clients)

This creates:

- `games` — lobby/active state, JSON game state, optimistic `version`
- `game_players` — up to 6 seats (`player_1` … `player_6`), AI flag
- `game_actions` — action audit log
- RPCs: `create_game`, `join_game`, `sync_game_state`, `resume_session`
- Realtime on `games` + `game_players`
- Open RLS policies for prototype (tighten before production)

## 2. Enable Realtime (if migration errors on publication)

Dashboard → **Database** → **Publications** → `supabase_realtime` → add `games`, `game_players`.

## 3. App env

Copy `.env.example` → `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://jrzstndscpobuqfcpffx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your anon key from Project Settings → API>
EXPO_PUBLIC_PLAYER_NAME=You

# Optional — join an existing lobby instead of creating one
# EXPO_PUBLIC_GAME_JOIN_CODE=ABC123
```

Restart Expo after changing `.env`.

## 4. Web build version

`npm run web` / `npm run build:web` runs `scripts/generate-build-info.js`, which writes git commit SHA into the landing menu and polls `/build-meta.json` for update banners on web.

## 5. Multiplayer flow

1. **Landing** — nickname, optional join code, create/join/practice
2. **Lobby** — share join code, host sets table size (2–6), empty seats = AI at start
3. **Game** — board (unchanged layout)

| Action | Result |
|--------|--------|
| Create Game | Host enters lobby with join code |
| Join Game | Enter code on landing → lobby (waits for host) |
| Practice vs AI | Offline 6-player table, no Supabase |
| Host Start | Fills empty seats with AI, syncs to all clients via Realtime |

## 6. Turn flow (Echoside-style)

1. **Draw** — end phase auto-draws 5, then Main  
2. **Main** — play cards from hand  
3. **Arena** — commit up to 3 cards, attempt challenge  
4. **Buy** — purchase from gallery  
5. **End** — cleanup, next player  

State syncs via `sync_game_state` RPC + Realtime `UPDATE` on `games`.
