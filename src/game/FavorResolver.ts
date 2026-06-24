import type { CardInstance, CardLocation } from '../types/cardTypes';
import type { GameState } from '../types/gameTypes';
import { galleryRefillPaused } from './EventResolver';

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
    state.pendingFavorDestroyPick != null
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
  card: CardInstance
): GameState {
  const next: GameState = {
    ...state,
    pendingFavorReveal: null,
    pendingFavorDestroyPick: null,
    flavorDeck: [...state.flavorDeck, returnFavorCardToSupply(card)],
  };
  return processFavorQueue(next);
}

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
