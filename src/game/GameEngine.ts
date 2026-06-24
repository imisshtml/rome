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
  splitPlayerDeckCycleCards,
} from '../utils/deckCycleUtils';
import { pickForcedDiscardCard } from '../utils/forcedDiscardUtils';
import { addToDestroyedPile } from '../utils/destroyedPileUtils';
import {
  isOpeningGamesArena,
  mustEnterArenaBeforeEndTurn,
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
  BANDING_BONUS_LABEL,
  BandingFaction,
  chooseSpyFactionForAI,
  detectTriggeredBandingFaction,
  pickAICardToPlayFirst,
} from '../utils/bandingUtils';
import {
  awardOptionalEventDiscardCoins,
  beginGalleryEventResolution,
  drawGallerySupplyCard,
  eventHandChoiceDestroys,
  galleryRefillPaused,
  GALLERY_ROW_SIZE,
} from './EventResolver';
import {
  CROWD_DISFAVOR,
  GRATIA_SUPPLY,
  getCardDefinition,
  getGalleryPoolEntries,
  getRecruitPoolEntries,
  getEpicPoolEntries,
  getArenaPoolEntries,
  getFlavorPoolEntries,
  getStartingDeckEntries,
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

function returnFavorCardToSupply(card: CardInstance): CardInstance {
  return {
    ...card,
    location: 'FLAVOR_DECK',
    ownerId: 'market',
    faceUp: false,
    chosenFaction: undefined,
  };
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
  const cards = getStartingDeckEntries().flatMap(({ definitionId, qty }) =>
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
    getGalleryPoolEntries(),
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
    disfavorDeck,
  };
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

function applyCardPlayEffects(
  state: GameState,
  playerIdx: number,
  card: CardInstance
): GameState {
  let next = state;
  let coinGain = 0;
  const effects = card.definition.effects as
    | (typeof card.definition.effects & { gain_gratia?: number })
    | undefined;
  if (effects) {
    coinGain = effects.gain_coins ?? 0;
    const drawForEffects = (player: PlayerState, drawCount: number) => {
      const drawn = drawCardsIntoState(next, player, drawCount);
      next = drawn.state;
      return drawn.player;
    };
    next = applyStructuredPlayEffects(
      next,
      playerIdx,
      card,
      effects,
      drawForEffects
    );

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
  } else {
    coinGain = getLegacyCoinGain(card);
    const valor = card.definition.valor ?? 0;
    if (coinGain === 0 && valor === 0) return state;
    next = {
      ...state,
      turnCoins: state.turnCoins + coinGain,
    };
  }
  const discardCount = effects?.discard_cards ?? 0;
  const forceOpponentDiscard = effects?.force_opponent_discard ?? 0;
  if (discardCount > 0 && forceOpponentDiscard <= 0) {
    next = {
      ...next,
      pendingHandDiscard: {
        playerId: next.players[playerIdx].id,
        remaining: discardCount,
        sourceCardName: card.definition.name,
      },
    };
  }
  return applyImperialTaxIfPending(next, playerIdx, coinGain);
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

function advanceForcedOpponentDiscards(state: GameState): GameState {
  const pending = state.pendingForcedOpponentDiscards;
  if (!pending) return state;

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
  perOpponent: number,
  sourceCardName?: string
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

  const controller = state.players[playerIdx];
  const opponents = state.players.filter(
    (p) => p.id !== controller.id && p.hand.length > 0
  );
  if (opponents.length === 0) return state;

  if (controller.isAI) {
    return resolveForcedOpponentDiscardsForAI(
      state,
      playerIdx,
      perOpponent,
      card.definition.name
    );
  }

  const [first, ...rest] = opponents.map((p) => p.id);
  return {
    ...state,
    pendingForcedOpponentDiscards: {
      controllerId: controller.id,
      sourceCardName: card.definition.name,
      targetPlayerId: first,
      remainingTargetIds: rest,
    },
  };
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
    turnActionHighlight: null,
    pendingGalleryEvent: null,
    pendingHandDiscard: null,
    pendingForcedOpponentDiscards: null,
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

  const hinderValor = Object.values(challenge.hinderByPlayerId)
    .filter((c): c is CardInstance => c != null)
    .reduce((sum, c) => sum + (c.definition?.valor ?? 0), 0);

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
    turnActionHighlight: state.turnActionHighlight ?? null,
    pendingGalleryEvent: state.pendingGalleryEvent
      ? rehydrateCard(state.pendingGalleryEvent)
      : null,
    pendingEventDiscards: state.pendingEventDiscards ?? [],
    pendingEventOptionalDiscards: state.pendingEventOptionalDiscards ?? null,
    pendingHandDiscard: state.pendingHandDiscard ?? null,
    pendingForcedOpponentDiscards: state.pendingForcedOpponentDiscards ?? null,
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

  if (
    state.pendingGalleryEvent ||
    (state.pendingEventDiscards?.length ?? 0) > 0 ||
    (state.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0
  ) {
    if (action.type === 'RESOLVE_GALLERY_EVENT') {
      if ((state.pendingEventDiscards?.length ?? 0) > 0) {
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
      const requiredIds = state.pendingEventDiscards ?? [];
      const waiting =
        optionalIds.includes(action.playerId) ||
        requiredIds.includes(action.playerId);
      if (!waiting) return 'Not waiting for your event response';
      if (!action.payload?.cardInstanceId) return 'Select a card from hand';
      const p = state.players.find((pl) => pl.id === action.playerId);
      if (!p?.hand.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Card not in hand';
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
    if (ids.length !== ARENA_MAX_COMMIT) {
      return `Select exactly ${ARENA_MAX_COMMIT} fighters`;
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

  if (state.turnPlayerId !== action.playerId) {
    return 'Not your turn';
  }

  if (
    state.pendingBandingBonus?.playerId === action.playerId &&
    action.type !== 'ACCEPT_BANDING_BONUS' &&
    action.type !== 'DECLINE_BANDING_BONUS'
  ) {
    return 'Resolve banding bonus first';
  }

  if (state.pendingHandDiscard?.playerId === action.playerId) {
    if (action.type === 'DISCARD_CARD') {
      if (!action.payload?.cardInstanceId) return 'Select a card to discard';
      if (!player.hand.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Discard from your hand';
      }
      return null;
    }
    return `Discard ${state.pendingHandDiscard.remaining} card(s) from hand`;
  }

  if (state.pendingForcedOpponentDiscards?.controllerId === action.playerId) {
    if (action.type === 'FORCE_OPPONENT_DISCARD') {
      if (!action.payload?.cardInstanceId) return 'Select a card to discard';
      const targetId = state.pendingForcedOpponentDiscards.targetPlayerId;
      const target = state.players.find((p) => p.id === targetId);
      if (!target?.hand.some((c) => c.instanceId === action.payload!.cardInstanceId)) {
        return 'Card not in opponent hand';
      }
      return null;
    }
    return 'Choose a card for your opponent to discard';
  }

  if (state.pendingForcedOpponentDiscards) {
    return 'Waiting for forced discard';
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
      if (state.turnCoins < card.definition.cost) return 'Not enough coins';
      if (
        state.purchaseCostCap != null &&
        card.definition.cost > state.purchaseCostCap
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
    location: 'HAND' as const,
    ownerId: player.id,
    faceUp: true,
  };

  return {
    state: { ...state, flavorDeck },
    player: { ...player, hand: [...player.hand, gained] },
  };
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

function maybeOfferBandingBonus(
  state: GameState,
  playerIdx: number,
  playedCard: CardInstance
): GameState {
  if (playedCard.definition.type === 'Item') return state;
  if (state.pendingBandingBonus) return state;

  const player = state.players[playerIdx];
  const claimed = state.turnBandingClaimed ?? [];
  const faction = detectTriggeredBandingFaction(player.playArea, claimed, playedCard);
  if (!faction) return state;

  return {
    ...state,
    pendingBandingBonus: {
      playerId: player.id,
      faction,
      bonusText: BANDING_BONUS_LABEL[faction],
    },
  };
}

function enrichActionLog(state: GameState, action: GameAction): GameAction {
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return action;

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
    return {
      ...action,
      payload: {
        ...action.payload,
        cardName: state.pendingGalleryEvent.definition.name,
        definitionId: state.pendingGalleryEvent.definitionId,
        effectSummary: state.pendingGalleryEvent.definition.text,
      },
    };
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
    turnActionHighlight: null,
    pendingGalleryEvent: null,
    pendingEventDiscards: [],
    pendingEventOptionalDiscards: null,
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
    turnActionHighlight: null,
    pendingGalleryEvent: null,
    pendingEventDiscards: [],
    pendingEventOptionalDiscards: null,
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

      if (card.definition.type === 'Item') {
        card.location = 'ITEMS_IN_PLAY';
        player.itemsInPlay = [...player.itemsInPlay, card];
      } else if (!isFavorCard) {
        card.location = 'PLAY_AREA';
        player.playArea = [...player.playArea, card];
      }

      next.players = [...next.players];
      next.players[playerIdx] = player;
      let result = applyCardPlayEffects(next, playerIdx, card);
      result = maybeBeginForcedOpponentDiscards(result, playerIdx, card);
      result = maybeOfferBandingBonus(result, playerIdx, card);
      if (isFavorCard) {
        result = {
          ...result,
          flavorDeck: [...result.flavorDeck, returnFavorCardToSupply(card)],
        };
      }
      return result;
    }

    case 'ACCEPT_BANDING_BONUS': {
      if (!player || !next.pendingBandingBonus) return next;
      const faction = next.pendingBandingBonus.faction;
      let resolved = applyBandingBonus(next, playerIdx, faction);
      resolved = {
        ...resolved,
        pendingBandingBonus: null,
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
        turnBandingClaimed: [...(next.turnBandingClaimed ?? []), faction],
      };
    }

    case 'FORCE_OPPONENT_DISCARD': {
      if (!next.pendingForcedOpponentDiscards || !action.payload?.cardInstanceId) {
        return next;
      }
      if (action.playerId !== next.pendingForcedOpponentDiscards.controllerId) {
        return next;
      }

      const { targetPlayerId } = next.pendingForcedOpponentDiscards;
      next = applyForcedOpponentDiscard(
        next,
        targetPlayerId,
        action.payload.cardInstanceId
      );
      next = advanceForcedOpponentDiscards(next);
      return next;
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

    case 'DISCARD_CARD': {
      if (!player || !action.payload?.cardInstanceId) return next;

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
      if (ids.length !== ARENA_MAX_COMMIT) return next;

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

      if (!boughtCard || !marketSource) return next;

      next.turnActionHighlight = {
        playerId: player.id,
        kind: 'buy',
        marketSource,
        marketIndex,
        card: boughtCard,
      };

      player.discard = [...player.discard, boughtCard];
      next.turnCoins -= boughtCard.definition.cost;

      next.players = [...next.players];
      next.players[playerIdx] = player;
      return refillEpicRow(next);
    }

    case 'RESOLVE_GALLERY_EVENT': {
      if (!next.pendingGalleryEvent) return next;
      if ((next.pendingEventDiscards?.length ?? 0) > 0) return next;
      if (
        (next.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0
      ) {
        return next;
      }

      next.pendingGalleryEvent = null;
      next = processGalleryRefill(next);
      return next;
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
      const isRequired = next.pendingEventDiscards?.includes(action.playerId);
      if (!isOptional && !isRequired) return next;

      const handIdx = player.hand.findIndex(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );
      if (handIdx === -1) return next;

      const removed = player.hand[handIdx];
      player.hand = player.hand.filter((_, i) => i !== handIdx);

      const destroys =
        isRequired &&
        !!next.pendingGalleryEvent &&
        eventHandChoiceDestroys(next.pendingGalleryEvent);

      if (!destroys) {
        player.discard = [
          ...player.discard,
          { ...removed, location: 'DISCARD' as const, faceUp: true },
        ];
      } else {
        next = addToDestroyedPile(next, [{ ...removed, ownerId: player.id }]);
      }

      if (isOptional && optional) {
        next = awardOptionalEventDiscardCoins(
          next,
          action.playerId,
          optional.coinReward
        );
        next.pendingEventOptionalDiscards = {
          ...optional,
          pendingPlayerIds: optional.pendingPlayerIds.filter(
            (id) => id !== action.playerId
          ),
        };
        next.players = [...next.players];
        next.players[playerIdx] = player;

        if (next.pendingEventOptionalDiscards.pendingPlayerIds.length > 0) {
          return next;
        }
        return finishGalleryEventPlayerResponses(next);
      }

      next.players = [...next.players];
      next.players[playerIdx] = player;
      next.pendingEventDiscards = next.pendingEventDiscards!.filter(
        (id) => id !== action.playerId
      );

      if ((next.pendingEventDiscards?.length ?? 0) > 0) {
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

    case 'END_PHASE': {
      if (next.phase === 'MAIN') {
        return endTurnAndPass(next, playerIdx, player);
      }
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
    pendingEventDiscards: [],
    pendingEventOptionalDiscards: null,
  };
  return processGalleryRefill(next);
}

/** Refill gallery one card at a time; pause on events until resolved. */
function processGalleryRefill(state: GameState): GameState {
  let next = removePurchasedGalleryCards(state);

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
    turnBandingClaimed: [],
    pendingBandingBonus: null,
    turnActionHighlight: null,
    pendingHandDiscard: null,
    pendingForcedOpponentDiscards: null,
    pendingArenaLoss: null,
    deferredTurnEnd: null,
    purchaseCostCap: state.purchaseCostCap ?? null,
    purchaseCostCapActiveForPlayerId:
      state.purchaseCostCapActiveForPlayerId ?? null,
    turnArenaResolved: false,
    turnArenaExempt: false,
  };

  const nextPlayer = next.players[nextPlayerIdx];
  let turnCoins = 0;
  let updatedPlayer = { ...nextPlayer, carryCoins: 0 };
  const carry = nextPlayer.carryCoins ?? 0;
  if (carry > 0) {
    turnCoins = carry;
  }
  if (updatedPlayer.imperialTaxPending) {
    turnCoins = Math.max(0, turnCoins - 1);
    updatedPlayer = { ...updatedPlayer, imperialTaxPending: false };
  }
  next.turnCoins = turnCoins;
  next.players = [...next.players];
  next.players[nextPlayerIdx] = updatedPlayer;

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
  while (setups.length < fillWithAiTo && seat < MAX_PLAYERS) {
    seat += 1;
    setups.push({
      id: `player_${seat}`,
      name: `AI ${seat}`,
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
  ].filter((c) => c.definition.cost <= state.turnCoins);
  if (options.length === 0) return null;
  return options.reduce((best, c) =>
    c.definition.cost > best.definition.cost ? c : best
  );
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

  if ((state.pendingEventDiscards?.length ?? 0) > 0) {
    const playerId = state.pendingEventDiscards![0];
    const player = state.players.find((p) => p.id === playerId);
    if (player?.isAI && player.hand.length > 0) {
      const card = player.hand[player.hand.length - 1];
      return {
        type: 'EVENT_DISCARD_CARD',
        playerId: player.id,
        payload: { cardInstanceId: card.instanceId },
        timestamp: Date.now(),
      };
    }
    return null;
  }

  if (state.pendingHandDiscard) {
    const { playerId } = state.pendingHandDiscard;
    const player = state.players.find((p) => p.id === playerId);
    if (player?.isAI && player.hand.length > 0) {
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
    return null;
  }

  if (state.pendingForcedOpponentDiscards) {
    const { controllerId, targetPlayerId } = state.pendingForcedOpponentDiscards;
    const controller = state.players.find((p) => p.id === controllerId);
    const target = state.players.find((p) => p.id === targetPlayerId);
    if (controller?.isAI && target && target.hand.length > 0) {
      const card = pickForcedDiscardCard(target.hand);
      if (card) {
        return {
          type: 'FORCE_OPPONENT_DISCARD',
          playerId: controllerId,
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
    case 'MAIN':
      if (current.hand.length > 0) {
        const claimed = (state.turnBandingClaimed ?? []).filter(
          (f): f is BandingFaction =>
            f === 'Ludus' || f === 'Legion' || f === 'Senate'
        );
        const card = pickAICardToPlayFirst(
          current.hand,
          current.playArea,
          claimed
        );
        const payload: GameAction['payload'] = {
          cardInstanceId: card.instanceId,
        };
        if (requiresFactionChoiceOnPlay(card.definition)) {
          payload.chosenFaction = chooseSpyFactionForAI(
            current.playArea,
            current.hand,
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
        if (current.playArea.length >= ARENA_MAX_COMMIT) {
          const fighters = [...current.playArea]
            .sort(
              (a, b) => (b.definition?.valor ?? 0) - (a.definition?.valor ?? 0)
            )
            .slice(0, ARENA_MAX_COMMIT)
            .map((c) => c.instanceId);
          return {
            ...base,
            type: 'CONFIRM_ARENA_FIGHTERS',
            payload: { cardInstanceIds: fighters },
          };
        }
        if (current.hand.length > 0 && current.playArea.length < ARENA_MAX_COMMIT) {
          const claimed = (state.turnBandingClaimed ?? []).filter(
            (f): f is BandingFaction =>
              f === 'Ludus' || f === 'Legion' || f === 'Senate'
          );
          const card = pickAICardToPlayFirst(
            current.hand,
            current.playArea,
            claimed
          );
          const payload: GameAction['payload'] = {
            cardInstanceId: card.instanceId,
          };
          if (requiresFactionChoiceOnPlay(card.definition)) {
            payload.chosenFaction = chooseSpyFactionForAI(
              current.playArea,
              current.hand,
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
        return { ...base, type: 'DECLINE_ARENA' };
      }
      return { ...base, type: 'END_PHASE' };
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
  return finishGameIfNeeded(processGameAction(state, action));
}
