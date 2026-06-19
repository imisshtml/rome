import { CardInstance, CardLocation, Faction } from './cardTypes';

export type GamePhase = 'PREGAME' | 'MAIN' | 'CLEANUP';

export type GameStatus = 'lobby' | 'pregame' | 'active' | 'finished';

export type GameActionType =
  | 'PLAY_CARD'
  | 'DRAW_CARD'
  | 'ATTEMPT_ARENA'
  | 'CONFIRM_ARENA_FIGHTERS'
  | 'ARENA_RESPOND'
  | 'BUY_CARD'
  | 'DISCARD_CARD'
  | 'END_PHASE'
  | 'MOVE_CARD'
  | 'START_GAME'
  | 'PLAYER_READY'
  | 'END_GAME';

export type ArenaResponseType = 'support' | 'hinder' | 'pass';

export interface ArenaChallengeState {
  challengerId: string;
  phase: 'responses';
  pendingResponsePlayerIds: string[];
  supportByPlayerId: Record<string, CardInstance | null>;
  hinderByPlayerId: Record<string, CardInstance | null>;
}

export interface ArenaChallengeResult {
  success: boolean;
  totalValor: number;
  requiredValor: number;
  rewardVp: number;
  challengerId: string;
}

export interface GameAction {
  type: GameActionType;
  playerId: string;
  payload?: {
    cardInstanceId?: string;
    cardInstanceIds?: string[];
    targetZone?: CardLocation;
    sourceZone?: CardLocation;
    count?: number;
    responseType?: ArenaResponseType;
    chosenFaction?: Faction;
  };
  timestamp: number;
}

export interface PlayerState {
  id: string;
  name: string;
  isAI?: boolean;
  victoryPoints: number;
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
  /** Active arena challenge — fighters in arenaCommitZone, responses tracked here */
  arenaChallenge?: ArenaChallengeState | null;
  /** Shown briefly after a challenge resolves */
  lastArenaResult?: ArenaChallengeResult | null;
  galleryCards: CardInstance[];
  epicCards: CardInstance[];
  /** Top recruit card (face up, buyable). */
  recruitCard?: CardInstance | null;
  /** Remaining shuffled recruit pile (face down). */
  recruitDeck?: CardInstance[];
  /** Face-down supply for gallery refills */
  gallerySupply?: CardInstance[];
  /** Face-down supply for epic row refills */
  epicSupply?: CardInstance[];
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
