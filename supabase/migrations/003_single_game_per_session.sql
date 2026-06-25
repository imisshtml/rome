-- One browser session → one game seat. Purge stale rows on create/join/resume.

create or replace function public.purge_session_from_other_games(
  p_session_id text,
  p_keep_game_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_id is null or trim(p_session_id) = '' then
    return;
  end if;

  delete from public.game_players gp
  where gp.session_id = p_session_id
    and gp.is_ai = false
    and (p_keep_game_id is null or gp.game_id <> p_keep_game_id);
end;
$$;

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

  perform public.purge_session_from_other_games(p_session_id, null);

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
    'status', v_game.status,
    'is_host', v_player.is_host
  );
end;
$$;

create or replace function public.join_game(
  p_join_code text,
  p_display_name text,
  p_session_id text default null,
  p_reclaim_player_id uuid default null
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

  perform public.purge_session_from_other_games(p_session_id, v_game.id);

  if p_session_id is not null and trim(p_session_id) <> '' then
    select * into v_player
    from public.game_players
    where game_id = v_game.id
      and session_id = p_session_id
      and is_ai = false
    limit 1;

    if v_player.id is not null then
      update public.game_players
      set
        display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
        session_id = p_session_id
      where id = v_player.id
      returning * into v_player;

      return jsonb_build_object(
        'game_id', v_game.id,
        'join_code', v_game.join_code,
        'player_key', v_player.player_key,
        'player_id', v_player.id,
        'seat_index', v_player.seat_index,
        'status', v_game.status,
        'is_host', v_player.is_host,
        'rejoined', true
      );
    end if;
  end if;

  if p_reclaim_player_id is not null then
    select * into v_player
    from public.game_players
    where game_id = v_game.id
      and id = p_reclaim_player_id
      and is_ai = false
    limit 1;

    if v_player.id is not null then
      update public.game_players
      set
        display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
        session_id = coalesce(nullif(trim(p_session_id), ''), session_id)
      where id = v_player.id
      returning * into v_player;

      return jsonb_build_object(
        'game_id', v_game.id,
        'join_code', v_game.join_code,
        'player_key', v_player.player_key,
        'player_id', v_player.id,
        'seat_index', v_player.seat_index,
        'status', v_game.status,
        'is_host', v_player.is_host,
        'rejoined', true
      );
    end if;
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
    'status', v_game.status,
    'is_host', v_player.is_host,
    'rejoined', false
  );
end;
$$;

create or replace function public.resume_session(
  p_session_id text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.game_players%rowtype;
  v_game public.games%rowtype;
begin
  if p_session_id is null or trim(p_session_id) = '' then
    raise exception 'No session';
  end if;

  select * into v_player
  from public.game_players
  where session_id = p_session_id
    and is_ai = false
  order by created_at desc
  limit 1;

  if v_player.id is null then
    raise exception 'No active game for session';
  end if;

  perform public.purge_session_from_other_games(p_session_id, v_player.game_id);

  select * into v_game from public.games where id = v_player.game_id;
  if v_game.id is null then
    raise exception 'Game not found';
  end if;

  update public.game_players
  set
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
    session_id = p_session_id
  where id = v_player.id
  returning * into v_player;

  return jsonb_build_object(
    'game_id', v_game.id,
    'join_code', v_game.join_code,
    'player_key', v_player.player_key,
    'player_id', v_player.id,
    'seat_index', v_player.seat_index,
    'status', v_game.status,
    'is_host', v_player.is_host,
    'rejoined', true
  );
end;
$$;

grant execute on function public.purge_session_from_other_games(text, uuid) to anon, authenticated;
grant execute on function public.create_game(text, int, text) to anon, authenticated;
grant execute on function public.join_game(text, text, text, uuid) to anon, authenticated;
grant execute on function public.resume_session(text, text) to anon, authenticated;
