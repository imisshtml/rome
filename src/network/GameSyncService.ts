import { RealtimeChannel } from '@supabase/supabase-js';
import { GameAction, GameState } from '../types/gameTypes';
import {
  applyActionWithPhaseRules,
  buildPlayerSetupsFromDb,
  createInitialGameState,
  createPregameState,
  createLobbyGameState,
  rehydrateGameState,
  MAX_PLAYERS,
  MIN_PLAYERS,
} from '../game/GameEngine';
import { DbGame, DbGamePlayer, getSupabase, tryGetSupabase } from '../lib/supabase';

export interface GameSession {
  gameId: string;
  joinCode: string;
  playerKey: string;
  playerId: string;
  isHost: boolean;
}

export interface LobbyInfo {
  joinCode: string;
  maxPlayers: number;
  status: DbGame['status'];
  players: DbGamePlayer[];
}

type StateListener = (state: GameState, meta: { version: number; joinCode: string }) => void;
type LobbyListener = (lobby: LobbyInfo) => void;

function parseGameState(raw: unknown, gameId: string, version: number): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  return rehydrateGameState({ ...(raw as GameState), id: gameId, version });
}

export class GameSyncService {
  private channel: RealtimeChannel | null = null;
  private lobbyChannel: RealtimeChannel | null = null;
  private session: GameSession | null = null;
  private listeners = new Set<StateListener>();
  private lobbyListeners = new Set<LobbyListener>();

  getSession(): GameSession | null {
    return this.session;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeLobby(listener: LobbyListener): () => void {
    this.lobbyListeners.add(listener);
    return () => this.lobbyListeners.delete(listener);
  }

  private emit(state: GameState, version: number, joinCode: string) {
    for (const listener of this.listeners) {
      listener(state, { version, joinCode });
    }
  }

  private emitLobby(lobby: LobbyInfo) {
    for (const listener of this.lobbyListeners) {
      listener(lobby);
    }
  }

  async fetchLobbyInfo(gameId: string): Promise<LobbyInfo> {
    const supabase = getSupabase();
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .select('join_code, max_players, status')
      .eq('id', gameId)
      .single();

    if (gameErr || !game) throw new Error(gameErr?.message ?? 'Game not found');

    const { data: players } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .order('seat_index');

    return {
      joinCode: game.join_code,
      maxPlayers: game.max_players,
      status: game.status as DbGame['status'],
      players: (players ?? []) as DbGamePlayer[],
    };
  }

  async updateMaxPlayers(maxPlayers: number): Promise<LobbyInfo> {
    if (!this.session) throw new Error('Not connected');
    if (!this.session.isHost) throw new Error('Only host can change player count');

    const clamped = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, maxPlayers));
    const supabase = getSupabase();

    const { data: game, error } = await supabase
      .from('games')
      .update({ max_players: clamped })
      .eq('id', this.session.gameId)
      .eq('status', 'lobby')
      .select('id')
      .single();

    if (error || !game) throw new Error(error?.message ?? 'Could not update player count');

    const lobby = await this.fetchLobbyInfo(this.session.gameId);
    this.emitLobby(lobby);
    return lobby;
  }

  async connect(session: GameSession): Promise<GameState> {
    this.session = session;
    const supabase = getSupabase();
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', session.gameId)
      .single();

    if (error || !game) {
      throw new Error(error?.message ?? 'Game not found');
    }

    const dbGame = game as DbGame;
    this.setupGameChannel(session.gameId);
    this.setupLobbyChannel(session.gameId);

    const lobby = await this.fetchLobbyInfo(session.gameId);
    this.emitLobby(lobby);

    if (dbGame.state && dbGame.status === 'active') {
      const state = parseGameState(dbGame.state, dbGame.id, dbGame.version);
      if (state) {
        this.emit(state, dbGame.version, dbGame.join_code);
        return state;
      }
    }

    const lobbyState = await this.loadLobbyState(session.gameId, lobby);
    this.emit(lobbyState, dbGame.version, dbGame.join_code);
    return lobbyState;
  }

  private async loadLobbyState(gameId: string, lobby: LobbyInfo): Promise<GameState> {
    const humanPlayers = lobby.players.filter((p) => !p.is_ai);
    const setups = buildPlayerSetupsFromDb(
      humanPlayers.map((p) => ({
        player_key: p.player_key,
        display_name: p.display_name,
        is_ai: false,
        seat_index: p.seat_index,
      })),
      0
    );

    return createLobbyGameState(gameId, setups);
  }

  private setupGameChannel(gameId: string) {
    const supabase = getSupabase();
    this.channel?.unsubscribe();
    this.channel = supabase
      .channel(`game-state:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        async (payload) => {
          const row = payload.new as DbGame;
          if (row.state) {
            const state = parseGameState(row.state, row.id, row.version);
            if (state) {
              this.emit(state, row.version, row.join_code);
            }
          }
          if (row.status === 'lobby') {
            const lobby = await this.fetchLobbyInfo(gameId);
            this.emitLobby(lobby);
          }
        }
      )
      .subscribe();
  }

  private setupLobbyChannel(gameId: string) {
    const supabase = getSupabase();
    this.lobbyChannel?.unsubscribe();
    this.lobbyChannel = supabase
      .channel(`game-lobby:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${gameId}`,
        },
        async () => {
          const lobby = await this.fetchLobbyInfo(gameId);
          this.emitLobby(lobby);
        }
      )
      .subscribe();
  }

  disconnect() {
    this.channel?.unsubscribe();
    this.lobbyChannel?.unsubscribe();
    this.channel = null;
    this.lobbyChannel = null;
    this.session = null;
    this.listeners.clear();
    this.lobbyListeners.clear();
  }

  async startGame(): Promise<GameState> {
    if (!this.session) throw new Error('Not connected');
    const supabase = getSupabase();

    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('id', this.session.gameId)
      .single();

    if (!game) throw new Error('Game not found');
    const dbGame = game as DbGame;
    if (dbGame.status !== 'lobby') {
      const existing = parseGameState(dbGame.state, dbGame.id, dbGame.version);
      if (existing) return existing;
      throw new Error('Game already started');
    }

    const { data: players } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', this.session.gameId)
      .order('seat_index');

    const playerRows = ((players ?? []) as DbGamePlayer[]).filter((p) => !p.is_ai);
    const targetCount = dbGame.max_players;

    if (playerRows.length < 1) {
      throw new Error('At least one player is required');
    }

    const setups = buildPlayerSetupsFromDb(
      playerRows.map((p) => ({
        player_key: p.player_key,
        display_name: p.display_name,
        is_ai: false,
        seat_index: p.seat_index,
      })),
      targetCount
    );

    for (const setup of setups) {
      if (!setup.isAI) continue;
      await supabase.from('game_players').insert({
        game_id: this.session.gameId,
        player_key: setup.id,
        seat_index: parseInt(setup.id.replace('player_', ''), 10),
        display_name: setup.name,
        is_ai: true,
        is_host: false,
      });
    }

    const initialState = createPregameState(setups, this.session.gameId);
    initialState.version = dbGame.version;

    return this.persistState(initialState, null);
  }

  async dispatchAction(
    currentState: GameState,
    action: GameAction
  ): Promise<GameState> {
    const nextState = applyActionWithPhaseRules(currentState, action);
    if (nextState === currentState) return currentState;

    nextState.version = currentState.version ?? 1;
    return this.persistGameState(nextState, action);
  }

  async persistGameState(
    state: GameState,
    action: GameAction | null
  ): Promise<GameState> {
    return this.persistState(state, action);
  }

  private async persistState(
    state: GameState,
    action: GameAction | null
  ): Promise<GameState> {
    if (!this.session) throw new Error('Not connected');
    const supabase = getSupabase();
    const expectedVersion = state.version ?? 1;

    const { data, error } = await supabase.rpc('sync_game_state', {
      p_game_id: this.session.gameId,
      p_player_key: this.session.playerKey,
      p_state: state,
      p_expected_version: expectedVersion,
      p_action: action,
    });

    if (error) throw new Error(error.message);

    const result = data as {
      ok: boolean;
      conflict: boolean;
      game: DbGame;
    };

    if (result.conflict || !result.ok) {
      const fresh = parseGameState(
        result.game.state,
        result.game.id,
        result.game.version
      );
      if (fresh) {
        this.emit(fresh, result.game.version, result.game.join_code);
        return fresh;
      }
      throw new Error('State conflict — please retry');
    }

    const synced = parseGameState(
      result.game.state,
      result.game.id,
      result.game.version
    );
    if (!synced) throw new Error('Invalid synced state');

    this.emit(synced, result.game.version, result.game.join_code);
    return synced;
  }
}

export async function createOnlineGame(
  displayName: string,
  maxPlayers = MAX_PLAYERS,
  sessionId?: string
): Promise<GameSession> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('create_game', {
    p_display_name: displayName,
    p_max_players: maxPlayers,
    p_session_id: sessionId ?? null,
  });
  if (error) throw new Error(error.message);
  const row = data as {
    game_id: string;
    join_code: string;
    player_key: string;
    player_id: string;
  };
  return {
    gameId: row.game_id,
    joinCode: row.join_code,
    playerKey: row.player_key,
    playerId: row.player_id,
    isHost: true,
  };
}

export async function joinOnlineGame(
  joinCode: string,
  displayName: string,
  sessionId?: string
): Promise<GameSession> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('join_game', {
    p_join_code: joinCode.toUpperCase(),
    p_display_name: displayName,
    p_session_id: sessionId ?? null,
  });
  if (error) throw new Error(error.message);
  const row = data as {
    game_id: string;
    join_code: string;
    player_key: string;
    player_id: string;
  };
  return {
    gameId: row.game_id,
    joinCode: row.join_code,
    playerKey: row.player_key,
    playerId: row.player_id,
    isHost: false,
  };
}

export function isOnlineModeAvailable(): boolean {
  return tryGetSupabase() !== null;
}
