import {
  GameSyncService,
  GameSession,
  LobbyInfo,
  createOnlineGame,
  joinOnlineGame,
  resumeOnlineGame,
  isOnlineModeAvailable,
} from './GameSyncService';
import { GameAction, GameState } from '../types/gameTypes';
import {
  getNextAIAction,
  applyActionWithPhaseRules,
  createPregameState,
  rehydrateGameState,
} from '../game/GameEngine';
import { readGameStateSnapshot } from '../store/useGameStore';
import { getOrCreateSessionId } from '../utils/playerStorage';
import { pickOneAiDisplayName } from '../utils/aiPlayerNames';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type { GameSession, LobbyInfo };
export { createOnlineGame, joinOnlineGame, resumeOnlineGame, isOnlineModeAvailable };

function randomSessionId() {
  return getOrCreateSessionId();
}

function resolvePregameAI(state: GameState): GameState {
  let next = state;
  while (next.phase === 'PREGAME') {
    const aiAction = getNextAIAction(next);
    if (!aiAction) break;
    const after = applyActionWithPhaseRules(next, aiAction);
    if (after === next) break;
    next = after;
  }
  return next;
}

export class MultiplayerGameClient {
  private sync = new GameSyncService();
  private session: GameSession | null = null;
  private status: ConnectionStatus = 'disconnected';
  private onStateChange: ((state: GameState) => void) | null = null;
  private onLobbyChange: ((lobby: LobbyInfo) => void) | null = null;
  private lobbyUnsubscribe: (() => void) | null = null;
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
    this.lobbyUnsubscribe?.();
    this.lobbyUnsubscribe = this.sync.subscribeLobby(handler);
  }

  private pushState(state: GameState) {
    this.onStateChange?.(rehydrateGameState(state));
    if (state.status !== 'active') return;

    if (state.phase === 'PREGAME') {
      const humanReady = state.players.some(
        (p) => !p.isAI && state.readyPlayerIds.includes(p.id)
      );
      if (humanReady) this.scheduleAI(state);
      return;
    }

    this.scheduleAI(state);
  }

  async createGame(displayName: string, maxPlayers: number): Promise<GameSession> {
    const session = await createOnlineGame(displayName, maxPlayers, this.sessionId);
    await this.connectOnline(session);
    return session;
  }

  async joinGame(joinCode: string, displayName: string, reclaimPlayerId?: string): Promise<GameSession> {
    const session = await joinOnlineGame(
      joinCode,
      displayName,
      this.sessionId,
      reclaimPlayerId
    );
    await this.connectOnline(session);
    return session;
  }

  async resumeGame(displayName?: string): Promise<GameSession> {
    const session = await resumeOnlineGame(this.sessionId, displayName);
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
      {
        id: 'player_2',
        name: pickOneAiDisplayName([displayName]),
        isAI: true,
      },
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

    const state = rehydrateGameState(currentState);
    let next = applyActionWithPhaseRules(state, action);

    if (next.phase === 'PREGAME' && action.type === 'PLAYER_READY') {
      const canAutoReadyAi =
        !this.session ||
        this.session.gameId === 'local' ||
        this.session.isHost;
      if (canAutoReadyAi) {
        next = resolvePregameAI(next);
      }
    }

    if (next === state) {
      this.scheduleAI(state);
      return state;
    }

    if (!this.session || this.session.gameId === 'local') {
      this.pushState(next);
      return next;
    }

    next.version = state.version ?? 1;
    return this.sync.persistGameState(next, action);
  }

  private getAIDelayMs(state: GameState): number {
    const last = state.actionLog[state.actionLog.length - 1];
    if (last?.type === 'BUY_CARD') return 2000;
    if (last?.type === 'RESOLVE_GALLERY_EVENT') return 5000;
    if (last?.type === 'RESOLVE_FAVOR') return 5000;
    if (last?.type === 'EVENT_DISCARD_CARD') return 800;
    if (last?.type === 'EVENT_SKIP_GALLERY_CHOICE') return 800;
    if (last?.type === 'ACCEPT_FAVOR' || last?.type === 'DECLINE_FAVOR') return 800;
    if (last?.type === 'FAVOR_DESTROY_CARD') return 800;
    if (last?.type === 'DISMISS_ARENA_RESULT') return 800;
    if (state.pendingGalleryEvent) return 5000;
    if (state.pendingFavorReveal) {
      const beneficiary = state.players.find(
        (p) => p.id === state.pendingFavorReveal?.playerId
      );
      if (beneficiary?.isAI) return 400;
      return 5000;
    }
    if (last?.type === 'DISMISS_ARENA_WAGER_RESULT') return 800;
    if (state.lastArenaWagerResult) return 5000;
    if ((state.pendingEventHandChoices?.length ?? 0) > 0) return 800;
    if ((state.pendingEventItemChoices?.length ?? 0) > 0) return 800;
    if (
      (state.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0
    ) {
      return 800;
    }
    if (state.turnActionHighlight?.kind === 'buy') return 2000;
    return 600;
  }

  private scheduleAI(state: GameState) {
    if (this.session && this.session.gameId !== 'local' && !this.session.isHost) {
      return;
    }

    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }

    const latest = rehydrateGameState(state);
    if (getNextAIAction(latest) === null) return;

    const delayMs = this.getAIDelayMs(latest);

    this.aiTimer = setTimeout(async () => {
      try {
        const snapshot = rehydrateGameState(readGameStateSnapshot());
        const action = getNextAIAction(snapshot);
        if (!action) return;
        await this.dispatchAction(snapshot, action);
      } catch (err) {
        console.warn('[AI] action failed', err);
      }
    }, delayMs);
  }

  disconnect() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.lobbyUnsubscribe?.();
    this.lobbyUnsubscribe = null;
    this.sync.disconnect();
    this.session = null;
    this.status = 'disconnected';
  }
}
