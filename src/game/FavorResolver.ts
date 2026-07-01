import type { CardInstance, CardLocation } from '../types/cardTypes';
import type { GameState } from '../types/gameTypes';
import { galleryRefillPaused } from './EventResolver';
import {
  beneficiaryHasArenaWagerTargets,
  favorIsArenaWager,
} from '../utils/arenaWagerUtils';

export const FAVOR_DISPLAY_MS = 5000;

export type FavorRevealEntry = {
  card: CardInstance;
  playerId: string;
};

export type PendingFavorDestroyPick = {
  playerId: string;
  remaining: number;
  fromZones: ('hand' | 'discard' | 'play_area')[];
  sourceCardName?: string;
};

export function returnFavorCardToSupply(card: CardInstance): CardInstance {
  return {
    ...card,
    location: 'FLAVOR_DECK',
    ownerId: 'market',
    faceUp: false,
    chosenFaction: undefined,
  };
}

export function returnFavorCardToDiscard(card: CardInstance): CardInstance {
  return {
    ...card,
    location: 'FLAVOR_DISCARD' as CardLocation,
    ownerId: 'market',
    faceUp: true,
    chosenFaction: undefined,
  };
}

export function favorIsOptional(card: CardInstance): boolean {
  const effects = card.definition.effects as { optional?: boolean } | undefined;
  return effects?.optional === true;
}

export function favorNeedsDestroyPick(card: CardInstance): boolean {
  const effects = card.definition.effects;
  return (
    (effects?.destroy_cards ?? 0) > 0 &&
    (effects?.destroy_from?.length ?? 0) > 0
  );
}

export function favorDestroyFromZones(card: CardInstance): PendingFavorDestroyPick['fromZones'] {
  const raw = card.definition.effects?.destroy_from ?? [];
  const zones: PendingFavorDestroyPick['fromZones'] = [];
  for (const zone of raw) {
    if (zone === 'hand' || zone === 'discard' || zone === 'play_area') {
      zones.push(zone);
    }
  }
  return zones;
}

export function shouldDeferFavorReveal(state: GameState): boolean {
  return galleryRefillPaused(state);
}

export function favorResolutionPaused(state: GameState): boolean {
  return (
    state.pendingFavorReveal != null ||
    state.pendingFavorDestroyPick != null ||
    state.pendingFavorArenaWagerPick != null
  );
}

export function beginFavorResolution(
  state: GameState,
  card: CardInstance,
  playerId: string
): GameState {
  const entry: FavorRevealEntry = {
    card: { ...card, faceUp: true },
    playerId,
  };

  if (shouldDeferFavorReveal(state) || state.pendingFavorReveal) {
    return {
      ...state,
      pendingFavorQueue: [...(state.pendingFavorQueue ?? []), entry],
    };
  }

  return { ...state, pendingFavorReveal: entry };
}

export function processFavorQueue(state: GameState): GameState {
  if (state.pendingFavorReveal || shouldDeferFavorReveal(state)) {
    return state;
  }
  const queue = state.pendingFavorQueue ?? [];
  if (queue.length === 0) return state;
  const [head, ...rest] = queue;
  return {
    ...state,
    pendingFavorReveal: head,
    pendingFavorQueue: rest,
  };
}

export function finishFavorResolution(
  state: GameState,
  card: CardInstance,
  options?: { removeFromGame?: boolean }
): GameState {
  const removeFromGame =
    options?.removeFromGame === true ||
    state.pendingFavorReplayRemovalId === card.instanceId;

  const next: GameState = {
    ...state,
    pendingFavorReveal: null,
    pendingFavorDestroyPick: null,
    pendingFavorArenaWagerPick: null,
    pendingFavorReplayRemovalId: removeFromGame
      ? null
      : state.pendingFavorReplayRemovalId ?? null,
  };

  if (removeFromGame) {
    return processFavorQueue(next);
  }

  return processFavorQueue({
    ...next,
    flavorDiscard: [
      ...(next.flavorDiscard ?? []),
      returnFavorCardToDiscard(card),
    ],
  });
}

export function beginFavorArenaWagerPick(
  state: GameState,
  card: CardInstance,
  beneficiaryId: string
): GameState {
  const beneficiary = state.players.find((p) => p.id === beneficiaryId);
  if (!beneficiary || !beneficiaryHasArenaWagerTargets(beneficiary)) {
    return finishFavorResolution(state, card);
  }

  return {
    ...state,
    pendingFavorArenaWagerPick: {
      beneficiaryId,
      sourceCardName: card.definition.name,
    },
  };
}

export { favorIsArenaWager };

export function playerHasFavorDestroyTargets(
  state: GameState,
  playerId: string,
  fromZones: PendingFavorDestroyPick['fromZones']
): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  if (fromZones.includes('hand') && player.hand.length > 0) return true;
  if (fromZones.includes('discard') && player.discard.length > 0) return true;
  if (fromZones.includes('play_area') && player.playArea.length > 0) return true;
  return false;
}

export function beginFavorDestroyPick(
  state: GameState,
  card: CardInstance,
  playerId: string
): GameState {
  const fromZones = favorDestroyFromZones(card);
  const remaining = card.definition.effects?.destroy_cards ?? 1;
  if (
    remaining <= 0 ||
    fromZones.length === 0 ||
    !playerHasFavorDestroyTargets(state, playerId, fromZones)
  ) {
    return finishFavorResolution(state, card);
  }

  return {
    ...state,
    pendingFavorDestroyPick: {
      playerId,
      remaining,
      fromZones,
      sourceCardName: card.definition.name,
    },
  };
}

export function resolveFavorDestroyZone(
  zone: 'hand' | 'discard' | 'play_area'
): CardLocation {
  if (zone === 'hand') return 'HAND';
  if (zone === 'discard') return 'DISCARD';
  return 'PLAY_AREA';
}
