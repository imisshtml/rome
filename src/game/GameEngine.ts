import { CardInstance, CardLocation } from '../types/cardTypes';
import { GameAction, GameActionType, GamePhase, GameState, PlayerState } from '../types/gameTypes';
import { canPerformAction } from './TurnManager';
import { finishGameIfNeeded, getPlayerTotalVp } from './postGame';
import { applyStructuredPlayEffects, getLegacyCoinGain } from './EffectResolver';
import {
  isSpyFactionChoice,
  requiresFactionChoiceOnPlay,
} from '../utils/cardFactionUtils';
import {
  summarizeCardBuyEffect,
  summarizeCardPlayEffect,
} from '../utils/cardLogUtils';
import {
  refillPlayerDeckFromDiscard,
  splitPlayerDeckCycleCards,
} from '../utils/deckCycleUtils';
import { pickForcedDiscardCard } from '../utils/forcedDiscardUtils';
import { pickAiDisplayNames } from '../utils/aiPlayerNames';
import {
  normalizeDestroyFromZones,
  playerHasDestroyTargetsInZones,
} from '../utils/cardDestroyUtils';
import {
  anyPlayerHasDiscardTarget,
  anyOpponentHasDiscardTarget,
  canFulfillPlayDestroyRequirements,
  destroyDefersOtherEffects,
  getGalleryDestroyCount,
  getDestroyEpicCount,
  getHandDiscardDestroySpec,
  getOptionalBlockDestroySpec,
  getOptionalBlockFollowUp,
  getOrEffectBranches,
  getRawEffects,
  getReplayFavorFromDiscardSpec,
  hasAnyDiscardDestroy,
  hasDestroyHandForCoins,
  hasOrEffectChoice,
  isUpToGalleryDestroyText,
  playerCanFulfillHandDiscardDestroy,
} from '../utils/playDestroyUtils';
import { skipOrChoiceOnMainPlay, getGainCardSpec, getConditionalPlayEffect, getOptionalPlaceDestroyedOnMarket, getPlaceCardOnDeckSpec, getSabotageArenaBonus, getSabotageDrawCards, isCardEligibleForGainPick, listEligibleDestroyedGainCards, listEligibleDestroyedPlaceCards, listEligibleInPlayCopyCards, listEligibleMarketCopyCards, listEligibleMarketGainCards, listEligiblePlaceOnDeckCards, meetsConditionalPlayedFactions, shouldDeferEpicRefill, capCoinGainForPlayer, wantsDeckTopRevealPick, cardHasOnGainEffects } from '../utils/effectFlowUtils';
import { beginDeckTopRevealPick, getCurrentDeckTopRevealPick } from '../utils/deckTopRevealUtils';
import {
  applyMassHandRedraw,
  formatMassHandRedrawSummary,
} from '../utils/massRedrawUtils';
import {
  canAffordPurchase,
  getEffectivePurchaseCost,
} from '../utils/purchaseCostUtils';
import {
  beginHandDiscardIfNeeded,
  beginInteractivePlayPicks,
  applyOnGainEffects,
  finishGainCardPick,
  gainDestroyedCardToPlayer,
  gainMarketCardToPlayer,
  galleryDestroyRefillImmediate,
  peekPlayerDeckTop,
  placeDestroyedCardOnMarketSupply,
  reorderDeckKeepTop,
} from './playEffectFlow';
import { addToDestroyedPile } from '../utils/destroyedPileUtils';
import {
  isOpeningGamesArena,
  mustEnterArenaBeforeEndTurn,
  getArenaMaxCommit,
  isValidArenaCommitCount,
} from '../utils/arenaUtils';
import {
  applyAutomaticArenaLoss,
  arenaLossNeedsPrompt,
  beginPendingArenaLoss,
  destroyFighterFromDiscard,
  getFighterStrength,
  giveDisfavorToPlayer,
  getPrimusDestroyCandidates,
  parseArenaLossSpec,
} from '../utils/arenaLossUtils';
import {
  buildArenaWagerEntries,
  favorIsArenaWager,
  formatArenaWagerLogSummary,
  pickBestArenaWagerOwnCard,
  resolveArenaWagerWinners,
} from '../utils/arenaWagerUtils';
import {
  BANDING_BONUS_LABEL,
  BandingFaction,
  chooseSpyFactionForAI,
  detectTriggeredBandingFaction,
  pickAICardToPlayFirst,
} from '../utils/bandingUtils';
import {
  getFilteredGalleryPoolEntries,
  getFilteredStartingDeckEntries,
} from '../utils/testDeckConfig';
import {
  awardOptionalEventDiscardCoins,
  beginGalleryEventResolution,
  drawGallerySupplyCard,
  ejectStrayGalleryEvents,
  fillGalleryRowFromSupply,
  finishEventItemLossPick,
  galleryRefillPaused,
  getPendingEventHandChoiceForPlayer,
  getPendingEventHandChoicePlayerIds,
  getPendingEventItemChoicePlayerIds,
  handCardValidForEventChoice,
  GALLERY_ROW_SIZE,
} from './EventResolver';
import {
  beginFavorArenaWagerPick,
  beginFavorDestroyPick,
  beginFavorResolution,
  favorIsOptional,
  favorNeedsDestroyPick,
  favorResolutionPaused,
  finishFavorResolution,
  processFavorQueue,
} from './FavorResolver';
import {
  CROWD_DISFAVOR,
  GRATIA_SUPPLY,
  getCardDefinition,
  getGalleryPoolEntries,
  getRecruitPoolEntries,
  getEpicPoolEntries,
  getArenaPoolEntries,
  getFlavorPoolEntries,
  getOpeningGamesArenaDefinitionId,
  isGalleryEventCard,
  isFavorDefinitionId,
  isPurchasableMarketCard,
} from './CardDefinitions';

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
export const ARENA_MAX_COMMIT = 3;
export const STARTING_HAND_SIZE = 5;

export const ARENA_CHALLENGE_STATS: Record<
  string,
  { requiredValor: number; rewardVp: number }
> = {};

const EPIC_ROW_SIZE = 3;

let instanceCounter = 0;
const nextInstanceId = () => `card_${++instanceCounter}`;

export interface PlayerSetup {
  id: string;
  name: string;
  isAI?: boolean;
}

function createCardInstance(
  definitionId: string,
  location: CardLocation,
  ownerId: string,
  faceUp = false
): CardInstance {
  const definition = getCardDefinition(definitionId);
  return {
    instanceId: nextInstanceId(),
    definitionId: definition.id,
    definition,
    location,
    ownerId,
    faceUp,
  };
}

function buildPoolInstances(
  entries: { definitionId: string; qty: number }[],
  location: CardLocation,
  ownerId: string,
  faceUp = false
): CardInstance[] {
  return shuffle(
    entries.flatMap(({ definitionId, qty }) =>
      Array.from({ length: qty }, () =>
        createCardInstance(definitionId, location, ownerId, faceUp)
      )
    )
  );
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createStartingDeck(playerId: string): CardInstance[] {
  const cards = getFilteredStartingDeckEntries().flatMap(({ definitionId, qty }) =>
    Array.from({ length: qty }, () =>
      createCardInstance(definitionId, 'DECK', playerId)
    )
  );
  return shuffle(cards);
}

function createPlayer(setup: PlayerSetup, dealOpeningHand = false): PlayerState {
  const deck = createStartingDeck(setup.id);
  const hand = dealOpeningHand
    ? deck.splice(0, STARTING_HAND_SIZE).map((c) => ({
        ...c,
        location: 'HAND' as const,
        faceUp: true,
      }))
    : [];
  return {
    id: setup.id,
    name: setup.name,
    isAI: setup.isAI ?? false,
    victoryPoints: 0,
    hand,
    deck,
    discard: [],
    playArea: [],
    itemsInPlay: [],
  };
}

function setupInitialGalleryRow(shuffledSupply: CardInstance[]): {
  galleryCards: CardInstance[];
  gallerySupply: CardInstance[];
} {
  const supply = [...shuffledSupply];
  const galleryCards: CardInstance[] = [];
  let rejectedInRow = 0;

  while (galleryCards.length < GALLERY_ROW_SIZE && supply.length > 0) {
    const drawn = supply.shift()!;
    if (isGalleryEventCard(drawn)) {
      supply.push(drawn);
      rejectedInRow++;
      if (rejectedInRow >= supply.length) {
        break;
      }
      continue;
    }
    rejectedInRow = 0;
    galleryCards.push({
      ...drawn,
      location: 'GALLERY',
      faceUp: true,
    });
  }

  return {
    galleryCards,
    gallerySupply: shuffle(supply),
  };
}

function setupRecruitPile(): {
  recruitCard: CardInstance | null;
  recruitDeck: CardInstance[];
} {
  const shuffled = buildPoolInstances(
    getRecruitPoolEntries(),
    'RECRUIT_DECK',
    'market',
    false
  );
  const recruitCard =
    shuffled.length > 0
      ? { ...shuffled.shift()!, location: 'RECRUIT' as const, faceUp: true }
      : null;
  return { recruitCard, recruitDeck: shuffled };
}

function setupArenaSupply(): {
  arenaCard: CardInstance | null;
  arenaDeck: CardInstance[];
} {
  const openingId = getOpeningGamesArenaDefinitionId();
  const arenaDeck = shuffle(
    buildPoolInstances(getArenaPoolEntries(), 'ARENA_DECK', 'arena', false)
  );
  const arenaCard = openingId
    ? {
        ...createCardInstance(openingId, 'ARENA', 'arena', true),
        location: 'ARENA' as const,
        faceUp: true,
      }
    : arenaDeck.length > 0
      ? { ...arenaDeck.shift()!, location: 'ARENA' as const, faceUp: true }
      : null;

  return { arenaCard, arenaDeck };
}

function createMarketCards() {
  const shuffledGalleryPool = buildPoolInstances(
    getFilteredGalleryPoolEntries(),
    'GALLERY',
    'market',
    false
  );
  const { galleryCards, gallerySupply } = setupInitialGalleryRow(
    shuffledGalleryPool
  );

  const { arenaCard, arenaDeck } = setupArenaSupply();

  const epicSupply = buildPoolInstances(
    getEpicPoolEntries(),
    'EPIC_ROW',
    'market',
    false
  );
  const epicCards = epicSupply.splice(0, EPIC_ROW_SIZE).map((c) => ({
    ...c,
    faceUp: true,
  }));

  const flavorDeck = buildPoolInstances(
    getFlavorPoolEntries(),
    'FLAVOR_DECK',
    'market',
    false
  );

  const disfavorDeck = [
    createCardInstance(CROWD_DISFAVOR.id, 'DISFAVOR_DECK', 'market', true),
  ];

  const { recruitCard, recruitDeck } = setupRecruitPile();

  return {
    galleryCards,
    gallerySupply,
    recruitCard,
    recruitDeck,
    arenaCard,
    arenaDeck,
    epicCards,
    epicSupply,
    flavorDeck,
    flavorDiscard: [],
    disfavorDeck,
  };
}

function isFirstCardPlayedThisTurn(
  player: PlayerState,
  sourceCardInstanceId: string
): boolean {
  const played = [...player.playArea, ...player.itemsInPlay];
  return (
    played.length === 1 && played[0].instanceId === sourceCardInstanceId
  );
}

function filterOrEffectBranches(
  card: CardInstance,
  player: PlayerState
): Record<string, unknown>[] {
  return getOrEffectBranches(card).filter((branch) => {
    if (branch.if_first_card_played) {
      return isFirstCardPlayedThisTurn(player, card.instanceId);
    }
    return true;
  });
}

function applyImperialTaxIfPending(
  state: GameState,
  playerIdx: number,
  coinGainFromPlay: number
): GameState {
  const player = state.players[playerIdx];
  if (!player?.imperialTaxPending || coinGainFromPlay <= 0 || state.turnCoins <= 0) {
    return state;
  }

  const players = [...state.players];
  players[playerIdx] = { ...player, imperialTaxPending: false };
  return {
    ...state,
    players,
    turnCoins: Math.max(0, state.turnCoins - 1),
  };
}

function applyOnPlayPassiveEffects(
  state: GameState,
  playerIdx: number,
  card: CardInstance
): GameState {
  const passive = getRawEffects(card).passive as Record<string, unknown> | undefined;
  const cap = passive?.opponent_coin_cap_per_card;
  if (typeof cap !== 'number' || cap <= 0) return state;

  const controllerId = state.players[playerIdx].id;
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === controllerId ? p : { ...p, coinCapPerCardNextTurn: cap }
    ),
  };
}

function beginPlaceCardOnDeckIfNeeded(
  state: GameState,
  playerIdx: number,
  card: CardInstance
): GameState {
  if (state.pendingPlaceCardOnDeckPick) return state;

  const spec = getPlaceCardOnDeckSpec(card);
  if (!spec) return state;

  const player = state.players[playerIdx];
  const eligible = listEligiblePlaceOnDeckCards(player, spec);
  if (eligible.length === 0) return state;

  return {
    ...state,
    pendingPlaceCardOnDeckPick: {
      playerId: player.id,
      sourceCardName: card.definition.name,
      sourceCardInstanceId: card.instanceId,
      optional: spec.optional,
      faction: spec.faction,
      anyFaction: spec.anyFaction,
      position: spec.position,
    },
  };
}

function placeCardFromDiscardOnDeck(
  player: PlayerState,
  cardInstanceId: string,
  position: 'top' | 'bottom'
): PlayerState | null {
  const idx = player.discard.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx === -1) return null;

  const card = {
    ...player.discard[idx],
    location: 'DECK' as const,
    faceUp: false,
  };
  const discard = player.discard.filter((_, i) => i !== idx);
  const deck =
    position === 'top'
      ? [card, ...player.deck]
      : [...player.deck, card];

  return { ...player, discard, deck };
}

function applyCardPlayEffects(
  state: GameState,
  playerIdx: number,
  card: CardInstance,
  options?: { skipDestroy?: boolean; skipOr?: boolean }
): GameState {
  let next = state;
  let coinGain = 0;
  const effects = card.definition.effects as
    | (typeof card.definition.effects & { gain_gratia?: number })
    | undefined;
  const player = state.players[playerIdx];

  if (
    !options?.skipOr &&
    hasOrEffectChoice(card) &&
    !skipOrChoiceOnMainPlay(card)
  ) {
    const branches = filterOrEffectBranches(card, player);
    return {
      ...state,
      pendingOrEffectChoice: {
        playerId: player.id,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        baseGainCoins: effects?.gain_coins ?? 0,
        branches,
      },
    };
  }

  const handDiscardSpec =
    options?.skipDestroy ? null : getHandDiscardDestroySpec(card);
  const galleryDestroyCount =
    options?.skipDestroy ? 0 : getGalleryDestroyCount(card);

  if (
    !options?.skipDestroy &&
    handDiscardSpec &&
    !handDiscardSpec.optional &&
    handDiscardSpec.deferOtherEffects &&
    playerCanFulfillHandDiscardDestroy(player, handDiscardSpec)
  ) {
    return {
      ...state,
      pendingCardDestroyPick: {
        playerId: player.id,
        remaining: handDiscardSpec.count,
        fromZones: handDiscardSpec.fromZones,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        deferRemainingEffects: true,
      },
    };
  }

  if (
    !options?.skipDestroy &&
    hasAnyDiscardDestroy(card) &&
    anyOpponentHasDiscardTarget(state, player.id)
  ) {
    return {
      ...state,
      pendingAnyDiscardDestroyPick: {
        playerId: player.id,
        remaining: (getRawEffects(card).destroy_cards as number) ?? 1,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        deferRemainingEffects: destroyDefersOtherEffects(card),
        opponentsOnly: true,
      },
    };
  }

  if (
    !options?.skipDestroy &&
    galleryDestroyCount > 0 &&
    state.galleryCards.some((c) => !isGalleryCardPurchased(state, c.instanceId))
  ) {
    const defer = destroyDefersOtherEffects(card);
    const refillNow = galleryDestroyRefillImmediate(card);
    if (defer) {
      return {
        ...state,
        pendingGalleryDestroyPick: {
          playerId: player.id,
          remaining: galleryDestroyCount,
          sourceCardName: card.definition.name,
          sourceCardInstanceId: card.instanceId,
          deferRemainingEffects: true,
          refillGallery: refillNow,
        },
      };
    }
  }

  if (effects) {
    coinGain = effects.gain_coins ?? 0;
    const massRedraw = getRawEffects(card).mass_hand_redraw as
      | { draw_delta?: number }
      | undefined;
    const drawForEffects = (player: PlayerState, drawCount: number) => {
      const drawn = drawCardsIntoState(next, player, drawCount);
      next = drawn.state;
      return drawn.player;
    };
    const structuredEffects = massRedraw
      ? ({ ...effects, draw_cards: 0 } as typeof effects)
      : effects;
    next = applyStructuredPlayEffects(
      next,
      playerIdx,
      card,
      structuredEffects,
      drawForEffects
    );

    if (massRedraw) {
      const redraw = applyMassHandRedraw(
        next,
        drawForEffects,
        massRedraw.draw_delta ?? -1
      );
      next = redraw.state;
      const bonusDraw = effects.draw_cards ?? 0;
      if (bonusDraw > 0) {
        const drawn = drawCardsIntoState(next, next.players[playerIdx], bonusDraw);
        next = drawn.state;
        const players = [...next.players];
        players[playerIdx] = drawn.player;
        next = { ...next, players };
      }
      next = {
        ...next,
        lastMassHandRedrawLog: redraw.playerLogs,
      };
    }

    const gratiaGain = effects.gain_gratia ?? 0;
    if (gratiaGain > 0) {
      let player = { ...next.players[playerIdx], discard: [...next.players[playerIdx].discard] };
      for (let i = 0; i < gratiaGain; i++) {
        player.discard.push(
          createCardInstance(GRATIA_SUPPLY.id, 'DISCARD', player.id, true)
        );
      }
      const players = [...next.players];
      players[playerIdx] = player;
      next = { ...next, players };
    }

    const favorGain =
      (effects.gain_imperial_favor ?? 0) +
      (Number(getRawEffects(card).gain_favor) || 0);
    if (favorGain > 0) {
      let player = next.players[playerIdx];
      for (let i = 0; i < favorGain; i++) {
        const gained = gainFlavorCard(next, player);
        next = gained.state;
        player = gained.player;
      }
      const players = [...next.players];
      players[playerIdx] = player;
      next = { ...next, players };
    }
  } else {
    coinGain = getLegacyCoinGain(card);
    const valor = card.definition.valor ?? 0;
    if (coinGain === 0 && valor === 0) return state;
    next = {
      ...state,
      turnCoins: state.turnCoins + coinGain,
    };
  }

  const conditional = getConditionalPlayEffect(card);
  if (
    conditional &&
    meetsConditionalPlayedFactions(next.players[playerIdx], conditional.if_played_factions)
  ) {
    if (conditional.draw_cards && conditional.draw_cards > 0) {
      const drawn = drawCardsIntoState(
        next,
        next.players[playerIdx],
        conditional.draw_cards
      );
      next = drawn.state;
      const players = [...next.players];
      players[playerIdx] = drawn.player;
      next = { ...next, players };
    }
    if (conditional.gain_coins && conditional.gain_coins > 0) {
      const capped = capCoinGainForPlayer(
        next.players[playerIdx],
        conditional.gain_coins
      );
      next = {
        ...next,
        turnCoins: next.turnCoins + capped,
      };
      coinGain += capped;
    }
    const conditionalFavor = Number(
      conditional.gain_imperial_favor ?? conditional.gain_favor ?? 0
    );
    if (conditionalFavor > 0) {
      let beneficiary = next.players[playerIdx];
      for (let i = 0; i < conditionalFavor; i++) {
        const gained = gainFlavorCard(next, beneficiary);
        next = gained.state;
        beneficiary = gained.player;
      }
      const players = [...next.players];
      players[playerIdx] = beneficiary;
      next = { ...next, players };
    }
  }

  const discardCount = effects?.discard_cards ?? 0;
  const forceOpponentDiscard = effects?.force_opponent_discard ?? 0;
  if (
    discardCount > 0 &&
    forceOpponentDiscard <= 0 &&
    !getGainCardSpec(card)
  ) {
    next = beginHandDiscardIfNeeded(next, playerIdx, card, false);
  }

  if (hasDestroyHandForCoins(card) && next.players[playerIdx].hand.length > 0) {
    next = {
      ...next,
      pendingCardDestroyPick: {
        playerId: next.players[playerIdx].id,
        remaining: 1,
        fromZones: ['hand'],
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        rewardCoinsFromCost: true,
      },
    };
    return applyImperialTaxIfPending(next, playerIdx, coinGain);
  }

  if (
    !options?.skipDestroy &&
    handDiscardSpec &&
    !handDiscardSpec.optional &&
    !handDiscardSpec.deferOtherEffects &&
    playerCanFulfillHandDiscardDestroy(next.players[playerIdx], handDiscardSpec)
  ) {
    next = {
      ...next,
      pendingCardDestroyPick: {
        playerId: next.players[playerIdx].id,
        remaining: handDiscardSpec.count,
        fromZones: handDiscardSpec.fromZones,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        deferRemainingEffects: false,
      },
    };
  }

  const optionalSpec = options?.skipDestroy ? null : getOptionalBlockDestroySpec(card);
  if (
    optionalSpec &&
    playerCanFulfillHandDiscardDestroy(next.players[playerIdx], optionalSpec)
  ) {
    next = {
      ...next,
      pendingCardDestroyPick: {
        playerId: next.players[playerIdx].id,
        remaining: optionalSpec.count,
        fromZones: optionalSpec.fromZones,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        deferRemainingEffects: false,
        optional: true,
        optionalBlockFollowUp: getOptionalBlockFollowUp(card) ?? undefined,
      },
    };
  } else if (
    !options?.skipDestroy &&
    handDiscardSpec?.optional &&
    playerCanFulfillHandDiscardDestroy(next.players[playerIdx], handDiscardSpec)
  ) {
    next = {
      ...next,
      pendingCardDestroyPick: {
        playerId: next.players[playerIdx].id,
        remaining: handDiscardSpec.count,
        fromZones: handDiscardSpec.fromZones,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        deferRemainingEffects: false,
        optional: true,
      },
    };
  }

  if (
    !options?.skipDestroy &&
    galleryDestroyCount > 0 &&
    !destroyDefersOtherEffects(card)
  ) {
    const optionalGallery = isUpToGalleryDestroyText(card);
    const hasTargets = next.galleryCards.some(
      (c) => !isGalleryCardPurchased(next, c.instanceId)
    );
    if (hasTargets || optionalGallery) {
      const batchRefill =
        galleryDestroyCount > 1 || !galleryDestroyRefillImmediate(card);
      next = {
        ...next,
        pendingGalleryDestroyPick: {
          playerId: next.players[playerIdx].id,
          remaining: galleryDestroyCount,
          sourceCardName: card.definition.name,
          sourceCardInstanceId: card.instanceId,
          deferRemainingEffects: false,
          refillGallery: !batchRefill,
          optional: optionalGallery,
          deferredRefillAtEnd: galleryDestroyRefillImmediate(card) === false,
          destroyedSoFar: 0,
        },
      };
    }
  }

  const destroyEpicCount =
    options?.skipDestroy ? 0 : getDestroyEpicCount(card);
  if (destroyEpicCount > 0 && next.epicCards.length > 0) {
    next = {
      ...next,
      pendingEpicDestroyPick: {
        playerId: next.players[playerIdx].id,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        replaceAtEndOfTurn: shouldDeferEpicRefill(card),
      },
    };
  }

  if (
    !options?.skipDestroy &&
    wantsDeckTopRevealPick(card)
  ) {
    next = beginDeckTopRevealPick(next, playerIdx, card);
    if (next.pendingDeckTopRevealPick) {
      return applyImperialTaxIfPending(next, playerIdx, coinGain);
    }
  }

  next = beginInteractivePlayPicks(next, playerIdx, card, (_, id) =>
    !isGalleryCardPurchased(next, id)
  );
  if (!next.pendingGainCardPick) {
    next = beginHandDiscardIfNeeded(next, playerIdx, card, true);
  }

  next = beginPlaceCardOnDeckIfNeeded(next, playerIdx, card);

  if (
    !options?.skipDestroy &&
    getOptionalPlaceDestroyedOnMarket(card) &&
    !next.pendingPlaceDestroyedOnMarketPick &&
    !next.pendingGainCardPick &&
    !next.pendingCopyCardPick &&
    !next.pendingDeckLookPick &&
    !next.pendingGainBandingBonusPick &&
    listEligibleDestroyedPlaceCards(next).length > 0
  ) {
    next = {
      ...next,
      pendingPlaceDestroyedOnMarketPick: {
        playerId: next.players[playerIdx].id,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        optional: true,
      },
    };
  }

  const replaySpec = getReplayFavorFromDiscardSpec(card);
  if (
    !options?.skipDestroy &&
    replaySpec &&
    (next.flavorDiscard?.length ?? 0) > 0
  ) {
    next = {
      ...next,
      pendingFavorReplayPick: {
        playerId: next.players[playerIdx].id,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        removeFromGame: replaySpec.removeFromGame,
      },
    };
  }

  return applyOnPlayPassiveEffects(
    applyImperialTaxIfPending(next, playerIdx, coinGain),
    playerIdx,
    card
  );
}

function applyFavorEffects(
  state: GameState,
  playerIdx: number,
  card: CardInstance,
  options?: { skipDestroy?: boolean }
): GameState {
  if (options?.skipDestroy) {
    const effects = card.definition.effects;
    if (!effects) return state;
    const stubEffects = {
      ...effects,
      destroy_cards: 0,
      destroy_from: [] as string[],
    };
    delete (stubEffects as { optional?: boolean }).optional;
    const stubCard: CardInstance = {
      ...card,
      definition: { ...card.definition, effects: stubEffects },
    };
    let next = applyCardPlayEffects(state, playerIdx, stubCard);
    return maybeBeginForcedOpponentDiscards(next, playerIdx, card);
  }
  let next = applyCardPlayEffects(state, playerIdx, card);
  next = maybeBeginForcedOpponentDiscards(next, playerIdx, card);
  return next;
}

function applyArenaWagerRewards(
  state: GameState,
  entries: ReturnType<typeof buildArenaWagerEntries>,
  winnerIds: string[],
  gratiaPerWinner: number
): GameState {
  if (!entries || entries.length === 0) return state;

  let next: GameState = { ...state, players: [...state.players] };
  const participantIds = new Set(entries.map((e) => e.playerId));

  for (let i = 0; i < next.players.length; i++) {
    const playerId = next.players[i].id;
    if (!participantIds.has(playerId)) continue;

    let player = { ...next.players[i], discard: [...next.players[i].discard] };

    if (winnerIds.includes(playerId)) {
      for (let g = 0; g < gratiaPerWinner; g++) {
        player.discard.push(
          createCardInstance(GRATIA_SUPPLY.id, 'DISCARD', player.id, true)
        );
      }
      next.players[i] = player;
      continue;
    }

    const result = giveDisfavorToPlayer(next, player, 1);
    next = { ...next, disfavorDeck: result.state.disfavorDeck };
    next.players[i] = result.player;
  }

  return next;
}

function applyForcedOpponentDiscard(
  state: GameState,
  targetPlayerId: string,
  cardInstanceId: string
): GameState {
  const targetIdx = state.players.findIndex((p) => p.id === targetPlayerId);
  if (targetIdx === -1) return state;

  const target = { ...state.players[targetIdx] };
  const handIdx = target.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (handIdx === -1) return state;

  const card = {
    ...target.hand[handIdx],
    location: 'DISCARD' as const,
    faceUp: true,
    chosenFaction: undefined,
  };
  target.hand = target.hand.filter((_, i) => i !== handIdx);
  target.discard = [...target.discard, card];

  const players = [...state.players];
  players[targetIdx] = target;
  return { ...state, players };
}

function removeCardFromPlayerZone(
  player: PlayerState,
  cardInstanceId: string,
  zone: CardLocation
): { player: PlayerState; card: CardInstance | null } {
  if (zone === 'HAND') {
    const idx = player.hand.findIndex((c) => c.instanceId === cardInstanceId);
    if (idx === -1) return { player, card: null };
    const card = player.hand[idx];
    return {
      player: { ...player, hand: player.hand.filter((_, i) => i !== idx) },
      card,
    };
  }
  if (zone === 'DISCARD') {
    const idx = player.discard.findIndex((c) => c.instanceId === cardInstanceId);
    if (idx === -1) return { player, card: null };
    const card = player.discard[idx];
    return {
      player: { ...player, discard: player.discard.filter((_, i) => i !== idx) },
      card,
    };
  }
  if (zone === 'PLAY_AREA') {
    const idx = player.playArea.findIndex((c) => c.instanceId === cardInstanceId);
    if (idx === -1) return { player, card: null };
    const card = player.playArea[idx];
    return {
      player: { ...player, playArea: player.playArea.filter((_, i) => i !== idx) },
      card,
    };
  }
  return { player, card: null };
}

function applyOptionalBlockFollowUp(
  state: GameState,
  playerIdx: number,
  followUp: Record<string, unknown>
): GameState {
  let next = state;
  const drawCount = (followUp.draw_cards as number | undefined) ?? 0;
  if (drawCount > 0) {
    const drawn = drawCardsIntoState(next, next.players[playerIdx], drawCount);
    next = drawn.state;
    const players = [...next.players];
    players[playerIdx] = drawn.player;
    next = { ...next, players };
  }

  const favorGain = Number(
    followUp.gain_favor ?? followUp.gain_imperial_favor ?? 0
  );
  if (favorGain > 0) {
    let player = next.players[playerIdx];
    for (let i = 0; i < favorGain; i++) {
      const gained = gainFlavorCard(next, player);
      next = gained.state;
      player = gained.player;
    }
    const players = [...next.players];
    players[playerIdx] = player;
    next = { ...next, players };
  }

  return next;
}

function finishCardDestroyPick(
  state: GameState,
  playerIdx: number,
  pending: NonNullable<GameState['pendingCardDestroyPick']>
): GameState {
  let next: GameState = { ...state, pendingCardDestroyPick: null };
  if (pending.deferRemainingEffects && pending.sourceCardInstanceId) {
    const player = next.players[playerIdx];
    const played =
      player.playArea.find(
        (c) => c.instanceId === pending.sourceCardInstanceId
      ) ??
      player.itemsInPlay.find(
        (c) => c.instanceId === pending.sourceCardInstanceId
      );
    if (played) {
      next = applyCardPlayEffects(next, playerIdx, played, { skipDestroy: true });
    }
  }
  return next;
}

function destroyGalleryCard(
  state: GameState,
  instanceId: string,
  refill: boolean
): GameState {
  const card = state.galleryCards.find((c) => c.instanceId === instanceId);
  if (!card) return state;

  const galleryPurchasedBy = { ...(state.galleryPurchasedBy ?? {}) };
  delete galleryPurchasedBy[instanceId];

  let next = addToDestroyedPile(
    {
      ...state,
      galleryCards: state.galleryCards.filter((c) => c.instanceId !== instanceId),
      galleryPurchasedBy,
    },
    [card]
  );

  if (!refill) return next;

  return runGalleryRefill(next, 1);
}

function destroyGalleryCardAndRefill(
  state: GameState,
  instanceId: string
): GameState {
  return destroyGalleryCard(state, instanceId, true);
}

function findInPlayCopyTarget(
  state: GameState,
  instanceId: string
): CardInstance | undefined {
  for (const player of state.players) {
    const card = [...player.playArea, ...player.itemsInPlay].find(
      (c) => c.instanceId === instanceId
    );
    if (card) return card;
  }
  return undefined;
}

function pendingCopyCardPickLabel(
  pending: NonNullable<GameState['pendingCopyCardPick']>
): string {
  return pending.copySource === 'in_play'
    ? 'Choose a card in play to copy'
    : 'Choose a market card to copy';
}

function refillGallerySlots(state: GameState, count: number): GameState {
  return runGalleryRefill(state, count);
}

function destroyEpicMarketCard(state: GameState, instanceId: string): GameState {
  const epicIdx = state.epicCards.findIndex((c) => c.instanceId === instanceId);
  if (epicIdx === -1) return state;
  const card = state.epicCards[epicIdx];
  const newEpic = state.epicCards.filter((_, i) => i !== epicIdx);
  return addToDestroyedPile({ ...state, epicCards: newEpic }, [card]);
}

function finishGalleryDestroyPick(
  state: GameState,
  playerIdx: number,
  pending: NonNullable<GameState['pendingGalleryDestroyPick']>
): GameState {
  let next: GameState = { ...state, pendingGalleryDestroyPick: null };
  const destroyed = pending.destroyedSoFar ?? 0;
  if (destroyed > 0) {
    if (pending.deferredRefillAtEnd) {
      next = {
        ...next,
        deferredGalleryRefillSlots:
          (next.deferredGalleryRefillSlots ?? 0) + destroyed,
      };
    } else if (pending.refillGallery === false) {
      next = refillGallerySlots(next, destroyed);
    }
  }
  if (pending.deferRemainingEffects && pending.sourceCardInstanceId) {
    const player = next.players[playerIdx];
    const played =
      player.playArea.find(
        (c) => c.instanceId === pending.sourceCardInstanceId
      ) ??
      player.itemsInPlay.find(
        (c) => c.instanceId === pending.sourceCardInstanceId
      );
    if (played) {
      next = applyCardPlayEffects(next, playerIdx, played, { skipDestroy: true });
    }
  }
  return next;
}

function finishAnyDiscardDestroyPick(
  state: GameState,
  playerIdx: number,
  pending: NonNullable<GameState['pendingAnyDiscardDestroyPick']>
): GameState {
  let next: GameState = { ...state, pendingAnyDiscardDestroyPick: null };
  if (pending.deferRemainingEffects && pending.sourceCardInstanceId) {
    const player = next.players[playerIdx];
    const played =
      player.playArea.find(
        (c) => c.instanceId === pending.sourceCardInstanceId
      ) ??
      player.itemsInPlay.find(
        (c) => c.instanceId === pending.sourceCardInstanceId
      );
    if (played) {
      next = applyCardPlayEffects(next, playerIdx, played, { skipDestroy: true });
    }
  }
  return next;
}

function destroySourceCardFromPlay(
  state: GameState,
  playerIdx: number,
  sourceCardInstanceId: string
): GameState {
  let player = { ...state.players[playerIdx] };
  let card: CardInstance | null = null;
  const playIdx = player.playArea.findIndex(
    (c) => c.instanceId === sourceCardInstanceId
  );
  if (playIdx !== -1) {
    card = player.playArea[playIdx];
    player.playArea = player.playArea.filter((_, i) => i !== playIdx);
  } else {
    const itemIdx = player.itemsInPlay.findIndex(
      (c) => c.instanceId === sourceCardInstanceId
    );
    if (itemIdx !== -1) {
      card = player.itemsInPlay[itemIdx];
      player.itemsInPlay = player.itemsInPlay.filter((_, i) => i !== itemIdx);
    }
  }
  if (!card) return state;
  const players = [...state.players];
  players[playerIdx] = player;
  return addToDestroyedPile({ ...state, players }, [
    { ...card, ownerId: player.id },
  ]);
}

function applyBranchEffects(
  state: GameState,
  playerIdx: number,
  branch: Record<string, unknown>,
  sourceCard: CardInstance
): GameState {
  if (branch.destroy_self) {
    let next = destroySourceCardFromPlay(
      state,
      playerIdx,
      sourceCard.instanceId
    );
    const coins = Number(branch.gain_coins ?? 0);
    if (coins > 0) {
      next = { ...next, turnCoins: next.turnCoins + coins };
      next = applyImperialTaxIfPending(next, playerIdx, coins);
    }
    const drawCount = Number(branch.draw_cards ?? 0);
    if (drawCount > 0) {
      const drawn = drawCardsIntoState(next, next.players[playerIdx], drawCount);
      next = drawn.state;
      const players = [...next.players];
      players[playerIdx] = drawn.player;
      next = { ...next, players };
    }
    const favorGain = Number(
      branch.gain_imperial_favor ?? branch.gain_favor ?? 0
    );
    if (favorGain > 0) {
      let beneficiary = next.players[playerIdx];
      for (let i = 0; i < favorGain; i++) {
        const gained = gainFlavorCard(next, beneficiary);
        next = gained.state;
        beneficiary = gained.player;
      }
      const players = [...next.players];
      players[playerIdx] = beneficiary;
      next = { ...next, players };
    }
    return maybeOfferBandingBonus(next, playerIdx, sourceCard);
  }

  const stub: CardInstance = {
    ...sourceCard,
    definition: {
      ...sourceCard.definition,
      effects: {
        ...sourceCard.definition.effects,
        ...branch,
        gain_coins: 0,
      } as typeof sourceCard.definition.effects,
    },
  };
  return applyCardPlayEffects(state, playerIdx, stub, {
    skipOr: true,
    skipDestroy: false,
  });
}

function beginOnGainDestroyIfNeeded(
  state: GameState,
  playerIdx: number,
  boughtCard: CardInstance
): GameState {
  const onGain = getRawEffects(boughtCard).on_gain as Record<string, unknown> | undefined;
  if (!onGain?.destroy_cards) return state;
  const count = (onGain.destroy_cards as number) ?? 0;
  const fromZones = normalizeDestroyFromZones(onGain.destroy_from as string[] | undefined);
  if (count <= 0 || fromZones.length === 0) return state;
  const player = state.players[playerIdx];
  if (!playerHasDestroyTargetsInZones(player, fromZones)) return state;
  return {
    ...state,
    pendingOnGainDestroyPick: {
      playerId: player.id,
      remaining: count,
      fromZones: fromZones.filter(
        (z): z is 'hand' | 'discard' => z === 'hand' || z === 'discard'
      ),
      sourceCardName: boughtCard.definition.name,
      optional: true,
    },
  };
}

function advanceForcedOpponentDiscards(state: GameState): GameState {
  const pending = state.pendingForcedOpponentDiscards;
  if (!pending) return state;

  if (pending.remainingForTarget > 0) {
    const target = state.players.find((p) => p.id === pending.targetPlayerId);
    if (target && target.hand.length > 0) {
      return state;
    }
  }

  let remainingTargetIds = [...pending.remainingTargetIds];

  while (remainingTargetIds.length > 0) {
    const nextTargetId = remainingTargetIds.shift()!;
    const target = state.players.find((p) => p.id === nextTargetId);
    if (target && target.hand.length > 0) {
      return {
        ...state,
        pendingForcedOpponentDiscards: {
          ...pending,
          targetPlayerId: nextTargetId,
          remainingForTarget: pending.perOpponent,
          remainingTargetIds,
        },
      };
    }
  }

  return { ...state, pendingForcedOpponentDiscards: null };
}

function resolveForcedOpponentDiscardsForAI(
  state: GameState,
  controllerIdx: number,
  perOpponent: number
): GameState {
  const controller = state.players[controllerIdx];
  const opponents = state.players.filter(
    (p) => p.id !== controller.id && p.hand.length > 0
  );
  if (opponents.length === 0) return state;

  let next = state;
  for (const opponent of opponents) {
    for (let i = 0; i < perOpponent; i++) {
      const current = next.players.find((p) => p.id === opponent.id);
      if (!current || current.hand.length === 0) break;
      const pick = pickForcedDiscardCard(current.hand);
      if (!pick) break;
      next = applyForcedOpponentDiscard(next, opponent.id, pick.instanceId);
    }
  }

  return { ...next, pendingForcedOpponentDiscards: null };
}

function maybeBeginForcedOpponentDiscards(
  state: GameState,
  playerIdx: number,
  card: CardInstance
): GameState {
  const perOpponent = card.definition.effects?.force_opponent_discard ?? 0;
  if (perOpponent <= 0) return state;

  const raw = getRawEffects(card);
  const singleTarget = raw.force_opponent_discard_single === true;
  const controllerPicks = raw.controller_picks_discard === true;

  const controller = state.players[playerIdx];
  const opponents = state.players.filter(
    (p) => p.id !== controller.id && p.hand.length > 0
  );
  if (opponents.length === 0) return state;

  if (controller.isAI) {
    if (singleTarget && controllerPicks) {
      const target = opponents[0];
      let next = state;
      for (let i = 0; i < perOpponent; i++) {
        const current = next.players.find((p) => p.id === target.id);
        if (!current || current.hand.length === 0) break;
        const pick = pickForcedDiscardCard(current.hand);
        if (!pick) break;
        next = applyForcedOpponentDiscard(next, target.id, pick.instanceId);
      }
      return next;
    }
    return resolveForcedOpponentDiscardsForAI(state, playerIdx, perOpponent);
  }

  if (singleTarget && controllerPicks) {
    const candidateIds = opponents.map((p) => p.id);
    if (candidateIds.length === 1) {
      return {
        ...state,
        pendingForcedOpponentDiscards: {
          controllerId: controller.id,
          sourceCardName: card.definition.name,
          perOpponent,
          targetPlayerId: candidateIds[0],
          remainingForTarget: perOpponent,
          remainingTargetIds: [],
          phase: 'discard',
          controllerPicks: true,
          singleTarget: true,
          opponentCandidateIds: candidateIds,
        },
      };
    }
    return {
      ...state,
      pendingForcedOpponentDiscards: {
        controllerId: controller.id,
        sourceCardName: card.definition.name,
        perOpponent,
        targetPlayerId: '',
        remainingForTarget: perOpponent,
        remainingTargetIds: [],
        phase: 'choose_opponent',
        controllerPicks: true,
        singleTarget: true,
        opponentCandidateIds: candidateIds,
      },
    };
  }

  const [first, ...rest] = opponents.map((p) => p.id);
  return {
    ...state,
    pendingForcedOpponentDiscards: {
      controllerId: controller.id,
      sourceCardName: card.definition.name,
      perOpponent,
      targetPlayerId: first,
      remainingForTarget: perOpponent,
      remainingTargetIds: rest,
      phase: 'discard',
      controllerPicks: false,
    },
  };
}

function handleForcedOpponentSelfDiscard(
  state: GameState,
  pending: NonNullable<GameState['pendingForcedOpponentDiscards']>,
  cardInstanceId: string
): GameState {
  let next = applyForcedOpponentDiscard(
    state,
    pending.targetPlayerId,
    cardInstanceId
  );
  const remainingForTarget = pending.remainingForTarget - 1;

  if (remainingForTarget > 0) {
    const target = next.players.find((p) => p.id === pending.targetPlayerId);
    if (target && target.hand.length > 0) {
      return {
        ...next,
        pendingForcedOpponentDiscards: {
          ...pending,
          remainingForTarget,
        },
      };
    }
  }

  if (pending.singleTarget) {
    return { ...next, pendingForcedOpponentDiscards: null };
  }

  let remainingTargetIds = [...pending.remainingTargetIds];
  while (remainingTargetIds.length > 0) {
    const nextTargetId = remainingTargetIds.shift()!;
    const target = next.players.find((p) => p.id === nextTargetId);
    if (target && target.hand.length > 0) {
      return {
        ...next,
        pendingForcedOpponentDiscards: {
          ...pending,
          targetPlayerId: nextTargetId,
          remainingForTarget: pending.perOpponent,
          remainingTargetIds,
        },
      };
    }
  }

  return { ...next, pendingForcedOpponentDiscards: null };
}

function clearPlayerInteractivePending(
  state: GameState,
  playerId: string
): GameState {
  let next = { ...state };
  if (next.pendingGainCardPick?.playerId === playerId) {
    next.pendingGainCardPick = null;
  }
  if (next.pendingPlaceCardOnDeckPick?.playerId === playerId) {
    next.pendingPlaceCardOnDeckPick = null;
  }
  if (next.pendingCopyCardPick?.playerId === playerId) {
    next.pendingCopyCardPick = null;
  }
  if (next.pendingDeckTopRevealPick?.playerId === playerId) {
    next.pendingDeckTopRevealPick = null;
  }
  if (next.pendingDeckLookPick?.playerId === playerId) {
    next.pendingDeckLookPick = null;
  }
  if (next.pendingGainBandingBonusPick?.playerId === playerId) {
    next.pendingGainBandingBonusPick = null;
  }
  if (next.pendingPlaceDestroyedOnMarketPick?.playerId === playerId) {
    next.pendingPlaceDestroyedOnMarketPick = null;
  }
  if (next.pendingAnyDiscardDestroyPick?.playerId === playerId) {
    next.pendingAnyDiscardDestroyPick = null;
  }
  if (next.pendingOnGainDestroyPick?.playerId === playerId) {
    next.pendingOnGainDestroyPick = null;
  }
  if (next.pendingGalleryDestroyPick?.playerId === playerId) {
    next.pendingGalleryDestroyPick = null;
  }
  if (next.pendingEpicDestroyPick?.playerId === playerId) {
    next.pendingEpicDestroyPick = null;
  }
  if (next.pendingCardDestroyPick?.playerId === playerId) {
    next.pendingCardDestroyPick = null;
  }
  if (next.pendingFavorReplayPick?.playerId === playerId) {
    next.pendingFavorReplayPick = null;
  }
  if (next.pendingOrEffectChoice?.playerId === playerId) {
    next.pendingOrEffectChoice = null;
  }
  return next;
}

function isGalleryCardPurchased(state: GameState, instanceId: string): boolean {
  return !!state.galleryPurchasedBy?.[instanceId];
}

function findMarketCard(state: GameState, instanceId: string): CardInstance | undefined {
  if (state.recruitCard?.instanceId === instanceId) return state.recruitCard;
  const gallery = state.galleryCards.find((c) => c.instanceId === instanceId);
  if (gallery) {
    if (isGalleryCardPurchased(state, instanceId)) return undefined;
    return gallery;
  }
  return state.epicCards.find((c) => c.instanceId === instanceId);
}

function allPlayersReady(state: GameState): boolean {
  return (
    state.players.length > 0 &&
    state.players.every((p) => state.readyPlayerIds.includes(p.id))
  );
}

function activateGameFromPregame(state: GameState): GameState {
  let flavorDeck = [...state.flavorDeck];
  const players = state.players.map((p) => {
    const { player, favorReturns } = drawCards({ ...p, hand: [] }, STARTING_HAND_SIZE);
    if (favorReturns.length > 0) {
      flavorDeck = [...flavorDeck, ...favorReturns];
    }
    return player;
  });
  return {
    ...state,
    status: 'active',
    phase: 'MAIN',
    players,
    flavorDeck,
    turnPlayerId: players[0]?.id ?? '',
    turnNumber: 1,
    turnCoins: 0,
    turnValor: 0,
    turnBandingClaimed: [],
    pendingBandingBonus: null,
    deferredBandingBonus: null,
    turnActionHighlight: null,
    pendingGalleryEvent: null,
    galleryEventOutcomes: null,
    pendingEventHandChoices: [],
    pendingEventDiscards: [],
    pendingEventItemChoices: [],
    pendingEventOptionalDiscards: null,
    pendingFavorReveal: null,
    pendingFavorQueue: [],
    pendingFavorDestroyPick: null,
    pendingFavorArenaWagerPick: null,
    pendingFavorReplayPick: null,
    pendingFavorReplayRemovalId: null,
    lastArenaWagerResult: null,
    pendingCardDestroyPick: null,
    pendingGalleryDestroyPick: null,
    pendingEpicDestroyPick: null,
    pendingAnyDiscardDestroyPick: null,
    pendingOrEffectChoice: null,
    pendingOnGainDestroyPick: null,
    pendingHandDiscard: null,
    pendingForcedOpponentDiscards: null,
    pendingGainCardPick: null,
    pendingCopyCardPick: null,
    pendingPlaceCardOnDeckPick: null,
    pendingDeckLookPick: null,
    pendingDeckTopRevealPick: null,
    pendingGainBandingBonusPick: null,
    pendingPlaceDestroyedOnMarketPick: null,
    arenaSabotageValorByPlayerId: {},
    pendingArenaLoss: null,
    deferredTurnEnd: null,
    pendingArenaReplacement: false,
    purchaseCostCap: null,
    galleryPurchasedBy: {},
    readyPlayerIds: state.readyPlayerIds,
    turnArenaResolved: false,
    turnArenaExempt: false,
  };
}

export function getArenaChallengeStats(arenaCard: CardInstance | null) {
  if (!arenaCard) return { requiredValor: 6, valorGain: 0, rewardVp: 3 };
  const def = arenaCard.definition;
  const valorGain = def.valorRequired ?? 0;
  return {
    requiredValor: valorGain > 0 ? valorGain : 6,
    valorGain,
    rewardVp: def.rewardVp ?? 3,
  };
}

export function getCurrentPlayer(state: GameState): PlayerState | undefined {
  return state.players.find((p) => p.id === state.turnPlayerId);
}

export function getArenaCommitValor(state: GameState): number {
  return state.arenaCommitZone.reduce(
    (sum, c) => sum + (c.definition?.valor ?? 0),
    0
  );
}

export function getArenaChallengeTotalValor(state: GameState): number {
  const challenge = state.arenaChallenge;
  if (!challenge) return getArenaCommitValor(state);

  const supportValor = Object.values(challenge.supportByPlayerId)
    .filter((c): c is CardInstance => c != null)
    .reduce((sum, c) => sum + (c.definition?.valor ?? 0), 0);

  const hinderValor = Object.entries(challenge.hinderByPlayerId)
    .filter((entry): entry is [string, CardInstance] => entry[1] != null)
    .reduce((sum, [playerId, c]) => {
      const sabotage = state.arenaSabotageValorByPlayerId?.[playerId] ?? 0;
      return sum + (c.definition?.valor ?? 0) + sabotage;
    }, 0);

  return getArenaCommitValor(state) + supportValor - hinderValor;
}

function discardCardToPlayer(
  player: PlayerState,
  card: CardInstance
): PlayerState {
  return {
    ...player,
    discard: [
      ...player.discard,
      { ...card, location: 'DISCARD' as const, faceUp: true },
    ],
  };
}

function resolveArenaChallenge(state: GameState): GameState {
  const challenge = state.arenaChallenge;
  if (!challenge || !state.arenaCard) return state;

  const challengerIdx = state.players.findIndex((p) => p.id === challenge.challengerId);
  if (challengerIdx === -1) return state;

  const { requiredValor, rewardVp, valorGain } = getArenaChallengeStats(state.arenaCard);
  const totalValor = getArenaChallengeTotalValor(state);
  const success = totalValor >= requiredValor;

  let players = state.players.map((p) => ({
    ...p,
    hand: [...p.hand],
    discard: [...p.discard],
    playArea: [...p.playArea],
    deck: [...p.deck],
  }));

  let challenger = { ...players[challengerIdx] };

  for (const card of state.arenaCommitZone) {
    challenger = discardCardToPlayer(challenger, {
      ...card,
      ownerId: challenger.id,
    });
  }

  for (const [playerId, card] of Object.entries(challenge.supportByPlayerId)) {
    if (!card) continue;
    const idx = players.findIndex((p) => p.id === playerId);
    if (idx === -1) continue;
    players[idx] = discardCardToPlayer(players[idx], card);
  }

  for (const [playerId, card] of Object.entries(challenge.hinderByPlayerId)) {
    if (!card) continue;
    const idx = players.findIndex((p) => p.id === playerId);
    if (idx === -1) continue;
    players[idx] = discardCardToPlayer(players[idx], card);
  }

  let lossSideEffects: Partial<GameState> = {};
  if (success) {
    challenger.victoryPoints += rewardVp;
  } else {
    const lossSpec = parseArenaLossSpec(state.arenaCard);
    const committedFighters = state.arenaCommitZone.map((c) => ({ ...c }));

    if (arenaLossNeedsPrompt(lossSpec)) {
      players[challengerIdx] = challenger;
      return {
        ...state,
        players,
        turnArenaResolved: true,
        turnValor: state.turnValor,
        arenaCommitZone: [],
        arenaChallenge: null,
        arenaSabotageValorByPlayerId: {},
        pendingArenaLoss: beginPendingArenaLoss(
          state,
          challenge.challengerId,
          lossSpec,
          committedFighters
        ),
        lastArenaResult: {
          success,
          totalValor,
          requiredValor,
          valorGain,
          rewardVp,
          challengerId: challenge.challengerId,
        },
      };
    }

    const autoApplied = applyAutomaticArenaLoss(
      { ...state, players },
      challengerIdx,
      lossSpec
    );
    players = autoApplied.players;
    challenger = players[challengerIdx];
    lossSideEffects = {
      disfavorDeck: autoApplied.disfavorDeck,
      destroyedPile: autoApplied.destroyedPile,
    };
  }

  players[challengerIdx] = challenger;

  let arenaCard: CardInstance | null = state.arenaCard;
  let arenaDeck = [...state.arenaDeck];
  let pendingArenaReplacement = state.pendingArenaReplacement ?? false;
  let arenaOpen = state.arenaOpen ?? false;
  if (success) {
    pendingArenaReplacement = true;
    if (arenaCard && isOpeningGamesArena(arenaCard)) {
      arenaOpen = true;
    }
  }

  return {
    ...state,
    ...lossSideEffects,
    players,
    arenaCard,
    arenaDeck,
    pendingArenaReplacement,
    arenaOpen,
    turnArenaResolved: true,
    turnValor: state.turnValor + (success ? valorGain : 0),
    arenaCommitZone: [],
    arenaChallenge: null,
    arenaSabotageValorByPlayerId: {},
    lastArenaResult: {
      success,
      totalValor,
      requiredValor,
      valorGain,
      rewardVp,
      challengerId: challenge.challengerId,
    },
  };
}

function rehydrateCard(card: CardInstance): CardInstance {
  const definition = getCardDefinition(card.definitionId);
  return {
    ...card,
    definitionId: definition.id,
    definition,
  };
}

function rehydrateCards(cards: CardInstance[]): CardInstance[] {
  return cards.map(rehydrateCard);
}

function rehydratePlayer(
  player: PlayerState,
  favorReturns?: CardInstance[]
): PlayerState {
  const hand = rehydrateCards(player.hand ?? []).map((c) => ({
    ...c,
    location: 'HAND' as const,
    faceUp: c.faceUp ?? true,
  }));
  const deck = rehydrateCards(player.deck ?? []).map((c) => ({
    ...c,
    location: 'DECK' as const,
    faceUp: false,
  }));
  const discard = rehydrateCards(player.discard ?? []).map((c) => ({
    ...c,
    location: 'DISCARD' as const,
    faceUp: true,
  }));
  const playArea = rehydrateCards(player.playArea ?? []).map((c) => ({
    ...c,
    location: 'PLAY_AREA' as const,
  }));
  const itemsInPlay = rehydrateCards(player.itemsInPlay ?? []).map((c) => ({
    ...c,
    location: 'ITEMS_IN_PLAY' as const,
  }));

  const deckSplit = splitPlayerDeckCycleCards(deck);
  const discardSplit = splitPlayerDeckCycleCards(discard);
  const playSplit = splitPlayerDeckCycleCards(playArea);
  if (favorReturns) {
    favorReturns.push(
      ...deckSplit.favorReturns,
      ...discardSplit.favorReturns,
      ...playSplit.favorReturns
    );
  }

  return {
    ...player,
    hand,
    deck: deckSplit.deckable,
    discard: discardSplit.deckable,
    playArea: playSplit.deckable,
    itemsInPlay,
  };
}

/** Restore card definitions after Supabase JSON round-trip. */
export function rehydrateGameState(state: GameState): GameState {
  const favorReturns: CardInstance[] = [];
  const players = (state.players ?? []).map((p) => rehydratePlayer(p, favorReturns));
  let phase = normalizePhase(state.phase);
  let status = state.status ?? (state.turnPlayerId ? 'active' : 'lobby');

  // Legacy persisted states used DRAW; PREGAME must stay PREGAME until all players ready.
  if (status === 'active' && (state as { phase?: string }).phase === 'DRAW') {
    phase = 'MAIN';
  }

  return {
    ...state,
    status,
    phase,
    players,
    readyPlayerIds: state.readyPlayerIds ?? [],
    turnCoins: state.turnCoins ?? 0,
    turnValor: state.turnValor ?? 0,
    turnBandingClaimed: state.turnBandingClaimed ?? [],
    pendingBandingBonus: state.pendingBandingBonus ?? null,
    deferredBandingBonus: state.deferredBandingBonus ?? null,
    turnActionHighlight: state.turnActionHighlight ?? null,
    pendingGalleryEvent: state.pendingGalleryEvent
      ? rehydrateCard(state.pendingGalleryEvent)
      : null,
    pendingEventHandChoices: state.pendingEventHandChoices ?? [],
    pendingEventDiscards: state.pendingEventDiscards ?? [],
    pendingEventItemChoices: state.pendingEventItemChoices ?? [],
    pendingEventOptionalDiscards: state.pendingEventOptionalDiscards ?? null,
    galleryEventOutcomes: state.galleryEventOutcomes ?? null,
    galleryEventDecreeOutcomes: state.galleryEventDecreeOutcomes ?? null,
    turnEpicDiscount: state.turnEpicDiscount ?? 0,
    turnFactionDiscount: state.turnFactionDiscount ?? 0,
    deferredGalleryRefillSlots: state.deferredGalleryRefillSlots ?? 0,
    deferredEpicRefillSlots: state.deferredEpicRefillSlots ?? 0,
    pendingFavorReveal: state.pendingFavorReveal
      ? {
          ...state.pendingFavorReveal,
          card: rehydrateCard(state.pendingFavorReveal.card),
        }
      : null,
    pendingFavorQueue: (state.pendingFavorQueue ?? []).map((entry) => ({
      ...entry,
      card: rehydrateCard(entry.card),
    })),
    pendingFavorDestroyPick: state.pendingFavorDestroyPick ?? null,
    pendingFavorArenaWagerPick: state.pendingFavorArenaWagerPick ?? null,
    pendingFavorReplayPick: state.pendingFavorReplayPick ?? null,
    pendingFavorReplayRemovalId: state.pendingFavorReplayRemovalId ?? null,
    lastArenaWagerResult: state.lastArenaWagerResult
      ? {
          ...state.lastArenaWagerResult,
          entries: state.lastArenaWagerResult.entries.map((entry) => ({
            ...entry,
            card: rehydrateCard(entry.card),
          })),
        }
      : null,
    pendingCardDestroyPick: state.pendingCardDestroyPick ?? null,
    pendingGalleryDestroyPick: state.pendingGalleryDestroyPick ?? null,
    pendingEpicDestroyPick: state.pendingEpicDestroyPick ?? null,
    pendingAnyDiscardDestroyPick: state.pendingAnyDiscardDestroyPick ?? null,
    pendingOrEffectChoice: state.pendingOrEffectChoice ?? null,
    pendingOnGainDestroyPick: state.pendingOnGainDestroyPick ?? null,
    pendingHandDiscard: state.pendingHandDiscard ?? null,
    pendingForcedOpponentDiscards: state.pendingForcedOpponentDiscards ?? null,
    pendingGainCardPick: state.pendingGainCardPick ?? null,
    pendingCopyCardPick: state.pendingCopyCardPick ?? null,
    pendingPlaceCardOnDeckPick: state.pendingPlaceCardOnDeckPick ?? null,
    pendingDeckLookPick: state.pendingDeckLookPick ?? null,
    pendingDeckTopRevealPick: state.pendingDeckTopRevealPick
      ? {
          ...state.pendingDeckTopRevealPick,
          picks: state.pendingDeckTopRevealPick.picks.map((pick) => ({
            ...pick,
            card: rehydrateCard(pick.card),
          })),
        }
      : null,
    pendingGainBandingBonusPick: state.pendingGainBandingBonusPick ?? null,
    pendingPlaceDestroyedOnMarketPick:
      state.pendingPlaceDestroyedOnMarketPick ?? null,
    lastEventGalleryDestroyNames: state.lastEventGalleryDestroyNames ?? null,
    arenaSabotageValorByPlayerId: state.arenaSabotageValorByPlayerId ?? {},
    pendingArenaLoss: state.pendingArenaLoss
      ? {
          ...state.pendingArenaLoss,
          committedFighters: rehydrateCards(state.pendingArenaLoss.committedFighters ?? []),
          primusCandidates: state.pendingArenaLoss.primusCandidates
            ? rehydrateCards(state.pendingArenaLoss.primusCandidates)
            : undefined,
        }
      : null,
    deferredTurnEnd: state.deferredTurnEnd ?? null,
    pendingArenaReplacement: state.pendingArenaReplacement ?? false,
    purchaseCostCap: state.purchaseCostCap ?? null,
    purchaseCostCapActiveForPlayerId:
      state.purchaseCostCapActiveForPlayerId ?? null,
    arenaOpen: state.arenaOpen ?? false,
    turnArenaResolved: state.turnArenaResolved ?? false,
    turnArenaExempt: state.turnArenaExempt ?? false,
    arenaCard: state.arenaCard ? rehydrateCard(state.arenaCard) : null,
    arenaDeck: rehydrateCards(state.arenaDeck ?? []),
    arenaCommitZone: rehydrateCards(state.arenaCommitZone ?? []).map((c) => ({
      ...c,
      location: 'ARENA_COMMIT' as const,
    })),
    arenaChallenge: state.arenaChallenge ?? null,
    lastArenaResult: state.lastArenaResult ?? null,
    galleryCards: rehydrateCards(state.galleryCards ?? []),
    galleryPurchasedBy: state.galleryPurchasedBy ?? {},
    gallerySupply: rehydrateCards(state.gallerySupply ?? []),
    epicCards: rehydrateCards(state.epicCards ?? []),
    epicSupply: rehydrateCards(state.epicSupply ?? []),
    recruitCard: state.recruitCard
      ? { ...rehydrateCard(state.recruitCard), location: 'RECRUIT' as const, faceUp: true }
      : null,
    recruitDeck: rehydrateCards(state.recruitDeck ?? []).map((c) => ({
      ...c,
      location: 'RECRUIT_DECK' as const,
      faceUp: false,
    })),
    flavorDeck: [...rehydrateCards(state.flavorDeck ?? []), ...favorReturns],
    flavorDiscard: rehydrateCards(state.flavorDiscard ?? []).map((c) => ({
      ...c,
      location: 'FLAVOR_DISCARD' as const,
      faceUp: true,
    })),
    disfavorDeck:
      (state.disfavorDeck ?? []).length > 0
        ? rehydrateCards(state.disfavorDeck).map((c) => ({ ...c, faceUp: true }))
        : [createCardInstance(CROWD_DISFAVOR.id, 'DISFAVOR_DECK', 'market', true)],
    destroyedPile: rehydrateCards(state.destroyedPile ?? []).map((c) => ({
      ...c,
      location: 'DESTROYED' as const,
      faceUp: true,
    })),
    winnerId: state.winnerId ?? null,
  };
}

function normalizePhase(phase: GamePhase | string | undefined): GamePhase {
  switch (phase) {
    case 'PREGAME':
    case 'MAIN':
    case 'CLEANUP':
      return phase;
    case 'DRAW':
    case 'ARENA':
    case 'BUY':
    case 'END':
      return 'MAIN';
    default:
      return 'PREGAME';
  }
}

export function validateGameAction(
  state: GameState,
  action: GameAction
): string | null {
  if (action.type === 'START_GAME') return null;
  if (action.type === 'END_GAME') {
    if (state.status !== 'active') return 'Game is not active';
    return null;
  }

  if (state.status === 'finished') return 'Game is finished';
  if (state.status === 'lobby') return 'Game has not started';

  if (action.type === 'DEBUG_SPAWN_CARD') {
    if (state.status !== 'active') return 'Game is not active';
    if (state.id !== 'game_1') return 'Debug spawn only in local practice';
    if (!action.payload?.definitionId) return 'Missing card definition';
    const zone = action.payload.targetZone;
    if (
      zone !== 'HAND' &&
      zone !== 'DECK' &&
      zone !== 'DISCARD' &&
      zone !== 'DESTROYED'
    ) {
      return 'Invalid spawn zone';
    }
    if (!state.players.some((p) => p.id === action.playerId)) {
      return 'Unknown player';
    }
    return null;
  }

  if (favorResolutionPaused(state)) {
    const pending = state.pendingFavorReveal;
    const destroyPick = state.pendingFavorDestroyPick;
    const arenaWagerPick = state.pendingFavorArenaWagerPick;
    if (action.type === 'RESOLVE_FAVOR') {
      if (
        !pending ||
        favorIsOptional(pending.card) ||
        destroyPick ||
        arenaWagerPick
      ) {
        return 'Cannot resolve favor yet';
      }
      return null;
    }
    if (action.type === 'ACCEPT_FAVOR' || action.type === 'DECLINE_FAVOR') {
      if (
        !pending ||
        !favorIsOptional(pending.card) ||
        destroyPick ||
        arenaWagerPick
      ) {
        return 'Not waiting for favor choice';
      }
      if (action.playerId !== pending.playerId) {
        return 'Only the player who drew this Favor may decide';
      }
      return null;
    }
    if (action.type === 'FAVOR_ARENA_WAGER_PICK') {
      if (!pending || !arenaWagerPick) {
        return 'Not waiting for arena wager pick';
      }
      if (action.playerId !== arenaWagerPick.beneficiaryId) {
        return 'Only the favor beneficiary may choose';
      }
      if (!action.payload?.cardInstanceId) return 'Select a card';
      const zone = action.payload.sourceZone;
      if (zone !== 'HAND' && zone !== 'PLAY_AREA') {
        return 'Choose from hand or in play';
      }
      const p = state.players.find((pl) => pl.id === action.playerId);
      if (!p) return 'Unknown player';
      const pool = zone === 'HAND' ? p.hand : p.playArea;
      if (!pool.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Card not available';
      }
      return null;
    }
    if (action.type === 'FAVOR_DESTROY_CARD') {
      if (!destroyPick || action.playerId !== destroyPick.playerId) {
        return 'Not waiting for your favor choice';
      }
      if (!action.payload?.cardInstanceId) return 'Select a card';
      const p = state.players.find((pl) => pl.id === action.playerId);
      if (!p) return 'Unknown player';
      const zone = action.payload.sourceZone;
      const pool =
        zone === 'DISCARD'
          ? p.discard
          : zone === 'PLAY_AREA'
            ? p.playArea
            : p.hand;
      if (!pool.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Card not available';
      }
      return null;
    }
    if (
      action.type === 'GAIN_CARD_PICK' &&
      state.pendingGainCardPick?.playerId === action.playerId
    ) {
      return null;
    }
    if (action.type === 'DISMISS_ARENA_WAGER_RESULT') {
      return null;
    }
    return 'Resolve favor first';
  }

  if (action.type === 'DISMISS_ARENA_RESULT') {
    if (!state.lastArenaResult) return 'No arena result to dismiss';
    if (state.arenaChallenge) return 'Arena challenge still in progress';
    return null;
  }

  if (action.type === 'DISMISS_ARENA_WAGER_RESULT') {
    if (!state.lastArenaWagerResult) return 'No arena wager result to dismiss';
    return null;
  }

  if (
    state.pendingGalleryEvent ||
    getPendingEventHandChoicePlayerIds(state).length > 0 ||
    getPendingEventItemChoicePlayerIds(state).length > 0 ||
    (state.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0
  ) {
    if (action.type === 'RESOLVE_GALLERY_EVENT') {
      if (getPendingEventHandChoicePlayerIds(state).length > 0) {
        return 'All players must respond first';
      }
      if (getPendingEventItemChoicePlayerIds(state).length > 0) {
        return 'All players must respond first';
      }
      if ((state.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0) {
        return 'All players must respond first';
      }
      return null;
    }
    if (action.type === 'EVENT_DISCARD_CARD') {
      const optionalIds =
        state.pendingEventOptionalDiscards?.pendingPlayerIds ?? [];
      const requiredChoice = getPendingEventHandChoiceForPlayer(
        state,
        action.playerId
      );
      const waiting =
        optionalIds.includes(action.playerId) || requiredChoice != null;
      if (!waiting) return 'Not waiting for your event response';
      if (!action.payload?.cardInstanceId) return 'Select a card from hand';
      const p = state.players.find((pl) => pl.id === action.playerId);
      const card = p?.hand.find(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );
      if (!card) return 'Card not in hand';
      if (
        requiredChoice &&
        !handCardValidForEventChoice(card, requiredChoice.kind)
      ) {
        return 'Select a Charity or Gratia card';
      }
      return null;
    }
    if (action.type === 'EVENT_LOSE_ITEM') {
      if (
        !getPendingEventItemChoicePlayerIds(state).includes(action.playerId)
      ) {
        return 'Not waiting for your event response';
      }
      if (!action.payload?.cardInstanceId) return 'Select an item to lose';
      const p = state.players.find((pl) => pl.id === action.playerId);
      if (
        !p?.itemsInPlay.some(
          (c) => c.instanceId === action.payload!.cardInstanceId
        )
      ) {
        return 'Item not in play';
      }
      return null;
    }
    if (action.type === 'EVENT_SKIP_GALLERY_CHOICE') {
      if (
        !state.pendingEventOptionalDiscards?.pendingPlayerIds.includes(
          action.playerId
        )
      ) {
        return 'Not waiting for your event response';
      }
      return null;
    }
    return 'Resolve gallery event first';
  }

  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return 'Unknown player';

  if (action.type === 'PLAYER_READY') {
    if (state.phase !== 'PREGAME') return 'Game is not in pre-start';
    if (state.readyPlayerIds.includes(action.playerId)) {
      return 'Already ready';
    }
    return null;
  }

  if (state.phase === 'PREGAME') {
    return 'Waiting for all players to ready up';
  }

  if (action.type === 'ARENA_RESPOND') {
    if (!state.arenaChallenge) return 'No arena challenge in progress';
    if (!state.arenaChallenge.pendingResponsePlayerIds.includes(action.playerId)) {
      return 'Not waiting for your arena response';
    }
    const responseType = action.payload?.responseType;
    if (!responseType) return 'Missing response type';
    if (responseType === 'pass') return null;
    if (!action.payload?.cardInstanceId) return 'Select a card from hand';
    if (!player.hand.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
      return 'Card not in hand';
    }
    return null;
  }

  if (action.type === 'CONFIRM_ARENA_FIGHTERS') {
    if (state.turnPlayerId !== action.playerId) return 'Not your turn';
    if (state.phase !== 'MAIN') return 'Not in main phase';
    if (state.arenaChallenge) return 'Arena challenge already in progress';
    if (!state.arenaCard) return 'No arena challenge';
    const ids = action.payload?.cardInstanceIds ?? [];
    const maxCommit = getArenaMaxCommit(player);
    if (!isValidArenaCommitCount(ids.length, maxCommit)) {
      return `Select 1 to ${maxCommit} fighters`;
    }
    if (new Set(ids).size !== ids.length) return 'Duplicate fighter selected';
    for (const id of ids) {
      if (!player.playArea.some((c) => c.instanceId === id)) {
        return 'Fighter must be in your play area';
      }
    }
    return null;
  }

  if (action.type === 'DECLINE_ARENA') {
    if (state.turnPlayerId !== action.playerId) return 'Not your turn';
    if (state.phase !== 'MAIN') return 'Not in main phase';
    if (!mustEnterArenaBeforeEndTurn(state, action.playerId)) {
      return 'Arena challenge is not mandatory';
    }
    return null;
  }

  if (state.arenaChallenge) {
    return 'Arena challenge in progress';
  }

  if (state.pendingArenaLoss) {
    if (action.type !== 'RESOLVE_ARENA_LOSS') {
      return 'Resolve arena defeat penalty first';
    }
    if (state.pendingArenaLoss.playerId !== action.playerId) {
      return 'Not your arena defeat to resolve';
    }
    const pending = state.pendingArenaLoss;
    const choice = action.payload?.arenaLossChoice;
    const cardId = action.payload?.cardInstanceId;

    if (pending.phase === 'primus_choice') {
      if (choice !== 'disfavor' && choice !== 'destroy_fighter') {
        return 'Choose Disfavor or destroy your strongest fighter';
      }
      return null;
    }

    if (
      pending.phase === 'destroy_fighter_pick' ||
      pending.phase === 'primus_fighter_pick'
    ) {
      if (!cardId) return 'Select a fighter to destroy';
      const allowed = new Set(
        (pending.phase === 'primus_fighter_pick'
          ? pending.primusCandidates
          : pending.committedFighters
        )?.map((c) => c.instanceId) ?? []
      );
      if (!allowed.has(cardId)) return 'Invalid fighter selection';
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player?.discard.some((c) => c.instanceId === cardId)) {
        return 'Fighter not in your discard pile';
      }
      return null;
    }

    return 'Invalid arena loss phase';
  }

  if (state.pendingForcedOpponentDiscards) {
    const pending = state.pendingForcedOpponentDiscards;
    if (
      pending.phase === 'choose_opponent' &&
      action.type === 'CHOOSE_FORCE_DISCARD_TARGET'
    ) {
      if (action.playerId !== pending.controllerId) {
        return 'Only the active player may choose';
      }
      const targetId = action.payload?.targetPlayerId;
      if (!targetId) return 'Select an opponent';
      if (!pending.opponentCandidateIds?.includes(targetId)) {
        return 'Invalid opponent';
      }
      return null;
    }
    if (pending.controllerPicks && pending.phase === 'discard') {
      if (action.type === 'FORCE_OPPONENT_DISCARD') {
        if (action.playerId !== pending.controllerId) {
          return 'Only the active player may choose';
        }
        if (!action.payload?.cardInstanceId) return 'Select a card to discard';
        const target = state.players.find((p) => p.id === pending.targetPlayerId);
        if (
          !target?.hand.some((c) => c.instanceId === action.payload!.cardInstanceId)
        ) {
          return 'Card not in opponent hand';
        }
        return null;
      }
      if (action.playerId === pending.controllerId) {
        return 'Choose a card for your opponent to discard';
      }
    }
    if (pending.targetPlayerId === action.playerId) {
      if (action.type === 'DISCARD_CARD' || action.type === 'FORCE_OPPONENT_DISCARD') {
        if (!action.payload?.cardInstanceId) return 'Select a card to discard';
        const target = state.players.find((p) => p.id === pending.targetPlayerId);
        if (!target?.hand.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
          return 'Card not in your hand';
        }
        return null;
      }
      return `Discard ${pending.remainingForTarget} card(s)`;
    }
    return 'Waiting for forced discard';
  }

  if (state.pendingPlaceCardOnDeckPick?.playerId === action.playerId) {
    if (action.type === 'PLACE_CARD_ON_DECK_PICK') {
      if (!action.payload?.cardInstanceId) return 'Select a card';
      const p = state.players.find((pl) => pl.id === action.playerId);
      if (!p?.discard.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Card not in discard pile';
      }
      return null;
    }
    if (
      action.type === 'PLACE_CARD_ON_DECK_SKIP' &&
      state.pendingPlaceCardOnDeckPick.optional
    ) {
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Choose a discard card for your deck';
  }

  if (state.turnPlayerId !== action.playerId) {
    return 'Not your turn';
  }

  if (state.pendingHandDiscard?.playerId === action.playerId) {
    if (action.type === 'END_PHASE') {
      const handPlayer = state.players.find((p) => p.id === action.playerId);
      if (handPlayer && handPlayer.hand.length === 0) return null;
    }
    if (action.type === 'DISCARD_CARD') {
      if (!action.payload?.cardInstanceId) return 'Select a card to discard';
      if (!player.hand.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Discard from your hand';
      }
      return null;
    }
    return `Discard ${state.pendingHandDiscard.remaining} card(s) from hand`;
  }

  if (state.pendingOrEffectChoice?.playerId === action.playerId) {
    if (action.type === 'CHOOSE_OR_EFFECT') {
      if (action.payload?.branchIndex == null) return 'Choose an option';
      const pending = state.pendingOrEffectChoice;
      const branchIndex = action.payload.branchIndex;
      if (branchIndex > 0) {
        const branch = pending.branches[branchIndex - 1];
        if (!branch) return 'Invalid option';
        const player = state.players.find((p) => p.id === action.playerId);
        if (
          branch.if_first_card_played &&
          player &&
          !isFirstCardPlayedThisTurn(player, pending.sourceCardInstanceId)
        ) {
          return 'First card only';
        }
      }
      return null;
    }
    return 'Resolve card choice first';
  }

  if (state.pendingGalleryDestroyPick?.playerId === action.playerId) {
    if (action.type === 'GALLERY_DESTROY_PICK') {
      if (!action.payload?.cardInstanceId) return 'Select a gallery card';
      const card = state.galleryCards.find(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );
      if (!card || isGalleryCardPurchased(state, card.instanceId)) {
        return 'Card not in gallery';
      }
      return null;
    }
    if (
      action.type === 'GALLERY_DESTROY_SKIP' &&
      state.pendingGalleryDestroyPick.optional
    ) {
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Choose a gallery card to destroy';
  }

  if (state.pendingEpicDestroyPick?.playerId === action.playerId) {
    if (action.type === 'EPIC_DESTROY_PICK') {
      if (!action.payload?.cardInstanceId) return 'Select an Epic card';
      const card = state.epicCards.find(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );
      if (!card) return 'Card not in Epic row';
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Choose an Epic card to destroy';
  }

  if (state.pendingAnyDiscardDestroyPick?.playerId === action.playerId) {
    if (action.type === 'ANY_DISCARD_DESTROY_PICK') {
      if (!action.payload?.targetPlayerId || !action.payload?.cardInstanceId) {
        return 'Select a discard pile card';
      }
      if (
        state.pendingAnyDiscardDestroyPick.opponentsOnly &&
        action.payload.targetPlayerId === action.playerId
      ) {
        return 'Choose an opponent discard pile';
      }
      const target = state.players.find((p) => p.id === action.payload!.targetPlayerId);
      if (!target?.discard.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Card not in that discard pile';
      }
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Choose a discard pile card to destroy';
  }

  if (state.pendingOnGainDestroyPick?.playerId === action.playerId) {
    if (action.type === 'ON_GAIN_DESTROY_PICK') {
      if (!action.payload?.cardInstanceId) return 'Select a card';
      const zone = action.payload.sourceZone ?? 'HAND';
      const pool = zone === 'DISCARD' ? player.discard : player.hand;
      if (!pool.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Card not available';
      }
      return null;
    }
    if (action.type === 'ON_GAIN_DESTROY_SKIP') return null;
    if (action.type === 'END_PHASE') return null;
    return 'Resolve on-gain destroy choice';
  }

  if (state.pendingCardDestroyPick?.playerId === action.playerId) {
    const pending = state.pendingCardDestroyPick;
    if (action.type === 'CARD_DESTROY_PICK') {
      if (!action.payload?.cardInstanceId) return 'Select a card to destroy';
      const zone = action.payload.sourceZone ?? 'HAND';
      const pool =
        zone === 'DISCARD'
          ? player.discard
          : zone === 'PLAY_AREA'
            ? player.playArea
            : player.hand;
      if (!pool.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Card not available to destroy';
      }
      if (!pending.fromZones.includes(zone === 'PLAY_AREA' ? 'play_area' : zone === 'DISCARD' ? 'discard' : 'hand')) {
        return 'Cannot destroy from that zone';
      }
      return null;
    }
    if (action.type === 'CARD_DESTROY_SKIP' && pending.optional) {
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Choose a card to destroy';
  }

  if (state.pendingFavorReplayPick?.playerId === action.playerId) {
    if (action.type === 'FAVOR_REPLAY_PICK') {
      if (!action.payload?.cardInstanceId) return 'Select a Favor to replay';
      if (
        !(state.flavorDiscard ?? []).some(
          (c) => c.instanceId === action.payload!.cardInstanceId
        )
      ) {
        return 'Favor not in discard pile';
      }
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Choose a Favor to replay';
  }

  if (state.pendingGainCardPick?.playerId === action.playerId) {
    if (action.type === 'GAIN_CARD_PICK') {
      if (!action.payload?.cardInstanceId) return 'Select a card to gain';
      const pending = state.pendingGainCardPick;
      const source = pending?.gainSource ?? 'market';
      const card =
        source === 'destroyed_pile'
          ? (state.destroyedPile ?? []).find(
              (c) => c.instanceId === action.payload!.cardInstanceId
            )
          : findMarketCard(state, action.payload.cardInstanceId);
      if (!card) return 'Card not available';
      if (
        pending &&
        !isCardEligibleForGainPick(card, {
          maxCost: pending.maxCost,
          type: pending.cardType,
          faction: pending.gainFaction,
        })
      ) {
        return 'Card not eligible to gain';
      }
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Choose a card to gain';
  }

  if (state.pendingPlaceDestroyedOnMarketPick?.playerId === action.playerId) {
    if (action.type === 'PLACE_DESTROYED_ON_MARKET_PICK') {
      if (!action.payload?.cardInstanceId) return 'Select a destroyed card';
      const card = (state.destroyedPile ?? []).find(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );
      if (!card) return 'Card not in destroyed pile';
      return null;
    }
    if (
      action.type === 'PLACE_DESTROYED_ON_MARKET_SKIP' &&
      state.pendingPlaceDestroyedOnMarketPick.optional
    ) {
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Choose a destroyed card for the market deck';
  }

  if (state.pendingCopyCardPick?.playerId === action.playerId) {
    if (action.type === 'COPY_CARD_PICK') {
      if (!action.payload?.cardInstanceId) return 'Select a card to copy';
      const pending = state.pendingCopyCardPick;
      const card =
        pending?.copySource === 'in_play'
          ? findInPlayCopyTarget(state, action.payload.cardInstanceId)
          : findMarketCard(state, action.payload.cardInstanceId);
      if (!card) return 'Card not available';
      if (
        pending?.maxCost != null &&
        (card.definition.cost ?? 0) > pending.maxCost
      ) {
        return 'Card costs too much to copy';
      }
      if (
        pending?.copySource === 'in_play' &&
        pending.sourceCardInstanceId === action.payload.cardInstanceId
      ) {
        return 'Cannot copy this card onto itself';
      }
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return pendingCopyCardPickLabel(state.pendingCopyCardPick);
  }

  if (state.pendingDeckTopRevealPick?.playerId === action.playerId) {
    if (
      action.type === 'DECK_TOP_REVEAL_RESOLVE' &&
      (action.payload?.deckTopRevealChoice === 'destroy' ||
        action.payload?.deckTopRevealChoice === 'return')
    ) {
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Resolve revealed deck cards';
  }

  if (state.pendingDeckLookPick?.playerId === action.playerId) {
    if (action.type === 'DECK_LOOK_CHOOSE_PLAYER' && action.payload?.targetPlayerId) {
      return null;
    }
    if (action.type === 'DECK_LOOK_KEEP_TOP' && action.payload?.cardInstanceId) {
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Resolve deck look effect';
  }

  if (state.pendingGainBandingBonusPick?.playerId === action.playerId) {
    if (action.type === 'CHOOSE_GAIN_BANDING_BONUS' && action.payload?.bandingFaction) {
      return null;
    }
    if (action.type === 'END_PHASE') return null;
    return 'Choose a faction bonus';
  }

  if (
    state.pendingBandingBonus?.playerId === action.playerId &&
    action.type !== 'ACCEPT_BANDING_BONUS' &&
    action.type !== 'DECLINE_BANDING_BONUS'
  ) {
    return 'Resolve banding bonus first';
  }

  if (!canPerformAction(state.phase, action.type, state.status)) {
    return `Action ${action.type} not allowed in ${state.phase}`;
  }

  switch (action.type) {
    case 'PLAY_CARD': {
      if (!action.payload?.cardInstanceId) return 'Missing card';
      if (!player.hand.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Card not in hand';
      }
      const card = player.hand.find((c) => c.instanceId === action.payload!.cardInstanceId)!;
      if (requiresFactionChoiceOnPlay(card.definition)) {
        const chosen = action.payload?.chosenFaction;
        if (!chosen || !isSpyFactionChoice(chosen)) {
          return 'Choose Ludus, Legion, or Senate for Spy';
        }
      }
      if (
        !canFulfillPlayDestroyRequirements(
          state,
          player,
          card,
          (id) => !isGalleryCardPurchased(state, id)
        )
      ) {
        return 'Cannot resolve this card effect (missing destroy target)';
      }
      return null;
    }
    case 'MOVE_CARD': {
      if (!action.payload?.cardInstanceId || !action.payload?.targetZone) {
        return 'Missing move payload';
      }
      if (action.payload.targetZone === 'ARENA_COMMIT') {
        return 'Use the Arena challenge flow to commit fighters';
      }
      return null;
    }
    case 'BUY_CARD': {
      if (!action.payload?.cardInstanceId) return 'Missing card';
      const card = findMarketCard(state, action.payload.cardInstanceId);
      if (!card) return 'Card not available to buy';
      const cost = getEffectivePurchaseCost(state, card);
      if (state.turnCoins < cost) return 'Not enough coins';
      if (
        state.purchaseCostCap != null &&
        (card.definition.cost ?? 0) > state.purchaseCostCap
      ) {
        return `Cards costing more than ${state.purchaseCostCap} cannot be purchased`;
      }
      if (!isPurchasableMarketCard(card)) {
        return 'This card cannot be purchased';
      }
      return null;
    }
    case 'RESOLVE_GALLERY_EVENT':
    case 'EVENT_DISCARD_CARD':
    case 'EVENT_LOSE_ITEM':
    case 'EVENT_SKIP_GALLERY_CHOICE':
    case 'FORCE_OPPONENT_DISCARD':
      return null;
    case 'DRAW_CARD':
    case 'DISCARD_CARD':
    case 'END_PHASE':
      if (
        action.type === 'END_PHASE' &&
        mustEnterArenaBeforeEndTurn(state, action.playerId)
      ) {
        return 'Enter the Arena before ending your turn';
      }
      return null;
    case 'ACCEPT_BANDING_BONUS':
    case 'DECLINE_BANDING_BONUS': {
      if (!state.pendingBandingBonus) return 'No banding bonus pending';
      if (state.pendingBandingBonus.playerId !== action.playerId) {
        return 'Not your banding bonus';
      }
      return null;
    }
    default:
      return 'Unknown action';
  }
}

function refillEpicRow(state: GameState): GameState {
  if (state.epicCards.length >= EPIC_ROW_SIZE) return state;
  const supply = [...(state.epicSupply ?? [])];
  const epicCards = [...state.epicCards];
  while (epicCards.length < EPIC_ROW_SIZE && supply.length > 0) {
    epicCards.push({
      ...supply.shift()!,
      location: 'EPIC_ROW',
      faceUp: true,
    });
  }
  return { ...state, epicCards, epicSupply: supply };
}

function gainFlavorCard(
  state: GameState,
  player: PlayerState
): { state: GameState; player: PlayerState } {
  const flavorDeck = [...state.flavorDeck];
  if (flavorDeck.length === 0) return { state, player };

  const gained = {
    ...flavorDeck.pop()!,
    faceUp: true,
  };

  return {
    state: beginFavorResolution({ ...state, flavorDeck }, gained, player.id),
    player,
  };
}

function runGalleryRefill(state: GameState, maxDraws: number): GameState {
  const favorReturns: CardInstance[] = [];
  let next = fillGalleryRowFromSupply(state, maxDraws, {
    drawCards: (p, count) => drawCards(p, count, favorReturns).player,
    gainFlavorCard,
    createCard: createCardInstance,
  });
  if (favorReturns.length > 0) {
    next = {
      ...next,
      flavorDeck: [...next.flavorDeck, ...favorReturns],
    };
  }
  return next;
}

function applyBandingBonus(
  state: GameState,
  playerIdx: number,
  faction: NonNullable<GameState['pendingBandingBonus']>['faction']
): GameState {
  let next = { ...state };
  let player = { ...next.players[playerIdx] };

  switch (faction) {
    case 'Ludus': {
      const gained = gainFlavorCard(next, player);
      next = gained.state;
      player = gained.player;
      break;
    }
    case 'Senate':
      next = { ...next, turnCoins: next.turnCoins + 2 };
      next = applyImperialTaxIfPending(next, playerIdx, 2);
      break;
    case 'Legion': {
      const drawn = drawCardsIntoState(next, player, 1);
      next = drawn.state;
      player = drawn.player;
      break;
    }
  }

  next.players = [...next.players];
  next.players[playerIdx] = player;
  return next;
}

function recordTurnPlayedCard(
  player: PlayerState,
  card: CardInstance
): PlayerState {
  return {
    ...player,
    turnPlayedCards: [...(player.turnPlayedCards ?? []), { ...card }],
  };
}

function playerHasPendingPlayInteraction(
  state: GameState,
  playerId: string
): boolean {
  return (
    state.pendingCopyCardPick?.playerId === playerId ||
    state.pendingGainCardPick?.playerId === playerId ||
    state.pendingDeckLookPick?.playerId === playerId ||
    state.pendingDeckTopRevealPick?.playerId === playerId ||
    state.pendingGainBandingBonusPick?.playerId === playerId ||
    state.pendingPlaceDestroyedOnMarketPick?.playerId === playerId ||
    state.pendingPlaceCardOnDeckPick?.playerId === playerId ||
    state.pendingCardDestroyPick?.playerId === playerId ||
    state.pendingGalleryDestroyPick?.playerId === playerId ||
    state.pendingEpicDestroyPick?.playerId === playerId ||
    state.pendingAnyDiscardDestroyPick?.playerId === playerId ||
    state.pendingOrEffectChoice?.playerId === playerId ||
    state.pendingOnGainDestroyPick?.playerId === playerId ||
    state.pendingHandDiscard?.playerId === playerId
  );
}

function resumeDeferredBandingBonus(state: GameState): GameState {
  const deferred = state.deferredBandingBonus;
  if (!deferred) return state;
  if (state.pendingBandingBonus) return state;
  if (playerHasPendingPlayInteraction(state, deferred.playerId)) return state;
  return {
    ...state,
    deferredBandingBonus: null,
    pendingBandingBonus: deferred,
  };
}

function maybeOfferBandingBonus(
  state: GameState,
  playerIdx: number,
  playedCard: CardInstance
): GameState {
  if (playedCard.definition.type === 'Item') return state;
  if (state.pendingBandingBonus || state.deferredBandingBonus) return state;

  const player = state.players[playerIdx];
  const claimed = state.turnBandingClaimed ?? [];
  const faction = detectTriggeredBandingFaction(player, claimed, playedCard);
  if (!faction) return state;

  const offer = {
    playerId: player.id,
    faction,
    bonusText: BANDING_BONUS_LABEL[faction],
  };

  if (playerHasPendingPlayInteraction(state, player.id)) {
    return { ...state, deferredBandingBonus: offer };
  }

  return {
    ...state,
    pendingBandingBonus: offer,
  };
}

function enrichActionLog(state: GameState, action: GameAction): GameAction {
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return action;

  if (action.type === 'DEBUG_SPAWN_CARD' && action.payload?.definitionId) {
    const def = getCardDefinition(action.payload.definitionId);
    return {
      ...action,
      payload: {
        ...action.payload,
        cardName: def.name,
        effectSummary: `spawn → ${action.payload.targetZone ?? '?'}`,
      },
    };
  }

  if (action.type === 'PLAY_CARD' && action.payload?.cardInstanceId) {
    const card = player.hand.find((c) => c.instanceId === action.payload!.cardInstanceId);
    if (!card) return action;
    const chosen = action.payload.chosenFaction;
    const cardName =
      chosen && requiresFactionChoiceOnPlay(card.definition)
        ? `${card.definition.name} (${chosen})`
        : card.definition.name;
    return {
      ...action,
      payload: {
        ...action.payload,
        cardName,
        definitionId: card.definitionId,
        ...(chosen ? { chosenFaction: chosen } : {}),
        effectSummary: summarizeCardPlayEffect(card.definition),
      },
    };
  }

  if (action.type === 'BUY_CARD' && action.payload?.cardInstanceId) {
    const card = findMarketCard(state, action.payload.cardInstanceId);
    if (!card) return action;
    return {
      ...action,
      payload: {
        ...action.payload,
        cardName: card.definition.name,
        definitionId: card.definitionId,
        effectSummary: summarizeCardBuyEffect(card.definition),
      },
    };
  }

  if (action.type === 'RESOLVE_GALLERY_EVENT' && state.pendingGalleryEvent) {
    const outcomes = state.galleryEventOutcomes ?? [];
    const decreeOutcomes = state.galleryEventDecreeOutcomes ?? [];
    const destroyedNames = state.lastEventGalleryDestroyNames ?? [];
    const decreeSummary =
      decreeOutcomes.length > 0
        ? decreeOutcomes
            .map((o) => {
              const verb =
                o.result === 'drawn'
                  ? 'drew'
                  : o.result === 'destroyed'
                    ? 'destroyed'
                    : 'kept on deck';
              return `${o.playerName}: ${verb} ${o.cardName} (${o.cost}c)`;
            })
            .join('; ')
        : undefined;
    const outcomeSummary =
      outcomes.length > 0
        ? outcomes
            .map(
              (o) =>
                `${o.playerName}: ${o.cardName} (${o.cost}c) + ${o.gratiaCount} Gratia`
            )
            .join('; ')
        : destroyedNames.length > 0
          ? `Destroyed: ${destroyedNames.join(', ')}`
          : decreeSummary;
    return {
      ...action,
      payload: {
        ...action.payload,
        cardName: state.pendingGalleryEvent.definition.name,
        definitionId: state.pendingGalleryEvent.definitionId,
        effectSummary:
          outcomeSummary ?? state.pendingGalleryEvent.definition.text,
        eventOutcomes: outcomes.length > 0 ? outcomes : undefined,
        eventDecreeOutcomes:
          decreeOutcomes.length > 0 ? decreeOutcomes : undefined,
        destroyedCardNames: destroyedNames.length > 0 ? destroyedNames : undefined,
      },
    };
  }

  if (
    (action.type === 'RESOLVE_FAVOR' ||
      action.type === 'ACCEPT_FAVOR' ||
      action.type === 'DECLINE_FAVOR') &&
    state.pendingFavorReveal
  ) {
    const card = state.pendingFavorReveal.card;
    return {
      ...action,
      payload: {
        ...action.payload,
        cardName: card.definition.name,
        definitionId: card.definitionId,
        effectSummary: card.definition.text,
      },
    };
  }

  if (
    action.type === 'FAVOR_ARENA_WAGER_PICK' &&
    state.pendingFavorReveal &&
    state.pendingFavorArenaWagerPick &&
    action.payload?.cardInstanceId
  ) {
    const zone = action.payload.sourceZone;
    if (zone !== 'HAND' && zone !== 'PLAY_AREA') return action;
    const entries = buildArenaWagerEntries(
      state,
      state.pendingFavorArenaWagerPick.beneficiaryId,
      {
        cardInstanceId: action.payload.cardInstanceId,
        sourceZone: zone,
      },
      state.pendingFavorReveal.card.instanceId
    );
    if (!entries) return action;
    const outcome = resolveArenaWagerWinners(entries);
    const summary = formatArenaWagerLogSummary({
      beneficiaryId: state.pendingFavorArenaWagerPick.beneficiaryId,
      entries,
      ...outcome,
    });
    return {
      ...action,
      payload: {
        ...action.payload,
        cardName: state.pendingFavorReveal.card.definition.name,
        definitionId: state.pendingFavorReveal.card.definitionId,
        effectSummary: summary,
      },
    };
  }

  if (action.type === 'DISMISS_ARENA_WAGER_RESULT') {
    return action;
  }

  if (action.type === 'DISCARD_CARD' && action.payload?.cardInstanceId) {
    const discardPlayer = state.players.find((p) => p.id === action.playerId);
    const card = discardPlayer?.hand.find(
      (c) => c.instanceId === action.payload!.cardInstanceId
    );
    if (card) {
      return {
        ...action,
        payload: {
          ...action.payload,
          cardName: card.definition.name,
          definitionId: card.definitionId,
          effectSummary: state.pendingHandDiscard?.sourceCardName
            ? `Discarded for ${state.pendingHandDiscard.sourceCardName}`
            : state.pendingForcedOpponentDiscards?.sourceCardName
              ? `Forced discard (${state.pendingForcedOpponentDiscards.sourceCardName})`
              : undefined,
        },
      };
    }
  }

  if (action.type === 'CARD_DESTROY_PICK' && action.payload?.cardInstanceId) {
    const pick = state.pendingCardDestroyPick;
    const zone = action.payload.sourceZone ?? 'HAND';
    const pool =
      zone === 'DISCARD'
        ? player.discard
        : zone === 'PLAY_AREA'
          ? player.playArea
          : player.hand;
    const card = pool.find((c) => c.instanceId === action.payload!.cardInstanceId);
    if (card) {
      return {
        ...action,
        payload: {
          ...action.payload,
          cardName: card.definition.name,
          definitionId: card.definitionId,
          effectSummary: pick?.sourceCardName
            ? `Destroyed for ${pick.sourceCardName}`
            : undefined,
        },
      };
    }
  }

  if (
    action.type === 'ANY_DISCARD_DESTROY_PICK' &&
    action.payload?.cardInstanceId &&
    action.payload?.targetPlayerId
  ) {
    const target = state.players.find((p) => p.id === action.payload!.targetPlayerId);
    const card = target?.discard.find(
      (c) => c.instanceId === action.payload!.cardInstanceId
    );
    if (card) {
      const pick = state.pendingAnyDiscardDestroyPick;
      return {
        ...action,
        payload: {
          ...action.payload,
          cardName: card.definition.name,
          definitionId: card.definitionId,
          effectSummary: pick?.sourceCardName
            ? `Destroyed ${card.definition.name} (${target?.name}) for ${pick.sourceCardName}`
            : `Destroyed ${card.definition.name} (${target?.name})`,
        },
      };
    }
  }

  if (action.type === 'GALLERY_DESTROY_PICK' && action.payload?.cardInstanceId) {
    const card = state.galleryCards.find(
      (c) => c.instanceId === action.payload!.cardInstanceId
    );
    if (card) {
      const pick = state.pendingGalleryDestroyPick;
      return {
        ...action,
        payload: {
          ...action.payload,
          cardName: card.definition.name,
          definitionId: card.definitionId,
          effectSummary: pick?.sourceCardName
            ? `Destroyed for ${pick.sourceCardName}`
            : undefined,
        },
      };
    }
  }

  if (action.type === 'GAIN_CARD_PICK' && action.payload?.cardInstanceId) {
    const pending = state.pendingGainCardPick;
    const source = pending?.gainSource ?? 'market';
    const card =
      source === 'destroyed_pile'
        ? (state.destroyedPile ?? []).find(
            (c) => c.instanceId === action.payload!.cardInstanceId
          )
        : findMarketCard(state, action.payload.cardInstanceId);
    if (card) {
      return {
        ...action,
        payload: {
          ...action.payload,
          cardName: card.definition.name,
          definitionId: card.definitionId,
          effectSummary: pending?.sourceCardName
            ? `Gained for ${pending.sourceCardName}`
            : undefined,
        },
      };
    }
  }

  if (
    action.type === 'PLACE_DESTROYED_ON_MARKET_PICK' &&
    action.payload?.cardInstanceId
  ) {
    const card = (state.destroyedPile ?? []).find(
      (c) => c.instanceId === action.payload!.cardInstanceId
    );
    if (card) {
      return {
        ...action,
        payload: {
          ...action.payload,
          cardName: card.definition.name,
          definitionId: card.definitionId,
          effectSummary: state.pendingPlaceDestroyedOnMarketPick?.sourceCardName
            ? `Placed on market deck (${state.pendingPlaceDestroyedOnMarketPick.sourceCardName})`
            : 'Placed on market deck',
        },
      };
    }
  }

  if (action.type === 'COPY_CARD_PICK' && action.payload?.cardInstanceId) {
    const pending = state.pendingCopyCardPick;
    const card =
      pending?.copySource === 'in_play'
        ? findInPlayCopyTarget(state, action.payload.cardInstanceId)
        : findMarketCard(state, action.payload.cardInstanceId);
    if (card) {
      return {
        ...action,
        payload: {
          ...action.payload,
          cardName: card.definition.name,
          definitionId: card.definitionId,
          effectSummary: state.pendingCopyCardPick?.sourceCardName
            ? `Copied for ${state.pendingCopyCardPick.sourceCardName}`
            : undefined,
        },
      };
    }
  }

  if (action.type === 'EVENT_DISCARD_CARD' && action.payload?.cardInstanceId) {
    const discardPlayer = state.players.find((p) => p.id === action.playerId);
    const card = discardPlayer?.hand.find(
      (c) => c.instanceId === action.payload!.cardInstanceId
    );
    if (card) {
      return {
        ...action,
        payload: {
          ...action.payload,
          cardName: card.definition.name,
          definitionId: card.definitionId,
        },
      };
    }
  }

  if (action.type === 'FORCE_OPPONENT_DISCARD' && action.payload?.cardInstanceId) {
    const pending = state.pendingForcedOpponentDiscards;
    const target = pending
      ? state.players.find((p) => p.id === pending.targetPlayerId)
      : undefined;
    const card = target?.hand.find(
      (c) => c.instanceId === action.payload!.cardInstanceId
    );
    if (card) {
      return {
        ...action,
        payload: {
          ...action.payload,
          cardName: card.definition.name,
          definitionId: card.definitionId,
        },
      };
    }
  }

  if (action.type === 'ARENA_RESPOND' && action.payload?.cardInstanceId) {
    const card = player.hand.find(
      (c) => c.instanceId === action.payload!.cardInstanceId
    );
    if (card) {
      return {
        ...action,
        payload: {
          ...action.payload,
          cardName: card.definition.name,
          definitionId: card.definitionId,
        },
      };
    }
  }

  return action;
}

function drawCards(
  player: PlayerState,
  count: number,
  favorReturns?: CardInstance[]
): { player: PlayerState; favorReturns: CardInstance[] } {
  const collected = favorReturns ?? [];
  const newDeck = [...player.deck];
  const newHand = [...player.hand];
  const newDiscard = [...player.discard];

  for (let i = 0; i < count; i++) {
    if (newDeck.length === 0 && newDiscard.length > 0) {
      const { deckable, favorReturns: fromDiscard } =
        splitPlayerDeckCycleCards(newDiscard);
      collected.push(...fromDiscard);
      if (deckable.length === 0) break;
      const reshuffled = shuffle(deckable).map((c) => ({
        ...c,
        location: 'DECK' as const,
        faceUp: false,
        chosenFaction: undefined,
      }));
      newDeck.push(...reshuffled);
      newDiscard.length = 0;
    }
    if (newDeck.length > 0) {
      const drawn = newDeck.shift()!;
      newHand.push({
        ...drawn,
        location: 'HAND',
        faceUp: true,
        chosenFaction: undefined,
      });
    }
  }

  return {
    player: { ...player, deck: newDeck, hand: newHand, discard: newDiscard },
    favorReturns: collected,
  };
}

function drawCardsIntoState(
  state: GameState,
  player: PlayerState,
  count: number
): { state: GameState; player: PlayerState } {
  const { player: nextPlayer, favorReturns } = drawCards(player, count);
  return {
    state:
      favorReturns.length > 0
        ? { ...state, flavorDeck: [...state.flavorDeck, ...favorReturns] }
        : state,
    player: nextPlayer,
  };
}

function cleanupTurnPlayer(player: PlayerState): {
  player: PlayerState;
  favorReturns: CardInstance[];
} {
  const toDiscard = (c: CardInstance) => ({
    ...c,
    location: 'DISCARD' as const,
    faceUp: true,
    chosenFaction: undefined,
  });

  const deckSplit = splitPlayerDeckCycleCards(player.deck);
  const existingDiscardSplit = splitPlayerDeckCycleCards(
    player.discard.map(toDiscard)
  );
  const fromPlaySplit = splitPlayerDeckCycleCards([
    ...player.playArea.map(toDiscard),
    ...player.itemsInPlay.map(toDiscard),
    ...player.hand.map(toDiscard),
  ]);

  const favorReturns = [
    ...deckSplit.favorReturns,
    ...existingDiscardSplit.favorReturns,
    ...fromPlaySplit.favorReturns,
  ];

  return {
    player: {
      ...player,
      deck: deckSplit.deckable,
      hand: [],
      playArea: [],
      itemsInPlay: [],
      discard: [...existingDiscardSplit.deckable, ...fromPlaySplit.deckable],
    },
    favorReturns,
  };
}

/** Board is visible; hands empty until all players ready. */
export function createPregameState(
  playerSetups: PlayerSetup[],
  gameId = 'game_1'
): GameState {
  const players = playerSetups.slice(0, MAX_PLAYERS).map((setup) => createPlayer(setup, false));
  const market = createMarketCards();

  return {
    id: gameId,
    status: 'active',
    version: 1,
    players,
    arenaCard: market.arenaCard,
    arenaDeck: market.arenaDeck,
    arenaCommitZone: [],
    arenaChallenge: null,
    lastArenaResult: null,
    galleryCards: market.galleryCards,
    galleryPurchasedBy: {},
    gallerySupply: market.gallerySupply,
    recruitCard: market.recruitCard,
    recruitDeck: market.recruitDeck,
    epicCards: market.epicCards,
    epicSupply: market.epicSupply,
    flavorDeck: market.flavorDeck,
    flavorDiscard: market.flavorDiscard ?? [],
    disfavorDeck: market.disfavorDeck,
    turnPlayerId: '',
    phase: 'PREGAME',
    turnNumber: 0,
    actionLog: [],
    readyPlayerIds: [],
    turnCoins: 0,
    turnValor: 0,
    turnBandingClaimed: [],
    pendingBandingBonus: null,
    deferredBandingBonus: null,
    turnActionHighlight: null,
    pendingGalleryEvent: null,
    galleryEventOutcomes: null,
    pendingEventHandChoices: [],
    pendingEventDiscards: [],
    pendingEventItemChoices: [],
    pendingEventOptionalDiscards: null,
    pendingFavorReveal: null,
    pendingFavorQueue: [],
    pendingFavorDestroyPick: null,
    pendingFavorArenaWagerPick: null,
    pendingFavorReplayPick: null,
    pendingFavorReplayRemovalId: null,
    lastArenaWagerResult: null,
    pendingCardDestroyPick: null,
    pendingGalleryDestroyPick: null,
    pendingEpicDestroyPick: null,
    pendingAnyDiscardDestroyPick: null,
    pendingOrEffectChoice: null,
    pendingOnGainDestroyPick: null,
    pendingHandDiscard: null,
    pendingForcedOpponentDiscards: null,
    pendingArenaLoss: null,
    deferredTurnEnd: null,
    pendingArenaReplacement: false,
    purchaseCostCap: null,
    purchaseCostCapActiveForPlayerId: null,
    arenaOpen: false,
    turnArenaResolved: false,
    turnArenaExempt: false,
    destroyedPile: [],
  };
}

export function createInitialGameState(
  playerSetups: PlayerSetup[],
  gameId = 'game_1'
): GameState {
  return activateGameFromPregame({
    ...createPregameState(playerSetups, gameId),
    readyPlayerIds: playerSetups.map((p) => p.id),
  });
}

export function createLobbyGameState(
  gameId: string,
  playerSetups: PlayerSetup[]
): GameState {
  return {
    id: gameId,
    status: 'lobby',
    version: 1,
    players: playerSetups.map((s) => ({
      id: s.id,
      name: s.name,
      isAI: s.isAI ?? false,
      victoryPoints: 0,
      hand: [],
      deck: [],
      discard: [],
      playArea: [],
      itemsInPlay: [],
    })),
    arenaCard: null,
    arenaDeck: [],
    arenaCommitZone: [],
    galleryCards: [],
    galleryPurchasedBy: {},
    recruitCard: null,
    recruitDeck: [],
    epicCards: [],
    flavorDeck: [],
    flavorDiscard: [],
    disfavorDeck: [],
    turnPlayerId: '',
    phase: 'PREGAME',
    turnNumber: 0,
    actionLog: [],
    readyPlayerIds: [],
    turnCoins: 0,
    turnValor: 0,
    turnBandingClaimed: [],
    pendingBandingBonus: null,
    deferredBandingBonus: null,
    turnActionHighlight: null,
    pendingGalleryEvent: null,
    galleryEventOutcomes: null,
    pendingEventHandChoices: [],
    pendingEventDiscards: [],
    pendingEventItemChoices: [],
    pendingEventOptionalDiscards: null,
    pendingFavorReveal: null,
    pendingFavorQueue: [],
    pendingFavorDestroyPick: null,
    pendingFavorArenaWagerPick: null,
    pendingFavorReplayPick: null,
    pendingFavorReplayRemovalId: null,
    lastArenaWagerResult: null,
    pendingCardDestroyPick: null,
    pendingGalleryDestroyPick: null,
    pendingEpicDestroyPick: null,
    pendingAnyDiscardDestroyPick: null,
    pendingOrEffectChoice: null,
    pendingOnGainDestroyPick: null,
    pendingHandDiscard: null,
    pendingForcedOpponentDiscards: null,
    pendingArenaLoss: null,
    deferredTurnEnd: null,
    pendingArenaReplacement: false,
    purchaseCostCap: null,
    destroyedPile: [],
  };
}

export function processGameAction(
  state: GameState,
  action: GameAction
): GameState {
  const error = validateGameAction(state, action);
  if (error) {
    console.warn('[GameEngine] Rejected action:', error, action.type);
    return state;
  }

  const enrichedAction = enrichActionLog(state, action);
  let next: GameState = {
    ...state,
    actionLog: [...state.actionLog, enrichedAction],
  };
  const playerIdx = next.players.findIndex((p) => p.id === action.playerId);
  if (playerIdx === -1 && action.type !== 'START_GAME') return next;

  let player =
    playerIdx >= 0
      ? { ...next.players[playerIdx] }
      : null;

  switch (action.type) {
    case 'END_GAME': {
      const leader = [...next.players].sort(
        (a, b) => getPlayerTotalVp(b) - getPlayerTotalVp(a)
      )[0];
      return finishGameIfNeeded({
        ...next,
        status: 'finished',
        winnerId: leader?.id ?? null,
      });
    }

    case 'PLAYER_READY': {
      const readyPlayerIds = [...next.readyPlayerIds, action.playerId];
      next.readyPlayerIds = readyPlayerIds;
      if (allPlayersReady(next)) {
        return activateGameFromPregame(next);
      }
      return next;
    }

    case 'DRAW_CARD': {
      if (!player) return next;
      const count = action.payload?.count ?? 1;
      const drawn = drawCardsIntoState(next, player, count);
      next = drawn.state;
      player = drawn.player;
      next.players = [...next.players];
      next.players[playerIdx] = player;
      return next;
    }

    case 'PLAY_CARD': {
      if (!player || !action.payload?.cardInstanceId) return next;
      const cardIdx = player.hand.findIndex(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );
      if (cardIdx === -1) return next;

      const card = { ...player.hand[cardIdx] };
      player.hand = player.hand.filter((_, i) => i !== cardIdx);

      if (
        requiresFactionChoiceOnPlay(card.definition) &&
        action.payload?.chosenFaction &&
        isSpyFactionChoice(action.payload.chosenFaction)
      ) {
        card.chosenFaction = action.payload.chosenFaction;
      }

      const isFavorCard =
        isFavorDefinitionId(card) || card.definition.type === 'Favor';

      if (isFavorCard) {
        next.players = [...next.players];
        next.players[playerIdx] = player;
        return beginFavorResolution(next, card, player.id);
      }

      if (card.definition.type === 'Item') {
        card.location = 'ITEMS_IN_PLAY';
        player.itemsInPlay = [...player.itemsInPlay, card];
      } else {
        card.location = 'PLAY_AREA';
        player.playArea = [...player.playArea, card];
      }

      next.players = [...next.players];
      next.players[playerIdx] = recordTurnPlayedCard(player, card);
      player = next.players[playerIdx];
      let result = applyCardPlayEffects(next, playerIdx, card);
      if (result.lastMassHandRedrawLog?.length) {
        const summary = formatMassHandRedrawSummary(
          result.lastMassHandRedrawLog,
          player.id,
          card.definition.effects?.draw_cards ?? 0
        );
        const log = [...result.actionLog];
        const lastIdx = log.length - 1;
        if (lastIdx >= 0) {
          log[lastIdx] = {
            ...log[lastIdx],
            payload: {
              ...log[lastIdx].payload,
              effectSummary: summary,
            },
          };
        }
        result = {
          ...result,
          actionLog: log,
          lastMassHandRedrawLog: null,
        };
      }
      result = maybeBeginForcedOpponentDiscards(result, playerIdx, card);
      result = maybeOfferBandingBonus(result, playerIdx, card);
      return result;
    }

    case 'ACCEPT_BANDING_BONUS': {
      if (!player || !next.pendingBandingBonus) return next;
      const faction = next.pendingBandingBonus.faction;
      let resolved = applyBandingBonus(next, playerIdx, faction);
      resolved = {
        ...resolved,
        pendingBandingBonus: null,
    deferredBandingBonus: null,
        turnBandingClaimed: [...(resolved.turnBandingClaimed ?? []), faction],
      };
      return resolved;
    }

    case 'DECLINE_BANDING_BONUS': {
      if (!next.pendingBandingBonus) return next;
      const faction = next.pendingBandingBonus.faction;
      return {
        ...next,
        pendingBandingBonus: null,
    deferredBandingBonus: null,
        turnBandingClaimed: [...(next.turnBandingClaimed ?? []), faction],
      };
    }

    case 'FORCE_OPPONENT_DISCARD': {
      const pending = next.pendingForcedOpponentDiscards;
      if (!pending || !action.payload?.cardInstanceId) return next;
      if (pending.controllerPicks) {
        if (action.playerId !== pending.controllerId) return next;
      } else if (action.playerId !== pending.targetPlayerId) {
        return next;
      }
      return handleForcedOpponentSelfDiscard(
        next,
        pending,
        action.payload.cardInstanceId
      );
    }

    case 'CHOOSE_FORCE_DISCARD_TARGET': {
      const pending = next.pendingForcedOpponentDiscards;
      if (!pending || pending.phase !== 'choose_opponent') return next;
      if (action.playerId !== pending.controllerId) return next;
      const targetId = action.payload?.targetPlayerId;
      if (!targetId || !pending.opponentCandidateIds?.includes(targetId)) {
        return next;
      }
      return {
        ...next,
        pendingForcedOpponentDiscards: {
          ...pending,
          targetPlayerId: targetId,
          phase: 'discard',
          remainingForTarget: pending.perOpponent,
        },
      };
    }

    case 'PLACE_CARD_ON_DECK_PICK': {
      const pending = next.pendingPlaceCardOnDeckPick;
      if (!pending || action.playerId !== pending.playerId || !player) return next;
      if (!action.payload?.cardInstanceId) return next;

      const updated = placeCardFromDiscardOnDeck(
        player,
        action.payload.cardInstanceId,
        pending.position
      );
      if (!updated) return next;

      next.players = [...next.players];
      next.players[playerIdx] = updated;
      return { ...next, pendingPlaceCardOnDeckPick: null };
    }

    case 'PLACE_CARD_ON_DECK_SKIP': {
      const pending = next.pendingPlaceCardOnDeckPick;
      if (!pending?.optional || action.playerId !== pending.playerId) return next;
      return { ...next, pendingPlaceCardOnDeckPick: null };
    }

    case 'GAIN_CARD_PICK': {
      const pending = next.pendingGainCardPick;
      if (!pending || action.playerId !== pending.playerId || !player) return next;
      if (!action.payload?.cardInstanceId) return next;

      const source = pending.gainSource ?? 'market';
      const gained =
        source === 'destroyed_pile'
          ? gainDestroyedCardToPlayer(
              next,
              playerIdx,
              action.payload.cardInstanceId,
              pending.maxCost
            )
          : gainMarketCardToPlayer(
              next,
              playerIdx,
              action.payload.cardInstanceId,
              (_, id) => !isGalleryCardPurchased(next, id)
            );
      if (!gained.gained) return state;
      if (
        pending.maxCost != null &&
        !isCardEligibleForGainPick(gained.gained, {
          maxCost: pending.maxCost,
          type: pending.cardType,
          faction: pending.gainFaction,
        })
      ) {
        return state;
      }
      next = finishGainCardPick(gained.state, playerIdx, pending);
      return next;
    }

    case 'PLACE_DESTROYED_ON_MARKET_PICK': {
      const pending = next.pendingPlaceDestroyedOnMarketPick;
      if (!pending || action.playerId !== pending.playerId) return next;
      if (!action.payload?.cardInstanceId) return next;

      const placed = placeDestroyedCardOnMarketSupply(
        next,
        action.payload.cardInstanceId
      );
      if (!placed.placed) return next;
      return { ...placed.state, pendingPlaceDestroyedOnMarketPick: null };
    }

    case 'PLACE_DESTROYED_ON_MARKET_SKIP': {
      const pending = next.pendingPlaceDestroyedOnMarketPick;
      if (!pending?.optional || action.playerId !== pending.playerId) return next;
      return { ...next, pendingPlaceDestroyedOnMarketPick: null };
    }

    case 'COPY_CARD_PICK': {
      const pending = next.pendingCopyCardPick;
      if (!pending || action.playerId !== pending.playerId || !player) return next;
      if (!action.payload?.cardInstanceId) return next;

      const copiedCard =
        pending.copySource === 'in_play'
          ? findInPlayCopyTarget(next, action.payload.cardInstanceId)
          : findMarketCard(next, action.payload.cardInstanceId);
      if (!copiedCard) return next;
      if (
        pending.maxCost != null &&
        (copiedCard.definition.cost ?? 0) > pending.maxCost
      ) {
        return next;
      }
      if (
        pending.copySource === 'in_play' &&
        pending.sourceCardInstanceId === copiedCard.instanceId
      ) {
        return next;
      }

      const stub: CardInstance = {
        instanceId: pending.sourceCardInstanceId ?? copiedCard.instanceId,
        definitionId: copiedCard.definitionId,
        definition: copiedCard.definition,
        location: 'PLAY_AREA',
        ownerId: player.id,
        faceUp: true,
      };

      next = { ...next, pendingCopyCardPick: null };

      const drawForOnGain = (p: PlayerState, count: number) =>
        drawCardsIntoState(next, p, count).player;

      if (cardHasOnGainEffects(copiedCard)) {
        next = applyOnGainEffects(
          next,
          playerIdx,
          copiedCard,
          drawForOnGain,
          (_, id) => !isGalleryCardPurchased(next, id)
        );
        return beginOnGainDestroyIfNeeded(next, playerIdx, copiedCard);
      }

      next = applyCardPlayEffects(next, playerIdx, stub, {
        skipOr: true,
      });
      return next;
    }

    case 'DECK_LOOK_CHOOSE_PLAYER': {
      const pending = next.pendingDeckLookPick;
      if (!pending || action.playerId !== pending.playerId || !player) return next;
      const targetId = action.payload?.targetPlayerId;
      if (!targetId) return next;
      const targetIdx = next.players.findIndex((p) => p.id === targetId);
      if (targetIdx === -1) return next;
      const refilled = refillPlayerDeckFromDiscard(next.players[targetIdx]);
      const target = { ...next.players[targetIdx], ...refilled.player };
      next.players = [...next.players];
      next.players[targetIdx] = target;
      if (refilled.favorReturns.length > 0) {
        next = {
          ...next,
          flavorDeck: [...next.flavorDeck, ...refilled.favorReturns],
        };
      }
      const viewed = target.deck
        .slice(0, Math.min(pending.lookCount, target.deck.length))
        .map((card) => ({ ...card, faceUp: true }));
      if (viewed.length < 2) {
        return { ...next, pendingDeckLookPick: null };
      }
      return {
        ...next,
        pendingDeckLookPick: {
          ...pending,
          phase: 'keep_top',
          targetPlayerId: targetId,
          viewedCards: viewed,
        },
      };
    }

    case 'DECK_LOOK_KEEP_TOP': {
      const pending = next.pendingDeckLookPick;
      if (
        !pending ||
        pending.phase !== 'keep_top' ||
        action.playerId !== pending.playerId ||
        !pending.targetPlayerId ||
        !action.payload?.cardInstanceId
      ) {
        return next;
      }
      const targetIdx = next.players.findIndex((p) => p.id === pending.targetPlayerId);
      if (targetIdx === -1) return next;
      const viewed = pending.viewedCards ?? [];
      const updated = reorderDeckKeepTop(
        next.players[targetIdx],
        viewed,
        action.payload.cardInstanceId
      );
      next.players = [...next.players];
      next.players[targetIdx] = updated;
      return { ...next, pendingDeckLookPick: null };
    }

    case 'DECK_TOP_REVEAL_RESOLVE': {
      const pending = next.pendingDeckTopRevealPick;
      const choice = action.payload?.deckTopRevealChoice;
      if (
        !pending ||
        action.playerId !== pending.playerId ||
        !player ||
        (choice !== 'destroy' && choice !== 'return')
      ) {
        return next;
      }

      const current = getCurrentDeckTopRevealPick(pending);
      if (!current) {
        return { ...next, pendingDeckTopRevealPick: null };
      }

      const targetIdx = next.players.findIndex(
        (p) => p.id === current.targetPlayerId
      );
      if (targetIdx === -1) {
        return { ...next, pendingDeckTopRevealPick: null };
      }

      let target = { ...next.players[targetIdx] };
      if (choice === 'destroy') {
        next = addToDestroyedPile(next, [
          { ...current.card, ownerId: current.targetPlayerId },
        ]);
      } else {
        target.deck = [
          { ...current.card, faceUp: false, location: 'DECK' },
          ...target.deck,
        ];
        next.players = [...next.players];
        next.players[targetIdx] = target;
      }

      const nextIndex = pending.currentIndex + 1;
      if (nextIndex >= pending.picks.length) {
        return { ...next, pendingDeckTopRevealPick: null };
      }

      return {
        ...next,
        pendingDeckTopRevealPick: {
          ...pending,
          currentIndex: nextIndex,
        },
      };
    }

    case 'CHOOSE_GAIN_BANDING_BONUS': {
      const pending = next.pendingGainBandingBonusPick;
      if (!pending || action.playerId !== pending.playerId) return next;
      const faction = action.payload?.bandingFaction;
      if (!faction) return next;
      next = { ...next, pendingGainBandingBonusPick: null };
      return applyBandingBonus(next, playerIdx, faction);
    }

    case 'RESOLVE_ARENA_LOSS': {
      const pending = next.pendingArenaLoss;
      if (!pending || action.playerId !== pending.playerId) return next;

      const playerIdx = next.players.findIndex((p) => p.id === pending.playerId);
      if (playerIdx === -1) return next;

      const choice = action.payload?.arenaLossChoice;
      const cardId = action.payload?.cardInstanceId;

      if (pending.phase === 'primus_choice') {
        if (choice === 'disfavor') {
          const result = giveDisfavorToPlayer(
            next,
            next.players[playerIdx],
            pending.loss.disfavorCount ?? 5
          );
          const players = [...next.players];
          players[playerIdx] = result.player;
          return { ...result.state, players, pendingArenaLoss: null };
        }

        if (choice === 'destroy_fighter') {
          const candidates =
            pending.primusCandidates ??
            getPrimusDestroyCandidates(pending.committedFighters);
          if (candidates.length > 1) {
            return {
              ...next,
              pendingArenaLoss: {
                ...pending,
                phase: 'primus_fighter_pick',
                primusCandidates: candidates,
              },
            };
          }
          const targetId = candidates[0]?.instanceId;
          if (!targetId) {
            return { ...next, pendingArenaLoss: null };
          }
          return {
            ...destroyFighterFromDiscard(next, playerIdx, targetId),
            pendingArenaLoss: null,
          };
        }
        return next;
      }

      if (
        (pending.phase === 'destroy_fighter_pick' ||
          pending.phase === 'primus_fighter_pick') &&
        cardId
      ) {
        let resolved = destroyFighterFromDiscard(next, playerIdx, cardId);
        const remaining = (pending.remainingDestroyPicks ?? 1) - 1;
        if (pending.phase === 'destroy_fighter_pick' && remaining > 0) {
          resolved = {
            ...resolved,
            pendingArenaLoss: {
              ...pending,
              remainingDestroyPicks: remaining,
            },
          };
        } else {
          resolved = { ...resolved, pendingArenaLoss: null };
        }
        return resolved;
      }

      return next;
    }

    case 'CARD_DESTROY_PICK': {
      const pending = next.pendingCardDestroyPick;
      if (!pending || !player || action.playerId !== pending.playerId) return next;
      if (!action.payload?.cardInstanceId) return next;

      const zone = action.payload.sourceZone ?? 'HAND';
      const removed = removeCardFromPlayerZone(
        player,
        action.payload.cardInstanceId,
        zone
      );
      if (!removed.card) return next;

      player = removed.player;
      next.players = [...next.players];
      next.players[playerIdx] = player;
      next = addToDestroyedPile(next, [{ ...removed.card, ownerId: player.id }]);

      if (pending.rewardCoinsFromCost) {
        next = {
          ...next,
          turnCoins:
            next.turnCoins + (removed.card.definition?.cost ?? 0),
        };
      }

      const remaining = pending.remaining - 1;
      if (remaining > 0) {
        return {
          ...next,
          pendingCardDestroyPick: { ...pending, remaining },
        };
      }

      if (pending.optionalBlockFollowUp) {
        next = applyOptionalBlockFollowUp(
          next,
          playerIdx,
          pending.optionalBlockFollowUp
        );
      }

      return finishCardDestroyPick(next, playerIdx, pending);
    }

    case 'CARD_DESTROY_SKIP': {
      const pending = next.pendingCardDestroyPick;
      if (!pending?.optional || action.playerId !== pending.playerId) return next;
      return finishCardDestroyPick(next, playerIdx, pending);
    }

    case 'GALLERY_DESTROY_PICK': {
      const pending = next.pendingGalleryDestroyPick;
      if (!pending || action.playerId !== pending.playerId) return next;
      if (!action.payload?.cardInstanceId) return next;
      if (isGalleryCardPurchased(next, action.payload.cardInstanceId)) return next;

      next = destroyGalleryCard(
        next,
        action.payload.cardInstanceId,
        pending.refillGallery !== false
      );
      const destroyedSoFar = (pending.destroyedSoFar ?? 0) + 1;
      const remaining = pending.remaining - 1;
      if (remaining > 0) {
        return {
          ...next,
          pendingGalleryDestroyPick: { ...pending, remaining, destroyedSoFar },
        };
      }
      return finishGalleryDestroyPick(next, playerIdx, {
        ...pending,
        destroyedSoFar,
      });
    }

    case 'GALLERY_DESTROY_SKIP': {
      const pending = next.pendingGalleryDestroyPick;
      if (!pending?.optional || action.playerId !== pending.playerId) return next;
      return finishGalleryDestroyPick(next, playerIdx, pending);
    }

    case 'EPIC_DESTROY_PICK': {
      const pending = next.pendingEpicDestroyPick;
      if (!pending || action.playerId !== pending.playerId) return next;
      if (!action.payload?.cardInstanceId) return next;

      next = destroyEpicMarketCard(next, action.payload.cardInstanceId);
      if (pending.replaceAtEndOfTurn) {
        next = {
          ...next,
          deferredEpicRefillSlots: (next.deferredEpicRefillSlots ?? 0) + 1,
        };
      } else {
        next = refillEpicRow(next);
      }
      return { ...next, pendingEpicDestroyPick: null };
    }

    case 'ANY_DISCARD_DESTROY_PICK': {
      const pending = next.pendingAnyDiscardDestroyPick;
      if (!pending || action.playerId !== pending.playerId) return next;
      const targetId = action.payload?.targetPlayerId;
      const cardId = action.payload?.cardInstanceId;
      if (!targetId || !cardId) return next;

      const targetIdx = next.players.findIndex((p) => p.id === targetId);
      if (targetIdx === -1) return next;
      let target = { ...next.players[targetIdx] };
      const discardIdx = target.discard.findIndex((c) => c.instanceId === cardId);
      if (discardIdx === -1) return next;

      const removed = target.discard[discardIdx];
      target.discard = target.discard.filter((_, i) => i !== discardIdx);
      next.players = [...next.players];
      next.players[targetIdx] = target;
      next = addToDestroyedPile(next, [{ ...removed, ownerId: targetId }]);

      const remaining = pending.remaining - 1;
      if (remaining > 0) {
        return {
          ...next,
          pendingAnyDiscardDestroyPick: { ...pending, remaining },
        };
      }
      return finishAnyDiscardDestroyPick(next, playerIdx, pending);
    }

    case 'CHOOSE_OR_EFFECT': {
      const pending = next.pendingOrEffectChoice;
      if (!pending || action.playerId !== pending.playerId || !player) return next;
      const branchIndex = action.payload?.branchIndex;
      if (branchIndex == null || branchIndex < 0) return next;

      next = { ...next, pendingOrEffectChoice: null };
      const played =
        player.playArea.find((c) => c.instanceId === pending.sourceCardInstanceId) ??
        player.itemsInPlay.find((c) => c.instanceId === pending.sourceCardInstanceId);
      if (!played) return next;

      if (branchIndex === 0) {
        if (pending.baseGainCoins > 0) {
          next = {
            ...next,
            turnCoins: next.turnCoins + pending.baseGainCoins,
          };
          next = applyImperialTaxIfPending(next, playerIdx, pending.baseGainCoins);
        }
        return maybeOfferBandingBonus(next, playerIdx, played);
      }

      const branch = pending.branches[branchIndex - 1];
      if (!branch) return next;
      if (
        branch.if_first_card_played &&
        !isFirstCardPlayedThisTurn(player, pending.sourceCardInstanceId)
      ) {
        return next;
      }
      next = applyBranchEffects(next, playerIdx, branch, played);
      return maybeOfferBandingBonus(next, playerIdx, played);
    }

    case 'ON_GAIN_DESTROY_PICK': {
      const pending = next.pendingOnGainDestroyPick;
      if (!pending || action.playerId !== pending.playerId || !player) return next;
      if (!action.payload?.cardInstanceId) return next;
      const zone = action.payload.sourceZone ?? 'HAND';
      const removed = removeCardFromPlayerZone(
        player,
        action.payload.cardInstanceId,
        zone
      );
      if (!removed.card) return next;
      player = removed.player;
      next.players = [...next.players];
      next.players[playerIdx] = player;
      next = addToDestroyedPile(next, [{ ...removed.card, ownerId: player.id }]);
      const remaining = pending.remaining - 1;
      if (remaining > 0) {
        return {
          ...next,
          pendingOnGainDestroyPick: { ...pending, remaining },
        };
      }
      return { ...next, pendingOnGainDestroyPick: null };
    }

    case 'ON_GAIN_DESTROY_SKIP': {
      const pending = next.pendingOnGainDestroyPick;
      if (!pending?.optional || action.playerId !== pending.playerId) return next;
      return { ...next, pendingOnGainDestroyPick: null };
    }

    case 'DISCARD_CARD': {
      if (!player || !action.payload?.cardInstanceId) return next;

      if (next.pendingForcedOpponentDiscards?.targetPlayerId === action.playerId) {
        return handleForcedOpponentSelfDiscard(
          next,
          next.pendingForcedOpponentDiscards,
          action.payload.cardInstanceId
        );
      }

      if (next.pendingHandDiscard?.playerId === action.playerId) {
        const handIdx = player.hand.findIndex(
          (c) => c.instanceId === action.payload!.cardInstanceId
        );
        if (handIdx === -1) return next;

        const card = {
          ...player.hand[handIdx],
          location: 'DISCARD' as const,
          faceUp: true,
          chosenFaction: undefined,
        };
        player.hand = player.hand.filter((_, i) => i !== handIdx);
        player.discard = [...player.discard, card];

        const remaining = next.pendingHandDiscard.remaining - 1;
        next.pendingHandDiscard =
          remaining > 0
            ? { ...next.pendingHandDiscard, remaining }
            : null;

        next.players = [...next.players];
        next.players[playerIdx] = player;
        return next;
      }

      const zones: (keyof PlayerState)[] = ['hand', 'playArea', 'itemsInPlay'];
      for (const zone of zones) {
        const arr = player[zone] as CardInstance[];
        const idx = arr.findIndex(
          (c) => c.instanceId === action.payload!.cardInstanceId
        );
        if (idx !== -1) {
          const card = { ...arr[idx], location: 'DISCARD' as const, faceUp: true };
          (player[zone] as CardInstance[]) = arr.filter((_, i) => i !== idx);
          player.discard = [...player.discard, card];
          break;
        }
      }
      next.players = [...next.players];
      next.players[playerIdx] = player;
      return next;
    }

    case 'MOVE_CARD': {
      if (!player || !action.payload?.cardInstanceId || !action.payload?.targetZone) {
        return next;
      }
      // Arena fighters are committed via CONFIRM_ARENA_FIGHTERS only.
      next.players = [...next.players];
      next.players[playerIdx] = player;
      return next;
    }

    case 'CONFIRM_ARENA_FIGHTERS': {
      if (!player || !next.arenaCard) return next;
      const challenger = player;
      const challengerId = challenger.id;
      const ids = action.payload?.cardInstanceIds ?? [];
      const maxCommit = getArenaMaxCommit(challenger);
      if (!isValidArenaCommitCount(ids.length, maxCommit)) return next;

      const fighters: CardInstance[] = [];
      let playArea = [...challenger.playArea];
      for (const id of ids) {
        const idx = playArea.findIndex((c) => c.instanceId === id);
        if (idx === -1) return next;
        const card = { ...playArea[idx], location: 'ARENA_COMMIT' as const, ownerId: challengerId };
        fighters.push(card);
        playArea = playArea.filter((_, i) => i !== idx);
      }

      challenger.playArea = playArea;
      next.players = [...next.players];
      next.players[playerIdx] = challenger;
      next.arenaCommitZone = fighters;
      next.lastArenaResult = null;
      next.arenaChallenge = {
        challengerId,
        phase: 'responses',
        pendingResponsePlayerIds: next.players
          .filter((p) => p.id !== challengerId)
          .map((p) => p.id),
        supportByPlayerId: {},
        hinderByPlayerId: {},
      };
      next.turnActionHighlight = {
        playerId: challengerId,
        kind: 'arena',
        marketSource: 'arena',
        card: next.arenaCard,
      };
      return next;
    }

    case 'ARENA_RESPOND': {
      const challenge = next.arenaChallenge;
      if (!challenge) return next;
      const responderIdx = next.players.findIndex((p) => p.id === action.playerId);
      if (responderIdx === -1) return next;
      if (!challenge.pendingResponsePlayerIds.includes(action.playerId)) return next;

      let responder = { ...next.players[responderIdx] };
      const responseType = action.payload?.responseType ?? 'pass';
      const updatedChallenge = {
        ...challenge,
        supportByPlayerId: { ...challenge.supportByPlayerId },
        hinderByPlayerId: { ...challenge.hinderByPlayerId },
        pendingResponsePlayerIds: challenge.pendingResponsePlayerIds.filter(
          (id) => id !== action.playerId
        ),
      };

      if (responseType === 'support' || responseType === 'hinder') {
        const cardId = action.payload?.cardInstanceId;
        if (!cardId) return next;
        const handIdx = responder.hand.findIndex((c) => c.instanceId === cardId);
        if (handIdx === -1) return next;
        const card = { ...responder.hand[handIdx] };
        responder.hand = responder.hand.filter((_, i) => i !== handIdx);

        if (responseType === 'hinder') {
          const sabotageValor = getSabotageArenaBonus(card);
          const sabotageDraw = getSabotageDrawCards(card);
          if (sabotageDraw > 0) {
            const drawn = drawCardsIntoState(next, responder, sabotageDraw);
            next = drawn.state;
            responder = drawn.player;
          }
          if (sabotageValor !== 0) {
            next = {
              ...next,
              arenaSabotageValorByPlayerId: {
                ...(next.arenaSabotageValorByPlayerId ?? {}),
                [action.playerId]:
                  (next.arenaSabotageValorByPlayerId?.[action.playerId] ?? 0) +
                  sabotageValor,
              },
            };
          }
        }

        if (responseType === 'support') {
          updatedChallenge.supportByPlayerId[action.playerId] = card;
        } else {
          updatedChallenge.hinderByPlayerId[action.playerId] = card;
        }
      } else {
        updatedChallenge.supportByPlayerId[action.playerId] = null;
        updatedChallenge.hinderByPlayerId[action.playerId] = null;
      }

      next.players = [...next.players];
      next.players[responderIdx] = responder;
      next.arenaChallenge = updatedChallenge;

      if (updatedChallenge.pendingResponsePlayerIds.length === 0) {
        return resolveArenaChallenge(next);
      }
      return next;
    }

    case 'BUY_CARD': {
      if (!player || !action.payload?.cardInstanceId) return next;
      const galleryIdx = next.galleryCards.findIndex(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );
      const epicIdx = next.epicCards.findIndex(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );

      let boughtCard: CardInstance | null = null;
      let marketSource: 'gallery' | 'epic' | 'recruit' | null = null;
      let marketIndex: number | undefined;
      if (galleryIdx !== -1) {
        if (isGalleryCardPurchased(next, action.payload!.cardInstanceId)) {
          return next;
        }
        boughtCard = {
          ...next.galleryCards[galleryIdx],
          location: 'DISCARD' as const,
          ownerId: player.id,
        };
        marketSource = 'gallery';
        marketIndex = galleryIdx;
        next.galleryPurchasedBy = {
          ...(next.galleryPurchasedBy ?? {}),
          [boughtCard.instanceId]: player.id,
        };
      } else if (epicIdx !== -1) {
        boughtCard = {
          ...next.epicCards[epicIdx],
          location: 'DISCARD' as const,
          ownerId: player.id,
        };
        marketSource = 'epic';
        marketIndex = epicIdx;
        const newEpic = [...next.epicCards];
        newEpic.splice(epicIdx, 1);
        next.epicCards = newEpic;
      } else if (next.recruitCard?.instanceId === action.payload!.cardInstanceId) {
        boughtCard = {
          ...next.recruitCard,
          location: 'DISCARD' as const,
          ownerId: player.id,
        };
        marketSource = 'recruit';
        const recruitDeck = [...(next.recruitDeck ?? [])];
        next.recruitCard =
          recruitDeck.length > 0
            ? {
                ...recruitDeck.shift()!,
                location: 'RECRUIT' as const,
                faceUp: true,
              }
            : null;
        next.recruitDeck = recruitDeck;
      }

      if (!boughtCard || !marketSource) return state;

      const purchaseCost = getEffectivePurchaseCost(next, boughtCard);
      if (next.turnCoins < purchaseCost) return state;
      if (
        next.purchaseCostCap != null &&
        (boughtCard.definition.cost ?? 0) > next.purchaseCostCap
      ) {
        return state;
      }

      next.turnActionHighlight = {
        playerId: player.id,
        kind: 'buy',
        marketSource,
        marketIndex,
        card: boughtCard,
      };

      player.discard = [...player.discard, boughtCard];
      next.turnCoins -= purchaseCost;

      next.players = [...next.players];
      next.players[playerIdx] = player;
      next = refillEpicRow(next);

      const drawForOnGain = (p: PlayerState, count: number) =>
        drawCardsIntoState(next, p, count).player;
      next = applyOnGainEffects(
        next,
        playerIdx,
        boughtCard,
        drawForOnGain,
        (_, id) => !isGalleryCardPurchased(next, id)
      );
      return beginOnGainDestroyIfNeeded(next, playerIdx, boughtCard);
    }

    case 'RESOLVE_GALLERY_EVENT': {
      if (!next.pendingGalleryEvent) return next;
      if (getPendingEventHandChoicePlayerIds(next).length > 0) return next;
      if (getPendingEventItemChoicePlayerIds(next).length > 0) return next;
      if (
        (next.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0
      ) {
        return next;
      }

      next.pendingGalleryEvent = null;
      next.galleryEventOutcomes = null;
      next.galleryEventDecreeOutcomes = null;
      next.lastEventGalleryDestroyNames = null;
      next = processGalleryRefill(next);
      return processFavorQueue(next);
    }

    case 'RESOLVE_FAVOR': {
      const pending = next.pendingFavorReveal;
      if (
        !pending ||
        next.pendingFavorDestroyPick ||
        next.pendingFavorArenaWagerPick
      ) {
        return next;
      }
      if (favorIsOptional(pending.card)) return next;

      const card = pending.card;
      const beneficiaryIdx = next.players.findIndex(
        (p) => p.id === pending.playerId
      );
      if (beneficiaryIdx === -1) {
        return finishFavorResolution(next, card);
      }

      if (favorIsArenaWager(card)) {
        return beginFavorArenaWagerPick(next, card, pending.playerId);
      }

      if (favorNeedsDestroyPick(card)) {
        return beginFavorDestroyPick(next, card, pending.playerId);
      }

      next = applyFavorEffects(next, beneficiaryIdx, card);
      return finishFavorResolution(next, card);
    }

    case 'ACCEPT_FAVOR': {
      const pending = next.pendingFavorReveal;
      if (!pending || !favorIsOptional(pending.card)) return next;
      if (action.playerId !== pending.playerId) return next;
      if (next.pendingFavorDestroyPick) return next;

      const card = pending.card;
      const beneficiaryIdx = next.players.findIndex(
        (p) => p.id === pending.playerId
      );

      if (favorNeedsDestroyPick(card)) {
        return beginFavorDestroyPick(next, card, pending.playerId);
      }

      if (beneficiaryIdx === -1) {
        return finishFavorResolution(next, card);
      }

      next = applyFavorEffects(next, beneficiaryIdx, card);
      return finishFavorResolution(next, card);
    }

    case 'DECLINE_FAVOR': {
      const pending = next.pendingFavorReveal;
      if (!pending || !favorIsOptional(pending.card)) return next;
      if (action.playerId !== pending.playerId) return next;
      return finishFavorResolution(next, pending.card);
    }

    case 'FAVOR_REPLAY_PICK': {
      const pending = next.pendingFavorReplayPick;
      if (!pending || action.playerId !== pending.playerId) return next;
      if (!action.payload?.cardInstanceId) return next;

      const discard = next.flavorDiscard ?? [];
      const idx = discard.findIndex(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );
      if (idx === -1) return next;

      const picked = discard[idx];
      next = {
        ...next,
        pendingFavorReplayPick: null,
        flavorDiscard: discard.filter((_, i) => i !== idx),
        pendingFavorReplayRemovalId: pending.removeFromGame
          ? picked.instanceId
          : next.pendingFavorReplayRemovalId ?? null,
      };
      return beginFavorResolution(next, picked, pending.playerId);
    }

    case 'FAVOR_DESTROY_CARD': {
      const pending = next.pendingFavorReveal;
      const destroyPick = next.pendingFavorDestroyPick;
      if (!pending || !destroyPick || action.playerId !== destroyPick.playerId) {
        return next;
      }
      if (!action.payload?.cardInstanceId || !player) return next;

      const zone = action.payload.sourceZone ?? 'HAND';
      let removed: CardInstance | null = null;

      if (zone === 'HAND') {
        const idx = player.hand.findIndex(
          (c) => c.instanceId === action.payload!.cardInstanceId
        );
        if (idx === -1) return next;
        removed = player.hand[idx];
        player.hand = player.hand.filter((_, i) => i !== idx);
      } else if (zone === 'DISCARD') {
        const idx = player.discard.findIndex(
          (c) => c.instanceId === action.payload!.cardInstanceId
        );
        if (idx === -1) return next;
        removed = player.discard[idx];
        player.discard = player.discard.filter((_, i) => i !== idx);
      } else if (zone === 'PLAY_AREA') {
        const idx = player.playArea.findIndex(
          (c) => c.instanceId === action.payload!.cardInstanceId
        );
        if (idx === -1) return next;
        removed = player.playArea[idx];
        player.playArea = player.playArea.filter((_, i) => i !== idx);
      } else {
        return next;
      }

      next.players = [...next.players];
      next.players[playerIdx] = player;
      next = addToDestroyedPile(next, [{ ...removed!, ownerId: player.id }]);

      const remaining = destroyPick.remaining - 1;
      if (remaining > 0) {
        return {
          ...next,
          pendingFavorDestroyPick: { ...destroyPick, remaining },
        };
      }

      const card = pending.card;
      const beneficiaryIdx = next.players.findIndex(
        (p) => p.id === pending.playerId
      );
      if (
        beneficiaryIdx !== -1 &&
        !favorIsOptional(card) &&
        ((card.definition.effects?.gain_coins ?? 0) > 0 ||
          (card.definition.effects?.draw_cards ?? 0) > 0 ||
          (card.definition as { effects?: { gain_gratia?: number } }).effects
            ?.gain_gratia ||
          (card.definition.effects?.force_opponent_discard ?? 0) > 0)
      ) {
        next = applyFavorEffects(next, beneficiaryIdx, card, {
          skipDestroy: true,
        });
      }

      return finishFavorResolution(next, card);
    }

    case 'FAVOR_ARENA_WAGER_PICK': {
      const pending = next.pendingFavorReveal;
      const wagerPick = next.pendingFavorArenaWagerPick;
      if (!pending || !wagerPick || action.playerId !== wagerPick.beneficiaryId) {
        return next;
      }
      if (!action.payload?.cardInstanceId) return next;

      const zone = action.payload.sourceZone;
      if (zone !== 'HAND' && zone !== 'PLAY_AREA') return next;

      const entries = buildArenaWagerEntries(
        next,
        wagerPick.beneficiaryId,
        {
          cardInstanceId: action.payload.cardInstanceId,
          sourceZone: zone,
        },
        pending.card.instanceId
      );
      if (!entries || entries.length === 0) {
        return finishFavorResolution(next, pending.card);
      }

      const { winnerIds, participantCount, gratiaPerWinner } =
        resolveArenaWagerWinners(entries);
      next = applyArenaWagerRewards(next, entries, winnerIds, gratiaPerWinner);
      next = {
        ...next,
        pendingFavorArenaWagerPick: null,
        lastArenaWagerResult: {
          beneficiaryId: wagerPick.beneficiaryId,
          entries,
          winnerIds,
          participantCount,
          gratiaPerWinner,
        },
      };
      return finishFavorResolution(next, pending.card);
    }

    case 'EVENT_SKIP_GALLERY_CHOICE': {
      const optional = next.pendingEventOptionalDiscards;
      if (!optional?.pendingPlayerIds.includes(action.playerId)) return next;

      next.pendingEventOptionalDiscards = {
        ...optional,
        pendingPlayerIds: optional.pendingPlayerIds.filter(
          (id) => id !== action.playerId
        ),
      };
      if (next.pendingEventOptionalDiscards.pendingPlayerIds.length > 0) {
        return next;
      }
      return finishGalleryEventPlayerResponses(next);
    }

    case 'EVENT_DISCARD_CARD': {
      if (!player || !action.payload?.cardInstanceId) return next;

      const optional = next.pendingEventOptionalDiscards;
      const isOptional = optional?.pendingPlayerIds.includes(action.playerId);
      const handChoice = getPendingEventHandChoiceForPlayer(
        next,
        action.playerId
      );
      if (!isOptional && !handChoice) return next;

      const handIdx = player.hand.findIndex(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );
      if (handIdx === -1) return next;

      const removed = player.hand[handIdx];
      if (
        handChoice &&
        !handCardValidForEventChoice(removed, handChoice.kind)
      ) {
        return next;
      }

      player.hand = player.hand.filter((_, i) => i !== handIdx);

      const destroys =
        handChoice != null &&
        (handChoice.kind === 'destroy' ||
          handChoice.kind === 'destroy_charity_or_gratia');

      if (!destroys) {
        player.discard = [
          ...player.discard,
          { ...removed, location: 'DISCARD' as const, faceUp: true },
        ];
      } else {
        next = addToDestroyedPile(next, [{ ...removed, ownerId: player.id }]);
      }

      if (isOptional && optional) {
        next.players = [...next.players];
        next.players[playerIdx] = player;
        next = awardOptionalEventDiscardCoins(
          next,
          action.playerId,
          optional.coinReward ?? 2
        );
        next.pendingEventOptionalDiscards = {
          ...optional,
          pendingPlayerIds: optional.pendingPlayerIds.filter(
            (id) => id !== action.playerId
          ),
        };

        if (next.pendingEventOptionalDiscards.pendingPlayerIds.length > 0) {
          return next;
        }
        return finishGalleryEventPlayerResponses(next);
      }

      next.players = [...next.players];
      next.players[playerIdx] = player;

      if (handChoice) {
        const remaining = handChoice.remaining - 1;
        const choices = [...(next.pendingEventHandChoices ?? [])];
        const choiceIdx = choices.findIndex(
          (choice) => choice.playerId === action.playerId
        );
        if (choiceIdx === -1) return next;

        if (remaining <= 0 || player.hand.length === 0) {
          choices.splice(choiceIdx, 1);
        } else if (
          handChoice.kind === 'destroy_charity_or_gratia' &&
          !player.hand.some((card) =>
            handCardValidForEventChoice(card, handChoice.kind)
          )
        ) {
          choices.splice(choiceIdx, 1);
        } else {
          choices[choiceIdx] = { ...handChoice, remaining };
        }
        next.pendingEventHandChoices = choices;
      }

      if (getPendingEventHandChoicePlayerIds(next).length > 0) {
        return next;
      }

      return finishGalleryEventPlayerResponses(next);
    }

    case 'EVENT_LOSE_ITEM': {
      if (!player || !action.payload?.cardInstanceId) return next;
      if (
        !getPendingEventItemChoicePlayerIds(next).includes(action.playerId)
      ) {
        return next;
      }
      next = finishEventItemLossPick(
        next,
        playerIdx,
        action.payload.cardInstanceId
      );
      if (getPendingEventItemChoicePlayerIds(next).length > 0) {
        return next;
      }
      return finishGalleryEventPlayerResponses(next);
    }

    case 'ATTEMPT_ARENA': {
      // Legacy action — arena resolves via CONFIRM_ARENA_FIGHTERS + ARENA_RESPOND.
      return next;
    }

    case 'DECLINE_ARENA': {
      if (!player || playerIdx === -1) return next;
      if (!mustEnterArenaBeforeEndTurn(next, player.id)) return next;
      const disfavor = createCardInstance(
        CROWD_DISFAVOR.id,
        'DISCARD',
        player.id,
        true
      );
      const updated = discardCardToPlayer(player, disfavor);
      next.players = [...next.players];
      next.players[playerIdx] = updated;
      next.turnArenaResolved = true;
      return next;
    }

    case 'DISMISS_ARENA_RESULT': {
      if (!next.lastArenaResult || next.arenaChallenge) return next;
      return { ...next, lastArenaResult: null };
    }

    case 'DISMISS_ARENA_WAGER_RESULT': {
      if (!next.lastArenaWagerResult) return next;
      return { ...next, lastArenaWagerResult: null };
    }

    case 'END_PHASE': {
      if (next.phase === 'MAIN') {
        if (player) {
          if (next.pendingHandDiscard && player.hand.length === 0) {
            next = { ...next, pendingHandDiscard: null };
          }
          next = clearPlayerInteractivePending(next, player.id);
        }
        return endTurnAndPass(next, playerIdx, player);
      }
      return next;
    }

    case 'DEBUG_SPAWN_CARD': {
      if (!player || !action.payload?.definitionId || !action.payload.targetZone) {
        return next;
      }
      const targetZone = action.payload.targetZone;
      const faceUp = targetZone === 'HAND' || targetZone === 'DISCARD';
      const card = createCardInstance(
        action.payload.definitionId,
        targetZone,
        player.id,
        faceUp
      );

      if (targetZone === 'DESTROYED') {
        return addToDestroyedPile(next, [card]);
      }

      switch (targetZone) {
        case 'HAND':
          player.hand = [...player.hand, card];
          break;
        case 'DECK':
          player.deck = [card, ...player.deck];
          break;
        case 'DISCARD':
          player.discard = [...player.discard, card];
          break;
        default:
          return next;
      }

      next.players = [...next.players];
      next.players[playerIdx] = player;
      return next;
    }

    default:
      return next;
  }
}

function maybeCompleteDeferredTurnPass(state: GameState): GameState {
  if (galleryRefillPaused(state)) return state;
  if (!state.deferredTurnEnd) return state;

  const endingIdx = state.players.findIndex(
    (p) => p.id === state.deferredTurnEnd!.endingPlayerId
  );
  if (endingIdx === -1) {
    return { ...state, deferredTurnEnd: null };
  }
  return completeTurnPass(state, endingIdx);
}

function removePurchasedGalleryCards(state: GameState): GameState {
  const purchased = state.galleryPurchasedBy ?? {};
  const purchasedIds = new Set(Object.keys(purchased));
  if (purchasedIds.size === 0) return state;

  return {
    ...state,
    galleryCards: state.galleryCards.filter((c) => !purchasedIds.has(c.instanceId)),
    galleryPurchasedBy: {},
  };
}

function finishGalleryEventPlayerResponses(state: GameState): GameState {
  let next: GameState = {
    ...state,
    pendingGalleryEvent: null,
    galleryEventOutcomes: null,
    galleryEventDecreeOutcomes: null,
    lastEventGalleryDestroyNames: null,
    pendingEventHandChoices: [],
    pendingEventDiscards: [],
    pendingEventItemChoices: [],
    pendingEventOptionalDiscards: null,
  };
  next = processGalleryRefill(next);
  return processFavorQueue(next);
}

/** Refill gallery one card at a time; pause on events until resolved. */
function processGalleryRefill(state: GameState): GameState {
  let next = removePurchasedGalleryCards(state);
  const favorReturns: CardInstance[] = [];
  next = ejectStrayGalleryEvents(next, {
    drawCards: (p, count) => drawCards(p, count, favorReturns).player,
    gainFlavorCard,
    createCard: createCardInstance,
  });
  if (favorReturns.length > 0) {
    next = {
      ...next,
      flavorDeck: [...next.flavorDeck, ...favorReturns],
    };
  }

  while (
    next.galleryCards.length < GALLERY_ROW_SIZE &&
    (next.gallerySupply?.length ?? 0) > 0
  ) {
    if (galleryRefillPaused(next)) {
      return maybeCompleteDeferredTurnPass(next);
    }

    const { state: afterDraw, flippedEvent } = drawGallerySupplyCard(next);
    next = afterDraw;

    if (flippedEvent) {
      const actorId =
        next.turnPlayerId || next.players[0]?.id || 'player_1';
      next = {
        ...next,
        actionLog: [
          ...next.actionLog,
          {
            type: 'GALLERY_EVENT_FLIPPED' as const,
            playerId: actorId,
            payload: {
              cardName: flippedEvent.definition.name,
              definitionId: flippedEvent.definitionId,
              effectSummary: flippedEvent.definition.text,
            },
            timestamp: Date.now(),
          },
        ],
      };
      const eventFavorReturns: CardInstance[] = [];
      const drawForEvent = (p: PlayerState, count: number) =>
        drawCards(p, count, eventFavorReturns).player;
      next = beginGalleryEventResolution(
        next,
        flippedEvent,
        drawForEvent,
        gainFlavorCard,
        createCardInstance
      );
      if (eventFavorReturns.length > 0) {
        next = {
          ...next,
          flavorDeck: [...next.flavorDeck, ...eventFavorReturns],
        };
      }
      if (!galleryRefillPaused(next)) {
        continue;
      }
      return maybeCompleteDeferredTurnPass(next);
    }
  }

  return maybeCompleteDeferredTurnPass(next);
}

function replaceArenaIfPending(state: GameState): GameState {
  if (!state.pendingArenaReplacement) return state;

  let arenaCard = state.arenaCard;
  const arenaDeck = [...state.arenaDeck];
  if (arenaDeck.length > 0) {
    arenaCard = { ...arenaDeck.shift()!, location: 'ARENA' as const, faceUp: true };
  } else {
    arenaCard = null;
  }

  return {
    ...state,
    arenaCard,
    arenaDeck,
    pendingArenaReplacement: false,
  };
}

function completeTurnPass(state: GameState, endingPlayerIdx: number): GameState {
  const deferred = state.deferredTurnEnd;
  const nextPlayerIdx =
    deferred?.nextPlayerIdx ?? (endingPlayerIdx + 1) % state.players.length;

  let next: GameState = {
    ...state,
    turnPlayerId: state.players[nextPlayerIdx].id,
    turnNumber: state.turnNumber + 1,
    phase: 'MAIN',
    turnCoins: 0,
    turnValor: 0,
    turnEpicDiscount: 0,
    turnFactionDiscount: 0,
    deferredGalleryRefillSlots: 0,
    deferredEpicRefillSlots: 0,
    turnBandingClaimed: [],
    pendingBandingBonus: null,
    deferredBandingBonus: null,
    turnActionHighlight: null,
    pendingHandDiscard: null,
    pendingCardDestroyPick: null,
    pendingGalleryDestroyPick: null,
    pendingEpicDestroyPick: null,
    pendingAnyDiscardDestroyPick: null,
    pendingOrEffectChoice: null,
    pendingOnGainDestroyPick: null,
    pendingForcedOpponentDiscards: null,
    pendingGainCardPick: null,
    pendingCopyCardPick: null,
    pendingPlaceCardOnDeckPick: null,
    pendingDeckLookPick: null,
    pendingDeckTopRevealPick: null,
    pendingGainBandingBonusPick: null,
    pendingPlaceDestroyedOnMarketPick: null,
    arenaSabotageValorByPlayerId: {},
    pendingArenaLoss: null,
    deferredTurnEnd: null,
    purchaseCostCap: state.purchaseCostCap ?? null,
    purchaseCostCapActiveForPlayerId:
      state.purchaseCostCapActiveForPlayerId ?? null,
    turnArenaResolved: false,
    turnArenaExempt: false,
    lastArenaResult: null,
  };

  const nextPlayer = next.players[nextPlayerIdx];
  const carry = nextPlayer.carryCoins ?? 0;
  let turnCoins = Math.max(0, carry);
  let updatedPlayer = { ...nextPlayer, carryCoins: 0 };
  if (updatedPlayer.imperialTaxPending) {
    turnCoins = Math.max(0, turnCoins - 1);
    updatedPlayer = { ...updatedPlayer, imperialTaxPending: false };
  }
  next.turnCoins = turnCoins;
  next.players = next.players.map((p, idx) => ({
    ...(idx === nextPlayerIdx ? updatedPlayer : p),
    turnPlayedCards: [],
    coinCapPerCardNextTurn:
      idx === endingPlayerIdx ? undefined : p.coinCapPerCardNextTurn,
  }));

  return finishGameIfNeeded(next);
}

function clearExpiredImperialTax(player: PlayerState): PlayerState {
  if (!player.imperialTaxPending) return player;
  return { ...player, imperialTaxPending: false };
}

function endTurnAndPass(
  state: GameState,
  playerIdx: number,
  player: PlayerState | null
): GameState {
  let next: GameState = { ...state, phase: 'CLEANUP' };

  if (
    player &&
    next.purchaseCostCapActiveForPlayerId === player.id
  ) {
    next = {
      ...next,
      purchaseCostCap: null,
      purchaseCostCapActiveForPlayerId: null,
    };
  }

  if (player) {
    const cleaned = cleanupTurnPlayer(player);
    const drawCount = Math.max(
      0,
      STARTING_HAND_SIZE - (cleaned.player.drawPenalty ?? 0)
    );
    const drawn = drawCardsIntoState(next, cleaned.player, drawCount);
    let withDraw = clearExpiredImperialTax(drawn.player);
    withDraw = { ...withDraw, drawPenalty: 0 };
    next = drawn.state;
    next.players = [...next.players];
    next.players[playerIdx] = withDraw;
    if (cleaned.favorReturns.length > 0) {
      next.flavorDeck = [...next.flavorDeck, ...cleaned.favorReturns];
    }
  }

  next.arenaCommitZone = [];
  next = replaceArenaIfPending(next);

  const galleryRefill = next.deferredGalleryRefillSlots ?? 0;
  if (galleryRefill > 0) {
    next = refillGallerySlots(next, galleryRefill);
    next = { ...next, deferredGalleryRefillSlots: 0 };
  }
  const epicRefill = next.deferredEpicRefillSlots ?? 0;
  for (let i = 0; i < epicRefill; i++) {
    next = refillEpicRow(next);
  }
  if (epicRefill > 0) {
    next = { ...next, deferredEpicRefillSlots: 0 };
  }

  const nextPlayerIdx = (playerIdx + 1) % next.players.length;
  next.deferredTurnEnd = {
    endingPlayerId: next.players[playerIdx].id,
    nextPlayerIdx,
  };

  return processGalleryRefill(next);
}

export function buildPlayerSetupsFromDb(
  rows: { player_key: string; display_name: string; is_ai: boolean; seat_index: number }[],
  fillWithAiTo = MAX_PLAYERS
): PlayerSetup[] {
  const sorted = [...rows].sort((a, b) => a.seat_index - b.seat_index);
  const setups: PlayerSetup[] = sorted.map((r) => ({
    id: r.player_key,
    name: r.display_name,
    isAI: r.is_ai,
  }));

  let seat = setups.length;
  const humanNames = setups.map((s) => s.name);
  const aiNames = pickAiDisplayNames(fillWithAiTo - setups.length, humanNames);
  let aiNameIdx = 0;
  while (setups.length < fillWithAiTo && seat < MAX_PLAYERS) {
    seat += 1;
    setups.push({
      id: `player_${seat}`,
      name: aiNames[aiNameIdx++] ?? pickAiDisplayNames(1, humanNames)[0],
      isAI: true,
    });
  }

  return setups;
}

function findAIBuyTarget(state: GameState): CardInstance | null {
  const options: CardInstance[] = [
    ...state.galleryCards.filter(
      (c) => !isGalleryCardPurchased(state, c.instanceId)
    ),
    ...state.epicCards,
    ...(state.recruitCard ? [state.recruitCard] : []),
  ].filter((c) => {
    if (!canAffordPurchase(state, c)) return false;
    if (
      state.purchaseCostCap != null &&
      (c.definition.cost ?? 0) > state.purchaseCostCap
    ) {
      return false;
    }
    return isPurchasableMarketCard(c);
  });
  if (options.length === 0) return null;
  return options.reduce((best, c) =>
    c.definition.cost > best.definition.cost ? c : best
  );
}

function pickAIPlayableCard(
  state: GameState,
  player: PlayerState
): CardInstance | null {
  const playable = player.hand.filter((c) =>
    canFulfillPlayDestroyRequirements(
      state,
      player,
      c,
      (id) => !isGalleryCardPurchased(state, id)
    )
  );
  if (playable.length === 0) return null;
  const claimed = (state.turnBandingClaimed ?? []).filter(
    (f): f is BandingFaction =>
      f === 'Ludus' || f === 'Legion' || f === 'Senate'
  );
  return pickAICardToPlayFirst(
    playable,
    player.playArea,
    claimed,
    state.turnNumber
  );
}

function buildAIPlayCardAction(
  state: GameState,
  player: PlayerState,
  card: CardInstance,
  base: { playerId: string; timestamp: number }
): GameAction {
  const claimed = (state.turnBandingClaimed ?? []).filter(
    (f): f is BandingFaction =>
      f === 'Ludus' || f === 'Legion' || f === 'Senate'
  );
  const payload: GameAction['payload'] = {
    cardInstanceId: card.instanceId,
  };
  if (requiresFactionChoiceOnPlay(card.definition)) {
    payload.chosenFaction = chooseSpyFactionForAI(
      player.playArea,
      player.hand,
      claimed,
      state.turnNumber
    );
  }
  return {
    ...base,
    type: 'PLAY_CARD',
    payload,
  };
}

export function getNextAIAction(state: GameState): GameAction | null {
  if (
    (state.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0
  ) {
    const playerId = state.pendingEventOptionalDiscards!.pendingPlayerIds[0];
    const player = state.players.find((p) => p.id === playerId);
    if (player?.isAI && player.hand.length > 0) {
      const card = player.hand.reduce((worst, c) =>
        (c.definition?.cost ?? 0) < (worst.definition?.cost ?? 0) ? c : worst
      );
      return {
        type: 'EVENT_DISCARD_CARD',
        playerId: player.id,
        payload: { cardInstanceId: card.instanceId },
        timestamp: Date.now(),
      };
    }
    if (player?.isAI) {
      return {
        type: 'EVENT_SKIP_GALLERY_CHOICE',
        playerId: player.id,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  const pendingHandChoiceIds = getPendingEventHandChoicePlayerIds(state);
  if (pendingHandChoiceIds.length > 0) {
    const playerId = pendingHandChoiceIds[0];
    const player = state.players.find((p) => p.id === playerId);
    const choice = getPendingEventHandChoiceForPlayer(state, playerId);
    if (player?.isAI && choice) {
      const candidates = player.hand.filter((card) =>
        handCardValidForEventChoice(card, choice.kind)
      );
      if (candidates.length > 0) {
        const card = candidates.reduce((worst, c) =>
          (c.definition?.cost ?? 0) < (worst.definition?.cost ?? 0) ? c : worst
        );
        return {
          type: 'EVENT_DISCARD_CARD',
          playerId: player.id,
          payload: { cardInstanceId: card.instanceId },
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  const pendingItemChoiceIds = getPendingEventItemChoicePlayerIds(state);
  if (pendingItemChoiceIds.length > 0) {
    const playerId = pendingItemChoiceIds[0];
    const player = state.players.find((p) => p.id === playerId);
    if (player?.isAI && player.itemsInPlay.length > 0) {
      const item = player.itemsInPlay.reduce((worst, c) =>
        (c.definition?.cost ?? 0) < (worst.definition?.cost ?? 0) ? c : worst
      );
      return {
        type: 'EVENT_LOSE_ITEM',
        playerId: player.id,
        payload: { cardInstanceId: item.instanceId },
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.pendingHandDiscard) {
    const { playerId } = state.pendingHandDiscard;
    const player = state.players.find((p) => p.id === playerId);
    if (player?.isAI) {
      if (player.hand.length > 0) {
        const card = player.hand.reduce((worst, c) =>
          (c.definition?.valor ?? 0) < (worst.definition?.valor ?? 0) ? c : worst
        );
        return {
          type: 'DISCARD_CARD',
          playerId: player.id,
          payload: { cardInstanceId: card.instanceId },
          timestamp: Date.now(),
        };
      }
      if (state.turnPlayerId === playerId) {
        return {
          type: 'END_PHASE',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingCardDestroyPick) {
    const pick = state.pendingCardDestroyPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      const candidates: { card: CardInstance; zone: 'HAND' | 'DISCARD' | 'PLAY_AREA' }[] =
        [];
      if (pick.fromZones.includes('hand')) {
        candidates.push(...player.hand.map((card) => ({ card, zone: 'HAND' as const })));
      }
      if (pick.fromZones.includes('discard')) {
        candidates.push(
          ...player.discard.map((card) => ({ card, zone: 'DISCARD' as const }))
        );
      }
      if (pick.fromZones.includes('play_area')) {
        candidates.push(
          ...player.playArea.map((card) => ({ card, zone: 'PLAY_AREA' as const }))
        );
      }
      if (candidates.length > 0) {
        const { card, zone } = candidates.reduce((worst, entry) =>
          (entry.card.definition?.cost ?? 0) < (worst.card.definition?.cost ?? 0)
            ? entry
            : worst
        );
        return {
          type: 'CARD_DESTROY_PICK',
          playerId: player.id,
          payload: { cardInstanceId: card.instanceId, sourceZone: zone },
          timestamp: Date.now(),
        };
      }
      if (pick.optional) {
        return {
          type: 'CARD_DESTROY_SKIP',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
      if (state.turnPlayerId === player.id) {
        return {
          type: 'END_PHASE',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingGalleryDestroyPick) {
    const pick = state.pendingGalleryDestroyPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      const candidates = state.galleryCards.filter(
        (c) => !state.galleryPurchasedBy?.[c.instanceId]
      );
      if (
        pick.optional &&
        ((pick.destroyedSoFar ?? 0) >= 1 || candidates.length === 0)
      ) {
        return {
          type: 'GALLERY_DESTROY_SKIP',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
      if (candidates.length > 0) {
        const card = candidates.reduce((worst, c) =>
          (c.definition?.cost ?? 0) < (worst.definition?.cost ?? 0) ? c : worst
        );
        return {
          type: 'GALLERY_DESTROY_PICK',
          playerId: player.id,
          payload: { cardInstanceId: card.instanceId },
          timestamp: Date.now(),
        };
      }
      if (pick.optional) {
        return {
          type: 'GALLERY_DESTROY_SKIP',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
      if (state.turnPlayerId === player.id) {
        return {
          type: 'END_PHASE',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingEpicDestroyPick) {
    const pick = state.pendingEpicDestroyPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI && state.epicCards.length > 0) {
      const card = state.epicCards.reduce((worst, c) =>
        (c.definition?.cost ?? 0) < (worst.definition?.cost ?? 0) ? c : worst
      );
      return {
        type: 'EPIC_DESTROY_PICK',
        playerId: player.id,
        payload: { cardInstanceId: card.instanceId },
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.pendingAnyDiscardDestroyPick) {
    const pick = state.pendingAnyDiscardDestroyPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      const candidates: { targetPlayerId: string; card: CardInstance }[] = [];
      for (const p of state.players) {
        if (pick.opponentsOnly && p.id === player.id) continue;
        for (const card of p.discard) {
          candidates.push({ targetPlayerId: p.id, card });
        }
      }
      if (candidates.length > 0) {
        const pickEntry = candidates.reduce((worst, entry) =>
          (entry.card.definition?.cost ?? 0) < (worst.card.definition?.cost ?? 0)
            ? entry
            : worst
        );
        return {
          type: 'ANY_DISCARD_DESTROY_PICK',
          playerId: player.id,
          payload: {
            targetPlayerId: pickEntry.targetPlayerId,
            cardInstanceId: pickEntry.card.instanceId,
          },
          timestamp: Date.now(),
        };
      }
      if (state.turnPlayerId === player.id) {
        return {
          type: 'END_PHASE',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingOrEffectChoice) {
    const pick = state.pendingOrEffectChoice;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      const playerState = player;
      const isFirstCard =
        playerState.playArea.length + playerState.itemsInPlay.length === 1 &&
        playerState.playArea.some(
          (c) => c.instanceId === pick.sourceCardInstanceId
        );
      let bestIndex = 0;
      let bestScore = pick.baseGainCoins;
      pick.branches.forEach((branch, i) => {
        const b = branch as Record<string, unknown>;
        if (b.if_first_card_played && !isFirstCard) return;
        let score =
          Number(b.gain_coins ?? 0) +
          Number(b.draw_cards ?? 0) * 2 -
          Number(b.destroy_cards ?? 0);
        if (b.discard_hand && Number(b.draw_cards ?? 0) >= 5) {
          score += isFirstCard ? 12 : 0;
        }
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i + 1;
        }
      });
      return {
        type: 'CHOOSE_OR_EFFECT',
        playerId: player.id,
        payload: { branchIndex: bestIndex },
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.pendingOnGainDestroyPick) {
    const pick = state.pendingOnGainDestroyPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      const candidates: { card: CardInstance; zone: 'HAND' | 'DISCARD' }[] = [];
      if (pick.fromZones.includes('hand')) {
        candidates.push(...player.hand.map((card) => ({ card, zone: 'HAND' as const })));
      }
      if (pick.fromZones.includes('discard')) {
        candidates.push(
          ...player.discard.map((card) => ({ card, zone: 'DISCARD' as const }))
        );
      }
      if (candidates.length > 0) {
        const { card, zone } = candidates.reduce((worst, entry) =>
          (entry.card.definition?.cost ?? 0) < (worst.card.definition?.cost ?? 0)
            ? entry
            : worst
        );
        return {
          type: 'ON_GAIN_DESTROY_PICK',
          playerId: player.id,
          payload: { cardInstanceId: card.instanceId, sourceZone: zone },
          timestamp: Date.now(),
        };
      }
      if (pick.optional) {
        return {
          type: 'ON_GAIN_DESTROY_SKIP',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
      if (state.turnPlayerId === player.id) {
        return {
          type: 'END_PHASE',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingGainCardPick) {
    const pick = state.pendingGainCardPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      const source = pick.gainSource ?? 'market';
      const eligible =
        source === 'destroyed_pile'
          ? listEligibleDestroyedGainCards(state, {
              source: 'destroyed_pile',
              maxCost: pick.maxCost,
              type: pick.cardType,
              faction: pick.gainFaction,
            })
          : listEligibleMarketGainCards(
              state,
              {
                source: source === 'market_or_epic' ? 'market_or_epic' : 'market',
                maxCost: pick.maxCost,
                type: pick.cardType,
                faction: pick.gainFaction,
              },
              (id) => !isGalleryCardPurchased(state, id)
            );
      if (eligible.length > 0) {
        const card = eligible.reduce((best, c) =>
          (c.definition?.cost ?? 0) > (best.definition?.cost ?? 0) ? c : best
        );
        return {
          type: 'GAIN_CARD_PICK',
          playerId: player.id,
          payload: { cardInstanceId: card.instanceId },
          timestamp: Date.now(),
        };
      }
      if (state.turnPlayerId === player.id) {
        return {
          type: 'END_PHASE',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingPlaceDestroyedOnMarketPick) {
    const pick = state.pendingPlaceDestroyedOnMarketPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      const eligible = listEligibleDestroyedPlaceCards(state);
      if (eligible.length > 0) {
        const card = eligible.reduce((best, c) =>
          (c.definition?.cost ?? 0) > (best.definition?.cost ?? 0) ? c : best
        );
        return {
          type: 'PLACE_DESTROYED_ON_MARKET_PICK',
          playerId: player.id,
          payload: { cardInstanceId: card.instanceId },
          timestamp: Date.now(),
        };
      }
      if (pick.optional) {
        return {
          type: 'PLACE_DESTROYED_ON_MARKET_SKIP',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
      if (state.turnPlayerId === player.id) {
        return {
          type: 'END_PHASE',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingCopyCardPick) {
    const pick = state.pendingCopyCardPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      const eligible = listEligibleMarketCopyCards(
        state,
        { source: 'market', maxCost: pick.maxCost },
        (id) => !isGalleryCardPurchased(state, id)
      );
      if (eligible.length > 0) {
        const card = eligible.reduce((best, c) =>
          (c.definition?.cost ?? 0) > (best.definition?.cost ?? 0) ? c : best
        );
        return {
          type: 'COPY_CARD_PICK',
          playerId: player.id,
          payload: { cardInstanceId: card.instanceId },
          timestamp: Date.now(),
        };
      }
      if (state.turnPlayerId === player.id) {
        return {
          type: 'END_PHASE',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingDeckTopRevealPick) {
    const pick = state.pendingDeckTopRevealPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      const current = getCurrentDeckTopRevealPick(pick);
      if (current) {
        const destroy =
          current.targetPlayerId !== player.id &&
          (current.card.definition?.cost ?? 0) >= 3;
        return {
          type: 'DECK_TOP_REVEAL_RESOLVE',
          playerId: player.id,
          payload: {
            deckTopRevealChoice: destroy ? 'destroy' : 'return',
          },
          timestamp: Date.now(),
        };
      }
      if (state.turnPlayerId === player.id) {
        return {
          type: 'END_PHASE',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingDeckLookPick) {
    const pick = state.pendingDeckLookPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      if (pick.phase === 'choose_deck') {
        const target =
          state.players.find((p) => p.id === player.id && p.deck.length > 0) ??
          state.players.find((p) => p.deck.length > 0);
        if (target) {
          return {
            type: 'DECK_LOOK_CHOOSE_PLAYER',
            playerId: player.id,
            payload: { targetPlayerId: target.id },
            timestamp: Date.now(),
          };
        }
        return {
          type: 'END_PHASE',
          playerId: player.id,
          timestamp: Date.now(),
        };
      }
      const viewed = pick.viewedCards ?? [];
      if (viewed.length > 0) {
        const keep = viewed.reduce((best, c) =>
          (c.definition?.cost ?? 0) > (best.definition?.cost ?? 0) ? c : best
        );
        return {
          type: 'DECK_LOOK_KEEP_TOP',
          playerId: player.id,
          payload: { cardInstanceId: keep.instanceId },
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingGainBandingBonusPick) {
    const pick = state.pendingGainBandingBonusPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI) {
      const faction: BandingFaction =
        state.turnNumber <= 3 ? 'Senate' : state.turnNumber >= 6 ? 'Ludus' : 'Legion';
      return {
        type: 'CHOOSE_GAIN_BANDING_BONUS',
        playerId: player.id,
        payload: { bandingFaction: faction },
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.pendingForcedOpponentDiscards) {
    const pending = state.pendingForcedOpponentDiscards;
    const controller = state.players.find((p) => p.id === pending.controllerId);

    if (
      pending.phase === 'choose_opponent' &&
      controller?.isAI &&
      pending.opponentCandidateIds?.length
    ) {
      const targetId = pending.opponentCandidateIds[0];
      return {
        type: 'CHOOSE_FORCE_DISCARD_TARGET',
        playerId: pending.controllerId,
        payload: { targetPlayerId: targetId },
        timestamp: Date.now(),
      };
    }

    if (pending.controllerPicks && pending.phase === 'discard' && controller?.isAI) {
      const target = state.players.find((p) => p.id === pending.targetPlayerId);
      if (target && target.hand.length > 0) {
        const card = pickForcedDiscardCard(target.hand);
        if (card) {
          return {
            type: 'FORCE_OPPONENT_DISCARD',
            playerId: pending.controllerId,
            payload: { cardInstanceId: card.instanceId },
            timestamp: Date.now(),
          };
        }
      }
    }

    const target = state.players.find((p) => p.id === pending.targetPlayerId);
    if (target?.isAI && target.hand.length > 0 && !pending.controllerPicks) {
      const card = pickForcedDiscardCard(target.hand);
      if (card) {
        return {
          type: 'FORCE_OPPONENT_DISCARD',
          playerId: pending.targetPlayerId,
          payload: { cardInstanceId: card.instanceId },
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingArenaLoss) {
    const pending = state.pendingArenaLoss;
    const player = state.players.find((p) => p.id === pending.playerId);
    if (!player?.isAI) return null;

    if (pending.phase === 'primus_choice') {
      const candidates =
        pending.primusCandidates ??
        getPrimusDestroyCandidates(pending.committedFighters);
      const weakestCommitted = pending.committedFighters.reduce((worst, fighter) =>
        getFighterStrength(fighter) < getFighterStrength(worst) ? fighter : worst
      );
      const destroyTarget = candidates[0];
      const destroyIsPainful =
        destroyTarget &&
        getFighterStrength(destroyTarget) >= getFighterStrength(weakestCommitted) + 2;

      if (destroyIsPainful) {
        return {
          type: 'RESOLVE_ARENA_LOSS',
          playerId: player.id,
          payload: { arenaLossChoice: 'disfavor' },
          timestamp: Date.now(),
        };
      }

      if (candidates.length > 1) {
        return {
          type: 'RESOLVE_ARENA_LOSS',
          playerId: player.id,
          payload: { arenaLossChoice: 'destroy_fighter' },
          timestamp: Date.now(),
        };
      }

      return {
        type: 'RESOLVE_ARENA_LOSS',
        playerId: player.id,
        payload: { arenaLossChoice: 'destroy_fighter' },
        timestamp: Date.now(),
      };
    }

    const pool =
      pending.phase === 'primus_fighter_pick'
        ? pending.primusCandidates ?? []
        : pending.committedFighters;
    const pick = pool.reduce((worst, fighter) =>
      getFighterStrength(fighter) < getFighterStrength(worst) ? fighter : worst
    );
    if (pick) {
      return {
        type: 'RESOLVE_ARENA_LOSS',
        playerId: player.id,
        payload: { cardInstanceId: pick.instanceId },
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.pendingGalleryEvent) {
    const ai = state.players.find((p) => p.isAI);
    if (ai) {
      return {
        type: 'RESOLVE_GALLERY_EVENT',
        playerId: ai.id,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.lastArenaResult && !state.arenaChallenge) {
    const ai = state.players.find((p) => p.isAI);
    if (ai) {
      return {
        type: 'DISMISS_ARENA_RESULT',
        playerId: ai.id,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.lastArenaWagerResult) {
    const ai = state.players.find((p) => p.isAI);
    if (ai) {
      return {
        type: 'DISMISS_ARENA_WAGER_RESULT',
        playerId: ai.id,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.pendingFavorReplayPick) {
    const pick = state.pendingFavorReplayPick;
    const player = state.players.find((p) => p.id === pick.playerId);
    if (player?.isAI && (state.flavorDiscard?.length ?? 0) > 0) {
      const card = state.flavorDiscard![0];
      return {
        type: 'FAVOR_REPLAY_PICK',
        playerId: player.id,
        payload: { cardInstanceId: card.instanceId },
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.pendingFavorArenaWagerPick) {
    const pick = state.pendingFavorArenaWagerPick;
    const beneficiary = state.players.find((p) => p.id === pick.beneficiaryId);
    if (beneficiary?.isAI) {
      const chosen = pickBestArenaWagerOwnCard(beneficiary);
      if (chosen) {
        return {
          type: 'FAVOR_ARENA_WAGER_PICK',
          playerId: beneficiary.id,
          payload: {
            cardInstanceId: chosen.card.instanceId,
            sourceZone: chosen.sourceZone,
          },
          timestamp: Date.now(),
        };
      }
    }
    return null;
  }

  if (state.pendingFavorReveal) {
    const { card, playerId } = state.pendingFavorReveal;
    const beneficiary = state.players.find((p) => p.id === playerId);

    if (state.pendingFavorDestroyPick) {
      const pick = state.pendingFavorDestroyPick;
      const destroyer = state.players.find((p) => p.id === pick.playerId);
      if (destroyer?.isAI) {
        const candidates: CardInstance[] = [];
        if (pick.fromZones.includes('hand')) {
          candidates.push(...destroyer.hand);
        }
        if (pick.fromZones.includes('discard')) {
          candidates.push(...destroyer.discard);
        }
        if (pick.fromZones.includes('play_area')) {
          candidates.push(...destroyer.playArea);
        }
        if (candidates.length > 0) {
          const cardToDestroy = candidates.reduce((worst, c) =>
            (c.definition?.cost ?? 0) < (worst.definition?.cost ?? 0) ? c : worst
          );
          const sourceZone = destroyer.hand.some(
            (c) => c.instanceId === cardToDestroy.instanceId
          )
            ? 'HAND'
            : destroyer.discard.some(
                  (c) => c.instanceId === cardToDestroy.instanceId
                )
              ? 'DISCARD'
              : 'PLAY_AREA';
          return {
            type: 'FAVOR_DESTROY_CARD',
            playerId: destroyer.id,
            payload: {
              cardInstanceId: cardToDestroy.instanceId,
              sourceZone,
            },
            timestamp: Date.now(),
          };
        }
      }
      return null;
    }

    if (favorIsOptional(card) && beneficiary?.isAI) {
      const fromZones = card.definition.effects?.destroy_from ?? [];
      const canDestroy =
        (fromZones.includes('hand') && beneficiary.hand.length > 0) ||
        (fromZones.includes('discard') && beneficiary.discard.length > 0) ||
        (fromZones.includes('play_area') && beneficiary.playArea.length > 0);
      return {
        type: canDestroy ? 'ACCEPT_FAVOR' : 'DECLINE_FAVOR',
        playerId: beneficiary.id,
        timestamp: Date.now(),
      };
    }

    if (!favorIsOptional(card)) {
      const ai = state.players.find((p) => p.isAI);
      if (ai) {
        return {
          type: 'RESOLVE_FAVOR',
          playerId: ai.id,
          timestamp: Date.now(),
        };
      }
    } else if (beneficiary?.isAI) {
      return {
        type: 'DECLINE_FAVOR',
        playerId: beneficiary.id,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.phase === 'PREGAME') {
    const humanReady = state.players.some(
      (p) => !p.isAI && state.readyPlayerIds.includes(p.id)
    );
    if (!humanReady) return null;

    const ai = state.players.find(
      (p) => p.isAI && !state.readyPlayerIds.includes(p.id)
    );
    if (!ai) return null;
    return {
      type: 'PLAYER_READY',
      playerId: ai.id,
      timestamp: Date.now(),
    };
  }

  if (state.arenaChallenge?.phase === 'responses') {
    const pending = state.arenaChallenge.pendingResponsePlayerIds;
    const ai = state.players.find((p) => p.isAI && pending.includes(p.id));
    if (ai) {
      if (ai.hand.length === 0) {
        return {
          type: 'ARENA_RESPOND',
          playerId: ai.id,
          payload: { responseType: 'pass' },
          timestamp: Date.now(),
        };
      }
      const card = ai.hand.reduce((best, c) =>
        (c.definition?.valor ?? 0) > (best.definition?.valor ?? 0) ? c : best
      );
      const challenger = state.players.find(
        (p) => p.id === state.arenaChallenge!.challengerId
      );
      const hinder = challenger && !challenger.isAI;
      return {
        type: 'ARENA_RESPOND',
        playerId: ai.id,
        payload: {
          responseType: hinder ? 'hinder' : 'support',
          cardInstanceId: card.instanceId,
        },
        timestamp: Date.now(),
      };
    }
  }

  const current = getCurrentPlayer(state);
  if (!current?.isAI) return null;

  if (state.pendingBandingBonus?.playerId === current.id) {
    return {
      type: 'ACCEPT_BANDING_BONUS',
      playerId: current.id,
      timestamp: Date.now(),
    };
  }

  const base = {
    playerId: current.id,
    timestamp: Date.now(),
  };

  switch (state.phase) {
    case 'MAIN': {
      const playCard = pickAIPlayableCard(state, current);
      if (playCard) {
        return buildAIPlayCardAction(state, current, playCard, base);
      }
      {
        const buyTarget = findAIBuyTarget(state);
        if (buyTarget) {
          return {
            ...base,
            type: 'BUY_CARD',
            payload: { cardInstanceId: buyTarget.instanceId },
          };
        }
      }
      if (mustEnterArenaBeforeEndTurn(state, current.id)) {
        const maxCommit = getArenaMaxCommit(current);
        if (current.playArea.length >= 1) {
          const fighters = [...current.playArea]
            .sort(
              (a, b) => (b.definition?.valor ?? 0) - (a.definition?.valor ?? 0)
            )
            .slice(0, maxCommit)
            .map((c) => c.instanceId);
          return {
            ...base,
            type: 'CONFIRM_ARENA_FIGHTERS',
            payload: { cardInstanceIds: fighters },
          };
        }
        if (current.playArea.length === 0) {
          const arenaPlayCard = pickAIPlayableCard(state, current);
          if (arenaPlayCard) {
            return buildAIPlayCardAction(state, current, arenaPlayCard, base);
          }
        }
        return { ...base, type: 'DECLINE_ARENA' };
      }
      return { ...base, type: 'END_PHASE' };
    }
    case 'CLEANUP':
      return { ...base, type: 'END_PHASE' };
    default:
      return null;
  }
}

export function applyActionWithPhaseRules(
  state: GameState,
  action: GameAction
): GameState {
  const next = finishGameIfNeeded(processGameAction(state, action));
  return resumeDeferredBandingBonus(next);
}
