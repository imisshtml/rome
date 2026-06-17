import { CardInstance, CardLocation } from './cardTypes';

export type GamePhase = 'PREGAME' | 'MAIN' | 'CLEANUP';

export type GameStatus = 'lobby' | 'pregame' | 'active' | 'finished';

export type GameActionType =
  | 'PLAY_CARD'
  | 'DRAW_CARD'
  | 'ATTEMPT_ARENA'
  | 'BUY_CARD'
  | 'DISCARD_CARD'
  | 'END_PHASE'
  | 'MOVE_CARD'
  | 'START_GAME'
  | 'PLAYER_READY'
  | 'END_GAME';

export interface GameAction {
  type: GameActionType;
  playerId: string;
  payload?: {
    cardInstanceId?: string;
    targetZone?: CardLocation;
    sourceZone?: CardLocation;
    count?: number;
  };
  timestamp: number;
}

export interface PlayerState {
  id: string;
  name: string;
  isAI?: boolean;
  victoryPoints: number;
  karma: number;
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  playArea: CardInstance[];
  itemsInPlay: CardInstance[];
}

export interface GameState {
  id: string;
  status?: GameStatus;
  version?: number;
  players: PlayerState[];
  arenaCard: CardInstance | null;
  arenaDeck: CardInstance[];
  arenaCommitZone: CardInstance[];
  galleryCards: CardInstance[];
  epicCards: CardInstance[];
  flavorDeck: CardInstance[];
  disfavorDeck: CardInstance[];
  turnPlayerId: string;
  phase: GamePhase;
  turnNumber: number;
  actionLog: GameAction[];
  /** Player ids who clicked Ready during pregame */
  readyPlayerIds: string[];
  /** Coins gathered by the active player this turn (for buys) */
  turnCoins: number;
  /** Valor from cards played this turn by the active player */
  turnValor: number;
  /** Set when status is finished */
  winnerId?: string | null;
}

export interface DropZoneConfig {
  id: string;
  zoneType: CardLocation;
  acceptsCardTypes: CardLocation[];
  label: string;
}

export const PHASE_LABELS: Record<GamePhase, string> = {
  PREGAME: 'Review Board',
  MAIN: 'Main Phase',
  CLEANUP: 'Clean Up',
};
