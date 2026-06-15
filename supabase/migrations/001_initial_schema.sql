-- Deck Builder (Into the Echoside-style) — initial multiplayer schema
-- Project: deck_builder
-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Games
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique default public.generate_join_code(),
  status text not null default 'lobby'
    check (status in ('lobby', 'active', 'finished')),
  max_players int not null default 6 check (max_players between 2 and 6),
  state jsonb,
  version int not null default 1,
  turn_player_id text,
  phase text,
  turn_number int not null default 0,
  host_player_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_join_code_idx on public.games (join_code);
create index if not exists games_status_idx on public.games (status);

drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
  before update on public.games
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Game players (seats 1–6)
-- ---------------------------------------------------------------------------
create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_key text not null check (player_key ~ '^player_[1-6]$'),
  seat_index int not null check (seat_index between 1 and 6),
  display_name text not null,
  is_ai boolean not null default false,
  is_host boolean not null default false,
  session_id text,
  created_at timestamptz not null default now(),
  unique (game_id, player_key),
  unique (game_id, seat_index)
);

create index if not exists game_players_game_id_idx on public.game_players (game_id);

-- ---------------------------------------------------------------------------
-- Action log (audit / replay)
-- ---------------------------------------------------------------------------
create table if not exists public.game_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_key text not null,
  action jsonb not null,
  game_version int not null,
  created_at timestamptz not null default now()
);

create index if not exists game_actions_game_id_idx on public.game_actions (game_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;

-- ---------------------------------------------------------------------------
-- Row Level Security (open for prototype — tighten with auth later)
-- ---------------------------------------------------------------------------
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_actions enable row level security;

drop policy if exists "games_anon_all" on public.games;
create policy "games_anon_all" on public.games
  for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "game_players_anon_all" on public.game_players;
create policy "game_players_anon_all" on public.game_players
  for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "game_actions_anon_all" on public.game_actions;
create policy "game_actions_anon_all" on public.game_actions
  for all to anon, authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- RPC: create a lobby game
-- ---------------------------------------------------------------------------
create or replace function public.create_game(
  p_display_name text,
  p_max_players int default 6,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_player public.game_players%rowtype;
begin
  if p_max_players < 2 or p_max_players > 6 then
    raise exception 'max_players must be between 2 and 6';
  end if;

  insert into public.games (max_players, status)
  values (p_max_players, 'lobby')
  returning * into v_game;

  insert into public.game_players (
    game_id, player_key, seat_index, display_name, is_host, session_id
  ) values (
    v_game.id, 'player_1', 1, coalesce(nullif(trim(p_display_name), ''), 'Player 1'), true, p_session_id
  )
  returning * into v_player;

  update public.games
  set host_player_id = v_player.id
  where id = v_game.id
  returning * into v_game;

  return jsonb_build_object(
    'game_id', v_game.id,
    'join_code', v_game.join_code,
    'player_key', v_player.player_key,
    'player_id', v_player.id,
    'seat_index', v_player.seat_index,
    'status', v_game.status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: join an existing lobby
-- ---------------------------------------------------------------------------
create or replace function public.join_game(
  p_join_code text,
  p_display_name text,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
  v_next_seat int;
  v_player public.game_players%rowtype;
begin
  select * into v_game
  from public.games
  where join_code = upper(trim(p_join_code))
  for update;

  if v_game.id is null then
    raise exception 'Game not found';
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'Game already started';
  end if;

  select coalesce(max(seat_index), 0) + 1 into v_next_seat
  from public.game_players
  where game_id = v_game.id;

  if v_next_seat > v_game.max_players then
    raise exception 'Game is full';
  end if;

  insert into public.game_players (
    game_id, player_key, seat_index, display_name, is_host, session_id
  ) values (
    v_game.id,
    'player_' || v_next_seat,
    v_next_seat,
    coalesce(nullif(trim(p_display_name), ''), 'Player ' || v_next_seat),
    false,
    p_session_id
  )
  returning * into v_player;

  return jsonb_build_object(
    'game_id', v_game.id,
    'join_code', v_game.join_code,
    'player_key', v_player.player_key,
    'player_id', v_player.id,
    'seat_index', v_player.seat_index,
    'status', v_game.status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: persist game state (optimistic concurrency)
-- ---------------------------------------------------------------------------
create or replace function public.sync_game_state(
  p_game_id uuid,
  p_player_key text,
  p_state jsonb,
  p_expected_version int,
  p_action jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games%rowtype;
begin
  if not exists (
    select 1 from public.game_players
    where game_id = p_game_id and player_key = p_player_key
  ) then
    raise exception 'Player not in game';
  end if;

  update public.games
  set
    state = p_state,
    version = version + 1,
    status = coalesce(p_state->>'status', status),
    turn_player_id = p_state->>'turnPlayerId',
    phase = p_state->>'phase',
    turn_number = coalesce((p_state->>'turnNumber')::int, turn_number)
  where id = p_game_id and version = p_expected_version
  returning * into v_game;

  if v_game.id is null then
    select * into v_game from public.games where id = p_game_id;
    return jsonb_build_object(
      'ok', false,
      'conflict', true,
      'game', row_to_json(v_game)::jsonb
    );
  end if;

  if p_action is not null then
    insert into public.game_actions (game_id, player_key, action, game_version)
    values (p_game_id, p_player_key, p_action, v_game.version);
  end if;

  return jsonb_build_object(
    'ok', true,
    'conflict', false,
    'game', row_to_json(v_game)::jsonb
  );
end;
$$;

grant usage on schema public to anon, authenticated;
grant all on public.games to anon, authenticated;
grant all on public.game_players to anon, authenticated;
grant all on public.game_actions to anon, authenticated;
grant execute on function public.create_game(text, int, text) to anon, authenticated;
grant execute on function public.join_game(text, text, text) to anon, authenticated;
grant execute on function public.sync_game_state(uuid, text, jsonb, int, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Optional: seed a demo lobby (comment out if not wanted)
-- ---------------------------------------------------------------------------
-- select public.create_game('Host', 6, 'demo-session-host');
