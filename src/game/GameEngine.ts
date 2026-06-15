import { CardInstance, CardLocation } from '../types/cardTypes';
import { GameAction, GameActionType, GamePhase, GameState, PlayerState } from '../types/gameTypes';
import { canPerformAction } from './TurnManager';
import {
  CARD_DEFINITIONS,
  GALLERY_CARD_IDS,
  ARENA_CARD_IDS,
  EPIC_CARD_IDS,
} from './CardDefinitions';

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
export const ARENA_MAX_COMMIT = 3;
export const STARTING_HAND_SIZE = 5;

export const ARENA_CHALLENGE_STATS: Record<
  string,
  { requiredValor: number; rewardVp: number }
> = {
  arena_beast: { requiredValor: 6, rewardVp: 3 },
  arena_gauntlet: { requiredValor: 8, rewardVp: 4 },
  arena_emperor: { requiredValor: 10, rewardVp: 5 },
};

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
  const definition = CARD_DEFINITIONS[definitionId];
  if (!definition) throw new Error(`Unknown card definition: ${definitionId}`);
  return {
    instanceId: nextInstanceId(),
    definitionId,
    definition,
    location,
    ownerId,
    faceUp,
  };
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
  const cards: CardInstance[] = [];
  for (let i = 0; i < 7; i++) {
    cards.push(createCardInstance('basic_gladiator', 'DECK', playerId));
  }
  for (let i = 0; i < 3; i++) {
    cards.push(createCardInstance('basic_favor', 'DECK', playerId));
  }
  return shuffle(cards);
}

function createPlayer(setup: PlayerSetup): PlayerState {
  const deck = createStartingDeck(setup.id);
  const hand = deck.splice(0, STARTING_HAND_SIZE).map((c) => ({
    ...c,
    location: 'HAND' as const,
    faceUp: true,
  }));
  return {
    id: setup.id,
    name: setup.name,
    isAI: setup.isAI ?? false,
    victoryPoints: 0,
    karma: 0,
    hand,
    deck,
    discard: [],
    playArea: [],
    itemsInPlay: [],
  };
}

export function getArenaChallengeStats(arenaCard: CardInstance | null) {
  if (!arenaCard) return { requiredValor: 6, rewardVp: 3 };
  return (
    ARENA_CHALLENGE_STATS[arenaCard.definitionId] ?? {
      requiredValor: 6,
      rewardVp: 3,
    }
  );
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
  const definition =
    CARD_DEFINITIONS[card.definitionId] ?? card.definition ?? CARD_DEFINITIONS.basic_gladiator;
  return {
    ...card,
    definitionId: card.definitionId ?? definition.id,
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
  const current = players.find((p) => p.id === state.turnPlayerId);
  let phase = state.phase;
  if (
    phase === 'DRAW' &&
    state.status === 'active' &&
    state.turnNumber >= 1 &&
    current &&
    current.hand.length > 0
  ) {
    phase = 'MAIN';
  }

  return {
    ...state,
    status: state.status ?? (state.turnPlayerId ? 'active' : 'lobby'),
    phase,
    players,
    arenaCard: state.arenaCard ? rehydrateCard(state.arenaCard) : null,
    arenaDeck: rehydrateCards(state.arenaDeck ?? []),
    arenaCommitZone: rehydrateCards(state.arenaCommitZone ?? []).map((c) => ({
      ...c,
      location: 'ARENA_COMMIT' as const,
    })),
    galleryCards: rehydrateCards(state.galleryCards ?? []),
    epicCards: rehydrateCards(state.epicCards ?? []),
    flavorDeck: rehydrateCards(state.flavorDeck ?? []),
    disfavorDeck: rehydrateCards(state.disfavorDeck ?? []),
  };
}

export function validateGameAction(
  state: GameState,
  action: GameAction
): string | null {
  if (action.type === 'START_GAME') return null;
  if (state.status === 'finished') return 'Game is finished';
  if (state.status === 'lobby') return 'Game has not started';

  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return 'Unknown player';

  if (state.turnPlayerId !== action.playerId) {
    return 'Not your turn';
  }

  if (!canPerformAction(state.phase, action.type)) {
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
        if (state.phase !== 'ARENA') return 'Arena commit only in Arena phase';
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
      const card = state.galleryCards.find(
        (c) => c.instanceId === action.payload!.cardInstanceId
      );
      if (!card) return 'Card not in gallery';
      const coins = player.karma + countCoinCardsInPlay(player);
      if (coins < card.definition.cost) return 'Not enough coins';
      return null;
    }
    case 'ATTEMPT_ARENA': {
      if (state.phase !== 'ARENA') return 'Not arena phase';
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

function countCoinCardsInPlay(player: PlayerState): number {
  return player.playArea.filter(
    (c) => c.definition.type === 'Favor' || c.definition.faction === 'Favor'
  ).length;
}

function refillGallery(state: GameState): GameState {
  if (state.galleryCards.length >= 6) return state;
  return state;
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
    ...player.hand.map((c) => ({ ...c, location: 'DISCARD' as const })),
  ];
  return { ...player, hand: [], playArea: [], discard };
}

export function createInitialGameState(
  playerSetups: PlayerSetup[],
  gameId = 'game_1'
): GameState {
  const players = playerSetups
    .slice(0, MAX_PLAYERS)
    .map((setup) => createPlayer(setup));

  const galleryPool = shuffle(
    GALLERY_CARD_IDS.flatMap((id) =>
      Array.from({ length: 4 }, () =>
        createCardInstance(id, 'GALLERY', 'market', true)
      )
    )
  );
  const galleryCards = galleryPool.splice(0, 6);

  const arenaDeck = shuffle(
    ARENA_CARD_IDS.flatMap((id) =>
      Array.from({ length: 3 }, () =>
        createCardInstance(id, 'ARENA_DECK', 'arena')
      )
    )
  );
  const arenaCard = arenaDeck.length > 0
    ? { ...arenaDeck.shift()!, location: 'ARENA' as const, faceUp: true }
    : null;

  const epicCards = EPIC_CARD_IDS.map((id) =>
    createCardInstance(id, 'EPIC_ROW', 'market', true)
  );

  const flavorDeck = Array.from({ length: 20 }, () =>
    createCardInstance('basic_favor', 'FLAVOR_DECK', 'market')
  );

  const disfavorDeck = Array.from({ length: 15 }, () =>
    createCardInstance('crowd_disfavor', 'DISFAVOR_DECK', 'market')
  );

  return {
    id: gameId,
    status: 'active',
    version: 1,
    players,
    arenaCard,
    arenaDeck,
    arenaCommitZone: [],
    galleryCards,
    epicCards,
    flavorDeck,
    disfavorDeck,
    turnPlayerId: players[0]?.id ?? '',
    phase: 'MAIN',
    turnNumber: 1,
    actionLog: [],
  };
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
      karma: 0,
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
    phase: 'DRAW',
    turnNumber: 0,
    actionLog: [],
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

      const card = { ...player.hand[cardIdx], location: 'PLAY_AREA' as const };
      player.hand = player.hand.filter((_, i) => i !== cardIdx);
      player.playArea = [...player.playArea, card];
      next.players = [...next.players];
      next.players[playerIdx] = player;
      return next;
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
      if (galleryIdx === -1) return next;

      const boughtCard = {
        ...next.galleryCards[galleryIdx],
        location: 'DISCARD' as const,
        ownerId: player.id,
      };
      player.discard = [...player.discard, boughtCard];

      const newGallery = [...next.galleryCards];
      newGallery.splice(galleryIdx, 1);
      next.galleryCards = newGallery;

      next.players = [...next.players];
      next.players[playerIdx] = player;
      return refillGallery(next);
    }

    case 'ATTEMPT_ARENA': {
      if (!next.arenaCard || !player) return next;
      const { requiredValor, rewardVp } = getArenaChallengeStats(next.arenaCard);
      const totalValor = getArenaCommitValor(next);
      const success = totalValor >= requiredValor;

      if (success) {
        player.victoryPoints += rewardVp;
      } else if (next.disfavorDeck.length > 0) {
        const disfavor = {
          ...next.disfavorDeck[0],
          location: 'DISCARD' as const,
          ownerId: player.id,
          faceUp: true,
        };
        next.disfavorDeck = next.disfavorDeck.slice(1);
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
      return advancePhase(next, playerIdx, player);
    }

    default:
      return next;
  }
}

function advancePhase(
  state: GameState,
  playerIdx: number,
  player: PlayerState | null
): GameState {
  const phases: GamePhase[] = ['DRAW', 'MAIN', 'ARENA', 'BUY', 'END'];
  const currentIdx = phases.indexOf(state.phase);
  const next = { ...state };

  if (state.phase === 'END') {
    if (player) {
      const cleaned = cleanupTurnPlayer(player);
      next.players = [...next.players];
      next.players[playerIdx] = cleaned;
    }

    next.arenaCommitZone = [];

    const nextPlayerIdx = (playerIdx + 1) % next.players.length;
    next.turnPlayerId = next.players[nextPlayerIdx].id;
    next.turnNumber += 1;

    let nextPlayer = { ...next.players[nextPlayerIdx] };
    nextPlayer = drawCards(nextPlayer, STARTING_HAND_SIZE);
    next.players = [...next.players];
    next.players[nextPlayerIdx] = nextPlayer;
    next.phase = 'MAIN';
    return next;
  }

  if (state.phase === 'ARENA') {
    next.arenaCommitZone = [];
  }

  next.phase = phases[currentIdx + 1];
  return next;
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
  const current = getCurrentPlayer(state);
  if (!current?.isAI) return null;

  const base = {
    playerId: current.id,
    timestamp: Date.now(),
  };

  switch (state.phase) {
    case 'DRAW':
      return { ...base, type: 'END_PHASE' };
    case 'MAIN':
      if (current.hand.length > 0) {
        return {
          ...base,
          type: 'PLAY_CARD',
          payload: { cardInstanceId: current.hand[0].instanceId },
        };
      }
      return { ...base, type: 'END_PHASE' };
    case 'ARENA':
      return { ...base, type: 'END_PHASE' };
    case 'BUY':
      return { ...base, type: 'END_PHASE' };
    case 'END':
      return { ...base, type: 'END_PHASE' };
    default:
      return null;
  }
}

export function shouldAutoDrawOnEndDraw(state: GameState, action: GameAction): GameAction[] {
  if (action.type !== 'END_PHASE' || state.phase !== 'DRAW') return [];
  return [
    {
      type: 'DRAW_CARD',
      playerId: action.playerId,
      payload: { count: STARTING_HAND_SIZE },
      timestamp: Date.now(),
    },
  ];
}

export function applyActionWithPhaseRules(
  state: GameState,
  action: GameAction
): GameState {
  if (action.type === 'END_PHASE' && state.phase === 'DRAW') {
    let next = processGameAction(state, {
      type: 'DRAW_CARD',
      playerId: action.playerId,
      payload: { count: STARTING_HAND_SIZE },
      timestamp: Date.now(),
    });
    next = processGameAction(next, action);
    return next;
  }
  return processGameAction(state, action);
}
