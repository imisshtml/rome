import {
  GameSyncService,
  GameSession,
  LobbyInfo,
  createOnlineGame,
  joinOnlineGame,
  isOnlineModeAvailable,
} from './GameSyncService';
import { GameAction, GameState } from '../types/gameTypes';
import {
  getNextAIAction,
  applyActionWithPhaseRules,
  createPregameState,
  MAX_PLAYERS,
} from '../game/GameEngine';
import { getDefaultStore } from 'jotai';
import { gameStateAtom } from '../store/useGameStore';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type { GameSession, LobbyInfo };
export { createOnlineGame, joinOnlineGame, isOnlineModeAvailable };

function randomSessionId() {
  return `sess_${Math.random().toString(36).slice(2, 10)}`;
}

export class MultiplayerGameClient {
  private sync = new GameSyncService();
  private session: GameSession | null = null;
  private status: ConnectionStatus = 'disconnected';
  private onStateChange: ((state: GameState) => void) | null = null;
  private onLobbyChange: ((lobby: LobbyInfo) => void) | null = null;
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private applyingRemote = false;
  private sessionId = randomSessionId();

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getSession(): GameSession | null {
    return this.session;
  }

  setStateHandler(handler: (state: GameState) => void) {
    this.onStateChange = handler;
  }

  setLobbyHandler(handler: (lobby: LobbyInfo) => void) {
    this.onLobbyChange = handler;
    this.sync.subscribeLobby(handler);
  }

  private pushState(state: GameState) {
    this.onStateChange?.(state);
    if (state.status === 'active') {
      this.scheduleAI(state);
    }
  }

  async createGame(displayName: string, maxPlayers: number): Promise<GameSession> {
    const session = await createOnlineGame(displayName, maxPlayers, this.sessionId);
    await this.connectOnline(session);
    return session;
  }

  async joinGame(joinCode: string, displayName: string): Promise<GameSession> {
    const session = await joinOnlineGame(joinCode, displayName, this.sessionId);
    await this.connectOnline(session);
    return session;
  }

  async connectLocal(displayName: string): Promise<GameState> {
    this.status = 'connected';
    this.session = {
      gameId: 'local',
      joinCode: 'LOCAL',
      playerKey: 'player_1',
      playerId: 'player_1',
      isHost: true,
    };

    const setups = [
      { id: 'player_1', name: displayName, isAI: false },
      ...Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => ({
        id: `player_${i + 2}`,
        name: `AI ${i + 2}`,
        isAI: true,
      })),
    ];
    const state = createPregameState(setups, 'local');
    this.pushState(state);
    return state;
  }

  async connectOnline(session: GameSession): Promise<GameState> {
    this.status = 'connecting';
    this.session = session;

    this.sync.subscribe((state) => {
      this.applyingRemote = true;
      this.pushState(state);
      this.applyingRemote = false;
    });

    const state = await this.sync.connect(session);
    this.status = 'connected';
    this.pushState(state);
    return state;
  }

  async fetchLobby(): Promise<LobbyInfo> {
    if (!this.session || this.session.gameId === 'local') {
      throw new Error('Not in online lobby');
    }
    return this.sync.fetchLobbyInfo(this.session.gameId);
  }

  async updateMaxPlayers(maxPlayers: number): Promise<LobbyInfo> {
    return this.sync.updateMaxPlayers(maxPlayers);
  }

  async startGame(): Promise<GameState> {
    if (!this.session) throw new Error('Not connected');
    if (this.session.gameId === 'local') {
      throw new Error('Local mode is already active');
    }
    const state = await this.sync.startGame();
    this.pushState(state);
    return state;
  }

  async dispatchAction(
    currentState: GameState,
    action: GameAction
  ): Promise<GameState> {
    if (this.applyingRemote) return currentState;

    if (!this.session || this.session.gameId === 'local') {
      const next = applyActionWithPhaseRules(currentState, action);
      this.pushState(next);
      return next;
    }

    return this.sync.dispatchAction(currentState, action);
  }

  private scheduleAI(state: GameState) {
    if (this.session && this.session.gameId !== 'local' && !this.session.isHost) {
      return;
    }

    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }

    if (getNextAIAction(state) === null) return;

    this.aiTimer = setTimeout(async () => {
      try {
        const latest = getDefaultStore().get(gameStateAtom);
        const action = getNextAIAction(latest);
        if (!action) return;
        await this.dispatchAction(latest, action);
      } catch (err) {
        console.warn('[AI] action failed', err);
      }
    }, 600);
  }

  disconnect() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.sync.disconnect();
    this.session = null;
    this.status = 'disconnected';
    this.sessionId = randomSessionId();
  }
}
