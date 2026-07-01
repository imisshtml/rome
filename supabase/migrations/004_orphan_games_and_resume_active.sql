-- Fix orphaned "active" games and lobby kick-outs on resume.
--
-- Problems addressed:
--   1) purge_session_from_other_games removed a session's player row from other
--      games but left the games behind. Once a game's last human seat was
--      purged, the game stayed 'active' forever with no players (orphan).
--   2) resume_session picked the NEWEST player row regardless of game status, so
--      a stale 'lobby' row could win over the game you were actually playing,
--      dropping you back into the lobby.

-- ---------------------------------------------------------------------------
-- Purge: also delete games that lose their last human seat (cascades AI seats
-- and action logs via ON DELETE CASCADE).
-- ---------------------------------------------------------------------------
create or replace function public.purge_session_from_other_games(
  p_session_id text,
  p_keep_game_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affected uuid[];
begin
  if p_session_id is null or trim(p_session_id) = '' then
    return;
  end if;

  with removed as (
    delete from public.game_players gp
    where gp.session_id = p_session_id
      and gp.is_ai = false
      and (p_keep_game_id is null or gp.game_id <> p_keep_game_id)
    returning gp.game_id
  )
  select array_agg(distinct game_id) into v_affected from removed;

  -- Any game we just left that now has no human players is an orphan — drop it.
  if v_affected is not null then
    delete from public.games g
    where g.id = any (v_affected)
      and not exists (
        select 1 from public.game_players gp2
        where gp2.game_id = g.id and gp2.is_ai = false
      );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resume: prefer the session's ACTIVE game, then most recent. This keeps you in
-- an in-progress game instead of a stale lobby row.
-- ---------------------------------------------------------------------------
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

  select gp.* into v_player
  from public.game_players gp
  join public.games g on g.id = gp.game_id
  where gp.session_id = p_session_id
    and gp.is_ai = false
  order by
    (g.status = 'active') desc,   -- in-progress games win
    gp.created_at desc            -- otherwise most recent seat
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

-- ---------------------------------------------------------------------------
-- One-time cleanup: delete every game that has no human players (the existing
-- orphans). Games with real players — including your live one — are untouched.
-- ---------------------------------------------------------------------------
delete from public.games g
where not exists (
  select 1 from public.game_players gp
  where gp.game_id = g.id and gp.is_ai = false
);
