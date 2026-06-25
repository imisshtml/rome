import type { CardInstance } from '../types/cardTypes';
import type { GameState, PlayerState } from '../types/gameTypes';
import {
  getCopyCardSpec,
  getGainCardSpec,
  getLookAtTopCount,
  listEligibleDestroyedGainCards,
  listEligibleMarketCopyCards,
  listEligibleMarketGainCards,
  shouldDeferGalleryRefill,
  wantsGainBandingBonusChoice,
} from '../utils/effectFlowUtils';
import { getRawEffects } from '../utils/playDestroyUtils';
import { isGalleryEventCard } from './CardCatalog';

type GalleryAvailableFn = (state: GameState, instanceId: string) => boolean;

export function beginInteractivePlayPicks(
  state: GameState,
  playerIdx: number,
  card: CardInstance,
  isGalleryAvailable: GalleryAvailableFn
): GameState {
  const player = state.players[playerIdx];
  const lookCount = getLookAtTopCount(card);
  if (lookCount > 0) {
    return {
      ...state,
      pendingDeckLookPick: {
        playerId: player.id,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
        lookCount,
        phase: 'choose_deck',
      },
    };
  }

  const copySpec = getCopyCardSpec(card);
  if (copySpec?.source === 'market') {
    const eligible = listEligibleMarketCopyCards(
      state,
      copySpec,
      (id) => isGalleryAvailable(state, id)
    );
    if (eligible.length > 0) {
      return {
        ...state,
        pendingCopyCardPick: {
          playerId: player.id,
          sourceCardName: card.definition.name,
          sourceCardInstanceId: card.instanceId,
          maxCost: copySpec.maxCost,
        },
      };
    }
  }

  const gainSpec = getGainCardSpec(card);
  if (gainSpec?.source === 'destroyed_pile') {
    const eligible = listEligibleDestroyedGainCards(state, gainSpec);
    if (eligible.length > 0) {
      return {
        ...state,
        pendingGainCardPick: {
          playerId: player.id,
          sourceCardName: card.definition.name,
          sourceCardInstanceId: card.instanceId,
          maxCost: gainSpec.maxCost,
          cardType: gainSpec.type,
          gainSource: 'destroyed_pile',
        },
      };
    }
  }

  if (gainSpec && (gainSpec.source === 'market' || gainSpec.source === 'market_or_epic')) {
    const eligible = listEligibleMarketGainCards(
      state,
      gainSpec,
      (id) => isGalleryAvailable(state, id)
    );
    if (eligible.length > 0) {
      const discardAfter = (getRawEffects(card).discard_cards as number) ?? 0;
      return {
        ...state,
        pendingGainCardPick: {
          playerId: player.id,
          sourceCardName: card.definition.name,
          sourceCardInstanceId: card.instanceId,
          maxCost: gainSpec.maxCost,
          cardType: gainSpec.type,
          gainSource: gainSpec.source === 'market_or_epic' ? 'market_or_epic' : 'market',
          thenDiscard: discardAfter > 0 ? discardAfter : undefined,
        },
      };
    }
  }

  if (wantsGainBandingBonusChoice(card)) {
    return {
      ...state,
      pendingGainBandingBonusPick: {
        playerId: player.id,
        sourceCardName: card.definition.name,
        sourceCardInstanceId: card.instanceId,
      },
    };
  }

  return state;
}

export function beginHandDiscardIfNeeded(
  state: GameState,
  playerIdx: number,
  card: CardInstance,
  skipIfGainPending = true
): GameState {
  if (skipIfGainPending && state.pendingGainCardPick) return state;

  const discardCount = (getRawEffects(card).discard_cards as number) ?? 0;
  const forceOpponentDiscard =
    (getRawEffects(card).force_opponent_discard as number) ?? 0;
  const player = state.players[playerIdx];
  if (discardCount <= 0 || forceOpponentDiscard > 0 || player.hand.length === 0) {
    return state;
  }

  return {
    ...state,
    pendingHandDiscard: {
      playerId: player.id,
      remaining: discardCount,
      sourceCardName: card.definition.name,
    },
  };
}

export function gainMarketCardToPlayer(
  state: GameState,
  playerIdx: number,
  cardInstanceId: string,
  isGalleryAvailable: GalleryAvailableFn
): { state: GameState; gained: CardInstance | null } {
  const galleryIdx = state.galleryCards.findIndex(
    (c) => c.instanceId === cardInstanceId
  );
  const epicIdx = state.epicCards.findIndex((c) => c.instanceId === cardInstanceId);

  let gained: CardInstance | null = null;
  let next = state;

  if (galleryIdx !== -1) {
    if (!isGalleryAvailable(state, cardInstanceId)) {
      return { state, gained: null };
    }
    const card = state.galleryCards[galleryIdx];
    if (isGalleryEventCard(card)) return { state, gained: null };
    gained = {
      ...card,
      location: 'DISCARD',
      ownerId: state.players[playerIdx].id,
    };
    next = {
      ...next,
      galleryPurchasedBy: {
        ...(next.galleryPurchasedBy ?? {}),
        [gained.instanceId]: state.players[playerIdx].id,
      },
    };
  } else if (epicIdx !== -1) {
    gained = {
      ...state.epicCards[epicIdx],
      location: 'DISCARD',
      ownerId: state.players[playerIdx].id,
    };
    const newEpic = [...next.epicCards];
    newEpic.splice(epicIdx, 1);
    next = { ...next, epicCards: newEpic };
  }

  if (!gained) return { state, gained: null };

  const player = { ...next.players[playerIdx] };
  player.discard = [...player.discard, gained];
  next.players = [...next.players];
  next.players[playerIdx] = player;
  return { state: next, gained };
}

export function gainDestroyedCardToPlayer(
  state: GameState,
  playerIdx: number,
  cardInstanceId: string,
  maxCost?: number
): { state: GameState; gained: CardInstance | null } {
  const pile = state.destroyedPile ?? [];
  const idx = pile.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx === -1) return { state, gained: null };

  const card = pile[idx];
  if ((card.definition.cost ?? 0) > (maxCost ?? Infinity)) {
    return { state, gained: null };
  }

  const gained: CardInstance = {
    ...card,
    location: 'DISCARD',
    ownerId: state.players[playerIdx].id,
  };
  const player = {
    ...state.players[playerIdx],
    discard: [...state.players[playerIdx].discard, gained],
  };
  const players = [...state.players];
  players[playerIdx] = player;
  return {
    state: {
      ...state,
      players,
      destroyedPile: pile.filter((_, i) => i !== idx),
    },
    gained,
  };
}

export function placeDestroyedCardOnMarketSupply(
  state: GameState,
  cardInstanceId: string
): { state: GameState; placed: CardInstance | null } {
  const pile = state.destroyedPile ?? [];
  const idx = pile.findIndex((c) => c.instanceId === cardInstanceId);
  if (idx === -1) return { state, placed: null };

  const card = pile[idx];
  const placed: CardInstance = {
    ...card,
    location: 'GALLERY',
    faceUp: false,
  };
  return {
    state: {
      ...state,
      destroyedPile: pile.filter((_, i) => i !== idx),
      gallerySupply: [...(state.gallerySupply ?? []), placed],
    },
    placed,
  };
}

export function finishGainCardPick(
  state: GameState,
  playerIdx: number,
  pending: NonNullable<GameState['pendingGainCardPick']>
): GameState {
  let next: GameState = { ...state, pendingGainCardPick: null };
  const thenDiscard = pending.thenDiscard ?? 0;
  if (thenDiscard > 0 && next.players[playerIdx].hand.length > 0) {
    next = {
      ...next,
      pendingHandDiscard: {
        playerId: next.players[playerIdx].id,
        remaining: thenDiscard,
        sourceCardName: pending.sourceCardName,
      },
    };
  }
  return next;
}

export function reorderDeckKeepTop(
  player: PlayerState,
  viewed: CardInstance[],
  keepInstanceId: string
): PlayerState {
  const keepIdx = viewed.findIndex((c) => c.instanceId === keepInstanceId);
  if (keepIdx === -1) return player;

  const kept = viewed[keepIdx];
  const others = viewed.filter((_, i) => i !== keepIdx);
  const rest = player.deck.slice(viewed.length);
  return {
    ...player,
    deck: [kept, ...rest, ...others],
  };
}

export function galleryDestroyRefillImmediate(card: CardInstance): boolean {
  return !shouldDeferGalleryRefill(card);
}

export function peekPlayerDeckTop(
  player: PlayerState,
  count: number
): CardInstance[] {
  return player.deck.slice(0, Math.min(count, player.deck.length));
}
