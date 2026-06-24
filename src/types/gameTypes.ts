import { CardInstance, CardLocation, Faction } from './cardTypes';
import type { ArenaLossSpec } from '../utils/arenaLossUtils';

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
  | 'DECLINE_ARENA'
  | 'MOVE_CARD'
  | 'START_GAME'
  | 'PLAYER_READY'
  | 'END_GAME'
  | 'ACCEPT_BANDING_BONUS'
  | 'DECLINE_BANDING_BONUS'
  | 'RESOLVE_GALLERY_EVENT'
  | 'EVENT_DISCARD_CARD'
  | 'EVENT_SKIP_GALLERY_CHOICE'
  | 'RESOLVE_FAVOR'
  | 'ACCEPT_FAVOR'
  | 'DECLINE_FAVOR'
  | 'FAVOR_DESTROY_CARD'
  | 'CARD_DESTROY_PICK'
  | 'CARD_DESTROY_SKIP'
  | 'GALLERY_DESTROY_PICK'
  | 'ANY_DISCARD_DESTROY_PICK'
  | 'CHOOSE_OR_EFFECT'
  | 'ON_GAIN_DESTROY_PICK'
  | 'ON_GAIN_DESTROY_SKIP'
  | 'FORCE_OPPONENT_DISCARD'
  | 'RESOLVE_ARENA_LOSS'
  | 'DISMISS_ARENA_RESULT';

export type BandingFaction = 'Ludus' | 'Legion' | 'Senate';

export interface PendingForcedOpponentDiscards {
  controllerId: string;
  sourceCardName?: string;
  targetPlayerId: string;
  remainingTargetIds: string[];
}

export interface PendingBandingBonus {
  playerId: string;
  faction: BandingFaction;
  bonusText: string;
}

export type TurnActionHighlightSource = 'gallery' | 'epic' | 'recruit' | 'arena';

/** Brief UI highlight after an opponent buy or arena attempt. */
export interface TurnActionHighlight {
  playerId: string;
  kind: 'buy' | 'arena';
  marketSource: TurnActionHighlightSource;
  card: CardInstance;
  /** Gallery/epic index at time of purchase (slot highlight after refill). */
  marketIndex?: number;
}

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
  valorGain: number;
  rewardVp: number;
  challengerId: string;
}

export type PendingArenaLossPhase =
  | 'primus_choice'
  | 'primus_fighter_pick'
  | 'destroy_fighter_pick';

export interface PendingArenaLoss {
  playerId: string;
  loss: ArenaLossSpec;
  /** Snapshot of fighters committed to this challenge. */
  committedFighters: CardInstance[];
  phase: PendingArenaLossPhase;
  /** Fighters tied for strongest (Primus destroy path). */
  primusCandidates?: CardInstance[];
  /** Primus: player chose disfavor instead of destroying a fighter. */
  appliedDisfavor?: boolean;
  /** Instance ids destroyed as part of this loss resolution. */
  destroyedFighterIds?: string[];
  remainingDestroyPicks?: number;
}

export interface GameAction {
  type: GameActionType;
  playerId: string;
  payload?: {
    cardInstanceId?: string;
    cardInstanceIds?: string[];
    targetZone?: CardLocation;
    targetPlayerId?: string;
    branchIndex?: number;
    sourceZone?: CardLocation;
    count?: number;
    responseType?: ArenaResponseType;
    chosenFaction?: Faction;
    cardName?: string;
    definitionId?: string;
    effectSummary?: string;
    arenaLossChoice?: 'disfavor' | 'destroy_fighter';
  };
  timestamp: number;
}

export interface PlayerState {
  id: string;
  name: string;
  isAI?: boolean;
  victoryPoints: number;
  /** Coins from events, applied at the start of this player's next turn. */
  carryCoins?: number;
  /** Imperial Tax — lose 1 coin from turn coffers once on next turn. */
  imperialTaxPending?: boolean;
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  playArea: CardInstance[];
  itemsInPlay: CardInstance[];
  /** Draw fewer cards at end of turn (Champion of Gaul loss). */
  drawPenalty?: number;
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
  /** Gallery cards bought this turn — stay visible until refill (instanceId → buyerId). */
  galleryPurchasedBy?: Record<string, string>;
  /** Top recruit card (face up, buyable). */
  recruitCard?: CardInstance | null;
  /** Remaining shuffled recruit pile (face down). */
  recruitDeck?: CardInstance[];
  /** Face-down supply for gallery refills */
  gallerySupply?: CardInstance[];
  /** Face-down supply for epic row refills */
  epicSupply?: CardInstance[];
  /** Global destroyed card pile (gallery + player destroys). */
  destroyedPile?: CardInstance[];
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
  /** Faction banding bonuses already offered/resolved this turn */
  turnBandingClaimed?: BandingFaction[];
  /** Waiting for active player to accept or decline a banding bonus */
  pendingBandingBonus?: PendingBandingBonus | null;
  /** Highlights opponent buy / arena for the active turn player */
  turnActionHighlight?: TurnActionHighlight | null;
  /** Face-up gallery event shown while resolving or acknowledging */
  pendingGalleryEvent?: CardInstance | null;
  /** Players who must pick a hand card to discard (Plague Spreads) */
  pendingEventDiscards?: string[];
  /** Each player may discard for coins (Barbarian Incursion) */
  pendingEventOptionalDiscards?: {
    coinReward: number;
    pendingPlayerIds: string[];
  } | null;
  /** Face-up favor being revealed and resolved */
  pendingFavorReveal?: {
    card: CardInstance;
    playerId: string;
  } | null;
  /** Favors waiting while another reveal or gallery event is active */
  pendingFavorQueue?: {
    card: CardInstance;
    playerId: string;
  }[];
  /** Beneficiary must destroy cards for a favor effect */
  pendingFavorDestroyPick?: {
    playerId: string;
    remaining: number;
    fromZones: ('hand' | 'discard' | 'play_area')[];
    sourceCardName?: string;
  } | null;
  /** Active player must destroy cards for a played card effect (e.g. War Banner) */
  pendingCardDestroyPick?: {
    playerId: string;
    remaining: number;
    fromZones: ('hand' | 'discard' | 'play_area')[];
    sourceCardName?: string;
    sourceCardInstanceId?: string;
    deferRemainingEffects?: boolean;
    optional?: boolean;
    /** Tax Collector: add destroyed card cost to turn coins */
    rewardCoinsFromCost?: boolean;
  } | null;
  /** Pick cards in the Gallery row to destroy */
  pendingGalleryDestroyPick?: {
    playerId: string;
    remaining: number;
    sourceCardName?: string;
    sourceCardInstanceId?: string;
    deferRemainingEffects?: boolean;
    refillGallery?: boolean;
  } | null;
  /** Pick a card from any player's discard pile */
  pendingAnyDiscardDestroyPick?: {
    playerId: string;
    remaining: number;
    sourceCardName?: string;
    sourceCardInstanceId?: string;
    deferRemainingEffects?: boolean;
  } | null;
  /** OR effect choice (e.g. +1 Coin OR destroy to draw) */
  pendingOrEffectChoice?: {
    playerId: string;
    sourceCardName?: string;
    sourceCardInstanceId: string;
    baseGainCoins: number;
    branches: Record<string, unknown>[];
  } | null;
  /** on_gain destroy when buying a card */
  pendingOnGainDestroyPick?: {
    playerId: string;
    remaining: number;
    fromZones: ('hand' | 'discard')[];
    sourceCardName?: string;
    optional?: boolean;
  } | null;
  /** Active player must discard N cards from hand (e.g. Gladiatrix) */
  pendingHandDiscard?: {
    playerId: string;
    remaining: number;
    sourceCardName?: string;
  } | null;
  /** Challenger must resolve arena defeat penalty (fighter destroy / Primus choice). */
  pendingArenaLoss?: PendingArenaLoss | null;
  /** Active player chooses cards for opponents to discard (e.g. Manipulator) */
  pendingForcedOpponentDiscards?: PendingForcedOpponentDiscards | null;
  /** Turn pass paused until gallery refill + events finish */
  deferredTurnEnd?: {
    endingPlayerId: string;
    nextPlayerIdx: number;
  } | null;
  /** Arena unlocked after The Opening Games is completed */
  arenaOpen?: boolean;
  /** Active player resolved mandatory arena (or declined) this turn */
  turnArenaResolved?: boolean;
  /** Active player exempt from mandatory arena this turn (card effect) */
  turnArenaExempt?: boolean;
  /** Arena defeated this turn — replace card at end of turn */
  pendingArenaReplacement?: boolean;
  /** Max purchasable card cost (Grain Shortage). */
  purchaseCostCap?: number | null;
  /** Clears purchaseCostCap when this player's turn ends. */
  purchaseCostCapActiveForPlayerId?: string | null;
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
