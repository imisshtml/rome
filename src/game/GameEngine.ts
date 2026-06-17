import { CardInstance, CardLocation } from '../types/cardTypes';
import { GameAction, GameActionType, GamePhase, GameState, PlayerState } from '../types/gameTypes';
import { canPerformAction } from './TurnManager';
import { finishGameIfNeeded, getPlayerTotalVp } from './postGame';
import { applyStructuredPlayEffects, getLegacyCoinGain } from './EffectResolver';
import {
  CROWD_DISFAVOR,
  getCardDefinition,
  getGalleryPoolEntries,
  getEpicPoolEntries,
  getArenaPoolEntries,
  getFlavorPoolEntries,
  getStartingDeckEntries,
} from './CardDefinitions';

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
export const ARENA_MAX_COMMIT = 3;
export const STARTING_HAND_SIZE = 5;

export const ARENA_CHALLENGE_STATS: Record<
  string,
  { requiredValor: number; rewardVp: number }
> = {};

const GALLERY_ROW_SIZE = 6;
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

function createMarketCards() {
  const gallerySupply = buildPoolInstances(
    getGalleryPoolEntries(),
    'GALLERY',
    'market',
    false
  );
  const galleryCards = gallerySupply.splice(0, GALLERY_ROW_SIZE).map((c) => ({
    ...c,
    faceUp: true,
  }));

  const arenaDeck = buildPoolInstances(
    getArenaPoolEntries(),
    'ARENA_DECK',
    'arena',
    false
  );
  const arenaCard =
    arenaDeck.length > 0
      ? { ...arenaDeck.shift()!, location: 'ARENA' as const, faceUp: true }
      : null;

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

  return {
    galleryCards,
    gallerySupply,
    arenaCard,
    arenaDeck,
    epicCards,
    epicSupply,
    flavorDeck,
    disfavorDeck,
  };
}

function applyCardPlayEffects(
  state: GameState,
  playerIdx: number,
  card: CardInstance
): GameState {
  const effects = card.definition.effects;
  if (effects) {
    return applyStructuredPlayEffects(state, playerIdx, card, effects, drawCards);
  }

  const coins = getLegacyCoinGain(card);
  const valor = card.definition.valor ?? 0;
  if (coins === 0 && valor === 0) return state;

  return {
    ...state,
    turnCoins: state.turnCoins + coins,
    turnValor: state.turnValor + valor,
  };
}

function findMarketCard(state: GameState, instanceId: string): CardInstance | undefined {
  return (
    state.galleryCards.find((c) => c.instanceId === instanceId) ??
    state.epicCards.find((c) => c.instanceId === instanceId)
  );
}

function allPlayersReady(state: GameState): boolean {
  return state.players.every((p) => state.readyPlayerIds.includes(p.id));
}

function activateGameFromPregame(state: GameState): GameState {
  const players = state.players.map((p) => drawCards({ ...p, hand: [] }, STARTING_HAND_SIZE));
  return {
    ...state,
    status: 'active',
    phase: 'MAIN',
    players,
    turnPlayerId: players[0]?.id ?? '',
    turnNumber: 1,
    turnCoins: 0,
    turnValor: 0,
    readyPlayerIds: state.readyPlayerIds,
  };
}

export function getArenaChallengeStats(arenaCard: CardInstance | null) {
  if (!arenaCard) return { requiredValor: 6, rewardVp: 3 };
  const def = arenaCard.definition;
  return {
    requiredValor: def.valorRequired ?? 6,
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

function rehydratePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    hand: rehydrateCards(player.hand ?? []).map((c) => ({
      ...c,
      location: 'HAND' as const,
      faceUp: c.faceUp ?? true,
    })),
    deck: rehydrateCards(player.deck ?? []).map((c) => ({
      ...c,
      location: 'DECK' as const,
      faceUp: false,
    })),
    discard: rehydrateCards(player.discard ?? []).map((c) => ({
      ...c,
      location: 'DISCARD' as const,
    })),
    playArea: rehydrateCards(player.playArea ?? []).map((c) => ({
      ...c,
      location: 'PLAY_AREA' as const,
    })),
    itemsInPlay: rehydrateCards(player.itemsInPlay ?? []).map((c) => ({
      ...c,
      location: 'ITEMS_IN_PLAY' as const,
    })),
  };
}

/** Restore card definitions after Supabase JSON round-trip. */
export function rehydrateGameState(state: GameState): GameState {
  const players = (state.players ?? []).map(rehydratePlayer);
  let phase = normalizePhase(state.phase);
  let status = state.status ?? (state.turnPlayerId ? 'active' : 'lobby');

  if (
    status === 'active' &&
    (phase === 'PREGAME' || (state as { phase?: string }).phase === 'DRAW')
  ) {
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
    arenaCard: state.arenaCard ? rehydrateCard(state.arenaCard) : null,
    arenaDeck: rehydrateCards(state.arenaDeck ?? []),
    arenaCommitZone: rehydrateCards(state.arenaCommitZone ?? []).map((c) => ({
      ...c,
      location: 'ARENA_COMMIT' as const,
    })),
    galleryCards: rehydrateCards(state.galleryCards ?? []),
    gallerySupply: rehydrateCards(state.gallerySupply ?? []),
    epicCards: rehydrateCards(state.epicCards ?? []),
    epicSupply: rehydrateCards(state.epicSupply ?? []),
    flavorDeck: rehydrateCards(state.flavorDeck ?? []),
    disfavorDeck:
      (state.disfavorDeck ?? []).length > 0
        ? rehydrateCards(state.disfavorDeck).map((c) => ({ ...c, faceUp: true }))
        : [createCardInstance(CROWD_DISFAVOR.id, 'DISFAVOR_DECK', 'market', true)],
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

  if (state.turnPlayerId !== action.playerId) {
    return 'Not your turn';
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
      return null;
    }
    case 'MOVE_CARD': {
      if (!action.payload?.cardInstanceId || !action.payload?.targetZone) {
        return 'Missing move payload';
      }
      if (action.payload.targetZone === 'ARENA_COMMIT') {
        if (state.arenaCommitZone.length >= ARENA_MAX_COMMIT) {
          return `Max ${ARENA_MAX_COMMIT} cards in arena commit`;
        }
        const inHand = player.hand.some(
          (c) => c.instanceId === action.payload!.cardInstanceId
        );
        const inPlay = player.playArea.some(
          (c) => c.instanceId === action.payload!.cardInstanceId
        );
        if (!inHand && !inPlay) return 'Card not available to commit';
      }
      return null;
    }
    case 'BUY_CARD': {
      if (!action.payload?.cardInstanceId) return 'Missing card';
      const card = findMarketCard(state, action.payload.cardInstanceId);
      if (!card) return 'Card not available to buy';
      if (state.turnCoins < card.definition.cost) return 'Not enough coins';
      return null;
    }
    case 'ATTEMPT_ARENA': {
      if (!state.arenaCard) return 'No arena challenge';
      if (state.arenaCommitZone.length === 0) return 'No cards committed';
      return null;
    }
    case 'DRAW_CARD':
    case 'DISCARD_CARD':
    case 'END_PHASE':
      return null;
    default:
      return 'Unknown action';
  }
}

function refillGallery(state: GameState): GameState {
  if (state.galleryCards.length >= GALLERY_ROW_SIZE) return state;
  const supply = [...(state.gallerySupply ?? [])];
  const galleryCards = [...state.galleryCards];
  while (galleryCards.length < GALLERY_ROW_SIZE && supply.length > 0) {
    galleryCards.push({
      ...supply.shift()!,
      location: 'GALLERY',
      faceUp: true,
    });
  }
  return { ...state, galleryCards, gallerySupply: supply };
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

function drawCards(player: PlayerState, count: number): PlayerState {
  const newDeck = [...player.deck];
  const newHand = [...player.hand];
  const newDiscard = [...player.discard];

  for (let i = 0; i < count; i++) {
    if (newDeck.length === 0 && newDiscard.length > 0) {
      const reshuffled = shuffle(newDiscard).map((c) => ({
        ...c,
        location: 'DECK' as const,
        faceUp: false,
      }));
      newDeck.push(...reshuffled);
      newDiscard.length = 0;
    }
    if (newDeck.length > 0) {
      const drawn = newDeck.shift()!;
      newHand.push({ ...drawn, location: 'HAND', faceUp: true });
    }
  }

  return { ...player, deck: newDeck, hand: newHand, discard: newDiscard };
}

function cleanupTurnPlayer(player: PlayerState): PlayerState {
  const discard = [
    ...player.discard,
    ...player.playArea.map((c) => ({ ...c, location: 'DISCARD' as const })),
    ...player.itemsInPlay.map((c) => ({ ...c, location: 'DISCARD' as const })),
    ...player.hand.map((c) => ({ ...c, location: 'DISCARD' as const })),
  ];
  return { ...player, hand: [], playArea: [], itemsInPlay: [], discard };
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
    galleryCards: market.galleryCards,
    gallerySupply: market.gallerySupply,
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

  const next: GameState = {
    ...state,
    actionLog: [...state.actionLog, action],
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
      player = drawCards(player, count);
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

      if (card.definition.type === 'Item') {
        card.location = 'ITEMS_IN_PLAY';
        player.itemsInPlay = [...player.itemsInPlay, card];
      } else {
        card.location = 'PLAY_AREA';
        player.playArea = [...player.playArea, card];
      }

      next.players = [...next.players];
      next.players[playerIdx] = player;
      return applyCardPlayEffects(next, playerIdx, card);
    }

    case 'DISCARD_CARD': {
      if (!player || !action.payload?.cardInstanceId) return next;
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
      const { cardInstanceId, targetZone } = action.payload;

      if (targetZone === 'ARENA_COMMIT') {
        const handIdx = player.hand.findIndex((c) => c.instanceId === cardInstanceId);
        const playIdx = player.playArea.findIndex((c) => c.instanceId === cardInstanceId);

        let card: CardInstance | null = null;
        if (handIdx !== -1) {
          card = { ...player.hand[handIdx] };
          player.hand = player.hand.filter((_, i) => i !== handIdx);
        } else if (playIdx !== -1) {
          card = { ...player.playArea[playIdx] };
          player.playArea = player.playArea.filter((_, i) => i !== playIdx);
        }

        if (card) {
          card.location = 'ARENA_COMMIT';
          card.ownerId = player.id;
          next.arenaCommitZone = [...next.arenaCommitZone, card];
        }
      }

      next.players = [...next.players];
      next.players[playerIdx] = player;
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
      if (galleryIdx !== -1) {
        boughtCard = {
          ...next.galleryCards[galleryIdx],
          location: 'DISCARD' as const,
          ownerId: player.id,
        };
        const newGallery = [...next.galleryCards];
        newGallery.splice(galleryIdx, 1);
        next.galleryCards = newGallery;
      } else if (epicIdx !== -1) {
        boughtCard = {
          ...next.epicCards[epicIdx],
          location: 'DISCARD' as const,
          ownerId: player.id,
        };
        const newEpic = [...next.epicCards];
        newEpic.splice(epicIdx, 1);
        next.epicCards = newEpic;
      }

      if (!boughtCard) return next;

      player.discard = [...player.discard, boughtCard];
      next.turnCoins -= boughtCard.definition.cost;

      next.players = [...next.players];
      next.players[playerIdx] = player;
      return refillEpicRow(refillGallery(next));
    }

    case 'ATTEMPT_ARENA': {
      if (!next.arenaCard || !player) return next;
      const { requiredValor, rewardVp } = getArenaChallengeStats(next.arenaCard);
      const totalValor = getArenaCommitValor(next);
      const success = totalValor >= requiredValor;

      if (success) {
        player.victoryPoints += rewardVp;
      } else {
        const disfavor = createCardInstance(CROWD_DISFAVOR.id, 'DISCARD', player.id, true);
        player.discard = [...player.discard, disfavor];
      }

      for (const c of next.arenaCommitZone) {
        player.discard.push({ ...c, location: 'DISCARD', ownerId: player.id });
      }
      next.arenaCommitZone = [];

      if (success) {
        if (next.arenaDeck.length > 0) {
          next.arenaCard = {
            ...next.arenaDeck.shift()!,
            location: 'ARENA',
            faceUp: true,
          };
        } else {
          next.arenaCard = null;
        }
      }

      next.players = [...next.players];
      next.players[playerIdx] = player;
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

function endTurnAndPass(
  state: GameState,
  playerIdx: number,
  player: PlayerState | null
): GameState {
  let next: GameState = { ...state, phase: 'CLEANUP' };

  if (player) {
    const cleaned = cleanupTurnPlayer(player);
    next.players = [...next.players];
    next.players[playerIdx] = cleaned;
  }

  next.arenaCommitZone = [];

  const nextPlayerIdx = (playerIdx + 1) % next.players.length;
  next.turnPlayerId = next.players[nextPlayerIdx].id;
  next.turnNumber += 1;

  let nextPlayer = drawCards({ ...next.players[nextPlayerIdx], hand: [] }, STARTING_HAND_SIZE);
  next.players = [...next.players];
  next.players[nextPlayerIdx] = nextPlayer;
  next.phase = 'MAIN';
  next.turnCoins = 0;
  next.turnValor = 0;
  return finishGameIfNeeded(next);
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

export function getNextAIAction(state: GameState): GameAction | null {
  if (state.phase === 'PREGAME') {
    const ai = state.players.find((p) => p.isAI && !state.readyPlayerIds.includes(p.id));
    if (!ai) return null;
    return {
      type: 'PLAYER_READY',
      playerId: ai.id,
      timestamp: Date.now(),
    };
  }

  const current = getCurrentPlayer(state);
  if (!current?.isAI) return null;

  const base = {
    playerId: current.id,
    timestamp: Date.now(),
  };

  switch (state.phase) {
    case 'MAIN':
      if (current.hand.length > 0) {
        return {
          ...base,
          type: 'PLAY_CARD',
          payload: { cardInstanceId: current.hand[0].instanceId },
        };
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
