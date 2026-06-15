import { CardInstance, CardLocation } from './cardTypes';

export type GamePhase = 'DRAW' | 'MAIN' | 'ARENA' | 'BUY' | 'END';

export type GameActionType =
  | 'PLAY_CARD'
  | 'DRAW_CARD'
  | 'ATTEMPT_ARENA'
  | 'BUY_CARD'
  | 'DISCARD_CARD'
  | 'END_PHASE'
  | 'MOVE_CARD'
  | 'START_GAME';

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
  status?: 'lobby' | 'active' | 'finished';
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
}

export interface DropZoneConfig {
  id: string;
  zoneType: CardLocation;
  acceptsCardTypes: CardLocation[];
  label: string;
}

export const PHASE_LABELS: Record<GamePhase, string> = {
  DRAW: 'Draw Phase',
  MAIN: 'Main Phase',
  ARENA: 'Arena Phase',
  BUY: 'Buy Phase',
  END: 'End Phase',
};
