-- Allow players to reclaim their seat via session_id (browser refresh / reconnect)
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

  -- Reclaim existing human seat when session matches (lobby or in-progress)
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

  -- Reclaim by saved player row id (same browser, new session token)
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

grant execute on function public.join_game(text, text, text, uuid) to anon, authenticated;
