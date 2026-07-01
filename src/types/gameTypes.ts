import { CardInstance, CardLocation, Faction } from './cardTypes';
import type { ArenaLossSpec } from '../utils/arenaLossUtils';
import type { ArenaWagerResult } from '../utils/arenaWagerUtils';

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
  | 'EVENT_LOSE_ITEM'
  | 'EVENT_SKIP_GALLERY_CHOICE'
  | 'RESOLVE_FAVOR'
  | 'ACCEPT_FAVOR'
  | 'DECLINE_FAVOR'
  | 'FAVOR_DESTROY_CARD'
  | 'FAVOR_ARENA_WAGER_PICK'
  | 'FAVOR_REPLAY_PICK'
  | 'CARD_DESTROY_PICK'
  | 'CARD_DESTROY_SKIP'
  | 'GALLERY_DESTROY_PICK'
  | 'GALLERY_DESTROY_SKIP'
  | 'EPIC_DESTROY_PICK'
  | 'ANY_DISCARD_DESTROY_PICK'
  | 'CHOOSE_OR_EFFECT'
  | 'ON_GAIN_DESTROY_PICK'
  | 'ON_GAIN_DESTROY_SKIP'
  | 'FORCE_OPPONENT_DISCARD'
  | 'CHOOSE_FORCE_DISCARD_TARGET'
  | 'PLACE_CARD_ON_DECK_PICK'
  | 'PLACE_CARD_ON_DECK_SKIP'
  | 'GAIN_CARD_PICK'
  | 'COPY_CARD_PICK'
  | 'PLACE_DESTROYED_ON_MARKET_PICK'
  | 'PLACE_DESTROYED_ON_MARKET_SKIP'
  | 'DECK_LOOK_CHOOSE_PLAYER'
  | 'DECK_LOOK_KEEP_TOP'
  | 'DECK_LOOK_REORDER'
  | 'DECK_TOP_REVEAL_RESOLVE'
  | 'CHOOSE_GAIN_BANDING_BONUS'
  | 'RESOLVE_ARENA_LOSS'
  | 'DISMISS_ARENA_RESULT'
  | 'DISMISS_ARENA_WAGER_RESULT'
  | 'RETURN_CARD_TO_HAND_PICK'
  | 'RETURN_CARD_TO_HAND_SKIP'
  | 'REVEAL_FAVORS_PICK'
  | 'FLIP_MARKET_PICK'
  | 'FLIP_MARKET_SKIP'
  | 'CROWD_FRENZY_GAIN_PICK'
  | 'CROWD_FRENZY_SKIP'
  | 'USE_ITEM'
  | 'ITEM_PEEK_DRAW'
  | 'ITEM_PEEK_SKIP'
  | 'BRIBERY_CHOOSE_OPPONENT'
  | 'BRIBERY_PLAY_REVEALED'
  | 'BRIBERY_SKIP'
  | 'DEBUG_SPAWN_CARD'
  | 'GALLERY_EVENT_FLIPPED';

export type EventHandChoiceKind =
  | 'discard'
  | 'destroy'
  | 'destroy_charity_or_gratia';

export interface PendingEventHandChoice {
  playerId: string;
  remaining: number;
  kind: EventHandChoiceKind;
}

export interface PendingEventItemChoice {
  playerId: string;
}

export type BandingFaction = 'Ludus' | 'Legion' | 'Senate';

export interface PendingForcedOpponentDiscards {
  controllerId: string;
  sourceCardName?: string;
  perOpponent: number;
  targetPlayerId: string;
  remainingForTarget: number;
  remainingTargetIds: string[];
  /** High Consul — pick opponent before viewing hand */
  phase?: 'choose_opponent' | 'discard';
  /** Active player selects which card the opponent loses */
  controllerPicks?: boolean;
  /** Only one opponent is targeted (not all opponents) */
  singleTarget?: boolean;
  opponentCandidateIds?: string[];
  /** Spoils of Victory — destroy to destroyed pile instead of discard */
  destroyToPile?: boolean;
}

/** Interactive favor effects (deck look, etc.) run after the favor reveal dismisses. */
export interface PendingFavorFollowUp {
  playerId: string;
  card: CardInstance;
}

export interface PendingPlaceCardOnDeckPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  optional?: boolean;
  faction?: Faction;
  anyFaction?: boolean;
  position: 'top' | 'bottom';
}

export interface PendingGainCardPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  maxCost?: number;
  cardType?: 'faction' | 'item' | 'imperial_favor';
  gainFaction?: Faction;
  thenDiscard?: number;
  gainSource?: 'market' | 'market_or_epic' | 'destroyed_pile';
}

/** Put a card from discard into hand (Supply Wagon, Germanicus). */
export interface PendingReturnCardToHandPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  /** Exclude this card type from eligibility (e.g. 'Epic'). */
  excludeType?: string;
  optional?: boolean;
}

/**
 * Bribery: controller picks an opponent, a random card from that opponent's hand
 * is revealed, and the controller may play it (destroyed at end of turn).
 */
export interface PendingBriberyPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  phase: 'choose_opponent' | 'play_choice';
  /** Opponents with at least one card in hand. */
  opponentCandidateIds: string[];
  /** Chosen opponent (set once phase === 'play_choice'). */
  opponentId?: string;
  /** The revealed card from the opponent's hand the controller may play. */
  revealedCardInstanceId?: string;
}

/** Reveal N favors, keep some, discard the rest (Praeco, Vestal Priestess). */
export interface PendingRevealFavorsPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  /** Favor cards drawn from the favor deck and still selectable. */
  revealed: CardInstance[];
  /** How many of the revealed favors the player still gets to keep. */
  pick: number;
  /** Favors selected so far (resolved once selection completes). */
  kept?: CardInstance[];
}

/** Flip up to N market cards face down until the player's next turn (Sententia). */
export interface PendingFlipMarketPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  remaining: number;
}

export interface PendingDeckTopRevealPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  picks: {
    targetPlayerId: string;
    targetPlayerName: string;
    card: CardInstance;
  }[];
  currentIndex: number;
}

export interface PendingPlaceDestroyedOnMarketPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  optional?: boolean;
}

export interface PendingCopyCardPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  maxCost?: number;
  copySource?: 'market' | 'in_play' | 'market_or_epic';
}

export interface PendingDeckLookPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  lookCount: number;
  phase: 'choose_deck' | 'keep_top' | 'reorder';
  targetPlayerId?: string;
  viewedCards?: CardInstance[];
}

/** Centurion Baton — reveal deck top; owner may draw it if cheap enough. */
export interface PendingItemDeckPeek {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
  revealedCard: CardInstance;
  canDraw: boolean;
}

/** Crowd Frenzy — destroy each deck top, then controller picks market replacements. */
export interface PendingCrowdFrenzyPick {
  playerId: string;
  sourceCardName?: string;
  replacements: Array<{
    targetPlayerId: string;
    targetPlayerName: string;
    destroyedCard: CardInstance;
    targetCost: number;
  }>;
  currentIndex: number;
}

export interface PendingGainBandingBonusPick {
  playerId: string;
  sourceCardName?: string;
  sourceCardInstanceId?: string;
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

export interface GalleryEventPlayerOutcome {
  playerId: string;
  playerName: string;
  cardName: string;
  definitionId: string;
  cardInstanceId: string;
  cost: number;
  gratiaCount: number;
}

export interface GalleryEventDecreeOutcome {
  playerId: string;
  playerName: string;
  cardName: string;
  cost: number;
  result: 'drawn' | 'destroyed' | 'kept';
}

export interface MassHandRedrawPlayerLog {
  playerId: string;
  playerName: string;
  discardedCardNames: string[];
  drewCount: number;
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
    eventOutcomes?: GalleryEventPlayerOutcome[];
    eventDecreeOutcomes?: GalleryEventDecreeOutcome[];
    destroyedCardNames?: string[];
    bandingFaction?: BandingFaction;
    deckTopRevealChoice?: 'destroy' | 'return';
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
  /** Cards played this turn, including those destroyed from play (OR self-destroy). */
  turnPlayedCards?: CardInstance[];
  /** Draw fewer cards at end of turn (Champion of Gaul loss). */
  drawPenalty?: number;
  /** Pompa — each card played produces at most this many coins this turn. */
  coinCapPerCardNextTurn?: number;
}

export interface GameState {
  id: string;
  status?: GameStatus;
  /** Optimistic-concurrency counter (server-managed). */
  version?: number;
  /**
   * State shape version. Bumped only for STRUCTURAL changes that an old snapshot
   * can't satisfy by defaulting a new optional field. See src/game/stateMigrations.ts.
   */
  schemaVersion?: number;
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
  /** Played Favor cards awaiting replay effects (e.g. Legendary Gladiator). */
  flavorDiscard?: CardInstance[];
  disfavorDeck: CardInstance[];
  turnPlayerId: string;
  phase: GamePhase;
  turnNumber: number;
  /**
   * One-shot banner shown to all players at game start, e.g.
   * "The Crowd has roared in favor of X to begin the games!".
   * Set on activation, cleared after the first turn passes.
   */
  gameStartAnnouncement?: string | null;
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
  /** Banding earned mid-effect — shown after interactive picks resolve */
  deferredBandingBonus?: PendingBandingBonus | null;
  /** Highlights opponent buy / arena for the active turn player */
  turnActionHighlight?: TurnActionHighlight | null;
  /** Face-up gallery event shown while resolving or acknowledging */
  /** Flipped gallery event awaiting dismiss / player responses */
  pendingGalleryEvent?: CardInstance | null;
  /** Per-player results from the active gallery event (e.g. Triumph of Rome). */
  galleryEventOutcomes?: GalleryEventPlayerOutcome[] | null;
  /** Per-player reveal results from Senate Decree. */
  galleryEventDecreeOutcomes?: GalleryEventDecreeOutcome[] | null;
  /** Epics cost this much less for the active player this turn (Victory). */
  turnEpicDiscount?: number;
  /** Faction cards cost this much less for the active player this turn (Commander). */
  turnFactionDiscount?: number;
  /** Item cards cost this much less for the active player this turn (Voice of Rome). */
  turnItemDiscount?: number;
  /** Extra Arena valor for the active player's challenge this turn (Bestiarii). */
  turnArenaValorBonus?: number;
  /** Next card gained this turn goes to hand instead of discard (Senator, The Republic). */
  turnNextGainToHand?: boolean;
  /** Active player may buy from the destroyed pile this turn (Lanista). */
  turnPurchaseFromDestroyed?: boolean;
  /** Arena was defeated this turn by the active player (Colosseum, Noblewoman). */
  turnArenaDefeated?: boolean;
  /** Grant this many Gratia if the active player defeats the Arena this turn (Noblewoman). */
  turnGratiaOnArenaVictory?: number;
  /** Cards flipped face-down in market, restored at the flipping player's next turn start. */
  flippedMarketCardIds?: string[];
  /** Owner of the active market flip (cards restored when their next turn begins). */
  flippedMarketByPlayerId?: string | null;
  /** Gallery slots to refill at end of turn (deferred destroy effects). */
  deferredGalleryRefillSlots?: number;
  /** Epic slots to refill at end of turn (Damnatio, etc.). */
  deferredEpicRefillSlots?: number;
  /** Transient — Manipulator redraw details for the current action log line. */
  lastMassHandRedrawLog?: MassHandRedrawPlayerLog[] | null;
  /** Players who must pick hand cards for a gallery event (Plague, Barbarian Incursion, etc.) */
  pendingEventHandChoices?: PendingEventHandChoice[];
  /** @deprecated use pendingEventHandChoices */
  pendingEventDiscards?: string[];
  /** Players who must choose an Item to lose (Requisition) */
  pendingEventItemChoices?: PendingEventItemChoice[];
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
  /** Beneficiary picks a card for Arena Wager */
  pendingFavorArenaWagerPick?: {
    beneficiaryId: string;
    sourceCardName?: string;
  } | null;
  /** Pick a played Favor from the discard pile to replay (Legendary). */
  pendingFavorReplayPick?: {
    playerId: string;
    sourceCardName?: string;
    sourceCardInstanceId?: string;
    removeFromGame?: boolean;
  } | null;
  /** Favor replayed via Legendary — remove from game after resolving. */
  pendingFavorReplayRemovalId?: string | null;
  /** Oracle's Warning etc. — interactive picks deferred until favor reveal finishes. */
  pendingFavorFollowUp?: PendingFavorFollowUp | null;
  /** Revealed Arena Wager outcome (shown before dismiss) */
  lastArenaWagerResult?: ArenaWagerResult | null;
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
    /** Retiarius-style optional block: draw/favor after destroy */
    optionalBlockFollowUp?: Record<string, unknown>;
    /** Flamma: only Crowd Disfavor cards are valid targets */
    disfavorOnly?: boolean;
    /** Flamma: draw this many cards per card destroyed */
    drawPerDestroyed?: number;
    /** Unstoppable Legion: after destroying, gain a market card costing destroyed+offset */
    dynamicGainOffset?: number;
    /** Highest cost destroyed so far (for dynamic gain). */
    destroyedMaxCost?: number;
  } | null;
  /** Pick cards in the Gallery row to destroy */
  pendingGalleryDestroyPick?: {
    playerId: string;
    remaining: number;
    sourceCardName?: string;
    sourceCardInstanceId?: string;
    deferRemainingEffects?: boolean;
    refillGallery?: boolean;
    optional?: boolean;
    deferredRefillAtEnd?: boolean;
    destroyedSoFar?: number;
  } | null;
  /** Active player must destroy an Epic from the market row (Damnatio). */
  pendingEpicDestroyPick?: {
    playerId: string;
    sourceCardName?: string;
    sourceCardInstanceId?: string;
    replaceAtEndOfTurn?: boolean;
  } | null;
  /** Pick a card from any player's discard pile */
  pendingAnyDiscardDestroyPick?: {
    playerId: string;
    remaining: number;
    sourceCardName?: string;
    sourceCardInstanceId?: string;
    deferRemainingEffects?: boolean;
    /** Exclude the active player's own discard pile (Siege Master). */
    opponentsOnly?: boolean;
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
  /** Pick a market card to gain (Black Market Deal, Encampment, etc.) */
  pendingGainCardPick?: PendingGainCardPick | null;
  /** Medicus — gain pick deferred until favor / deck-look prompts finish */
  deferredGainCardPick?: PendingGainCardPick | null;
  /** Pick a market card to copy (Veteran) */
  pendingCopyCardPick?: PendingCopyCardPick | null;
  /** Put a card from discard on top/bottom of deck (Statesman, Veteran) */
  pendingPlaceCardOnDeckPick?: PendingPlaceCardOnDeckPick | null;
  /** Look at / reorder top of a deck (Tribune) */
  pendingDeckLookPick?: PendingDeckLookPick | null;
  /** Crowd Frenzy — replace destroyed deck tops from market */
  pendingCrowdFrenzyPick?: PendingCrowdFrenzyPick | null;
  /** Centurion Baton — reveal deck top, optionally draw it */
  pendingItemDeckPeek?: PendingItemDeckPeek | null;
  /** Executioner — reveal each player's deck top; destroy or return */
  pendingDeckTopRevealPick?: PendingDeckTopRevealPick | null;
  /** Choose a faction banding bonus to gain (Preparation) */
  pendingGainBandingBonusPick?: PendingGainBandingBonusPick | null;
  /** Optional: place a destroyed card onto the market supply deck (Patron) */
  pendingPlaceDestroyedOnMarketPick?: PendingPlaceDestroyedOnMarketPick | null;
  /** Put a card from discard into hand (Supply Wagon, Germanicus) */
  pendingReturnCardToHandPick?: PendingReturnCardToHandPick | null;
  /** Bribery — pick opponent, reveal a random hand card, optionally play it */
  pendingBriberyPick?: PendingBriberyPick | null;
  /** Reveal favors and keep some (Praeco, Vestal Priestess) */
  pendingRevealFavorsPick?: PendingRevealFavorsPick | null;
  /** Flip up to N market cards face down (Sententia) */
  pendingFlipMarketPick?: PendingFlipMarketPick | null;
  /** Names of gallery cards destroyed by the current event (Slave Revolt log) */
  lastEventGalleryDestroyNames?: string[] | null;
  /** Extra arena valor from sabotage cards played as hinder */
  arenaSabotageValorByPlayerId?: Record<string, number>;
  /** Number of sabotages cancelled by support responses this challenge (Rudiarii). */
  arenaSabotagesCancelled?: number;
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
  /** How many upcoming turns the purchase cap remains in effect (1 per player). */
  purchaseCostCapTurnsRemaining?: number | null;
  /** Card definition id of the event enforcing the purchase cap (Grain Shortage). */
  purchaseCostCapSourceCardId?: string | null;
  /** Label shown as the header for a pending gallery event (e.g. "Ivory Dice"). */
  pendingGalleryEventSourceLabel?: string | null;
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
