import type { CardDefinition, CardInstance } from '../types/cardTypes';
import type { GameState, PlayerState } from '../types/gameTypes';
import { isGalleryEventCard } from './CardCatalog';

export const GALLERY_ROW_SIZE = 6;

type DrawCardsFn = (player: PlayerState, count: number) => PlayerState;
type GainFlavorFn = (
  state: GameState,
  player: PlayerState
) => { state: GameState; player: PlayerState };

function getEventLegacy(
  definition: CardDefinition
): Record<string, number | boolean> {
  return definition.effectLegacy ?? {};
}

export function eventRequiresPlayerDiscards(
  event: CardInstance
): boolean {
  const legacy = getEventLegacy(event.definition);
  return (
    typeof legacy.all_players_discard === 'number' &&
    legacy.all_players_discard > 0
  );
}

export function eventIsImperialTax(event: CardInstance): boolean {
  const legacy = getEventLegacy(event.definition);
  return typeof legacy.all_players_lose_coins === 'number';
}

/** Immediate gallery event effects (not Plague discard or Imperial Tax flags). */
export function applyInstantGalleryEventEffects(
  state: GameState,
  event: CardInstance,
  drawCards: DrawCardsFn,
  gainFlavorCard: GainFlavorFn
): GameState {
  const legacy = getEventLegacy(event.definition);
  let next: GameState = { ...state };
  let players = next.players.map((p) => ({
    ...p,
    hand: [...p.hand],
    deck: [...p.deck],
    discard: [...p.discard],
  }));

  const drawAll = legacy.all_players_draw;
  if (typeof drawAll === 'number' && drawAll > 0) {
    players = players.map((p) => drawCards(p, drawAll));
  }

  const gainCoins = legacy.all_players_gain_coins;
  if (typeof gainCoins === 'number' && gainCoins > 0) {
    players = players.map((p) => ({
      ...p,
      carryCoins: (p.carryCoins ?? 0) + gainCoins,
    }));
  }

  const gainVp = legacy.all_players_gain_vp;
  if (typeof gainVp === 'number' && gainVp > 0) {
    players = players.map((p) => ({
      ...p,
      victoryPoints: p.victoryPoints + gainVp,
    }));
  }

  const gainFavor = legacy.all_players_gain_favor;
  if (typeof gainFavor === 'number' && gainFavor > 0) {
    for (let i = 0; i < players.length; i++) {
      for (let f = 0; f < gainFavor; f++) {
        const gained = gainFlavorCard(next, players[i]);
        next = gained.state;
        players[i] = gained.player;
      }
    }
  }

  if (legacy.reveal_top_card && typeof legacy.draw_if_cost_gte === 'number') {
    const threshold = legacy.draw_if_cost_gte;
    players = players.map((p) => {
      if (p.deck.length === 0) return p;
      const top = p.deck[0];
      if (top.definition.cost >= threshold) {
        return drawCards(p, 1);
      }
      return p;
    });
  }

  if (typeof legacy.temporary_max_purchase_cost === 'number') {
    next = { ...next, purchaseCostCap: legacy.temporary_max_purchase_cost };
  }

  next = { ...next, players };

  if (legacy.destroy_lowest_gallery_card) {
    next = destroyLowestGalleryCards(next);
  }

  return next;
}

/** Remove all gallery cards at the lowest cost (ties included). */
export function destroyLowestGalleryCards(state: GameState): GameState {
  const galleryCards = state.galleryCards ?? [];
  if (galleryCards.length === 0) return state;

  const lowestCost = Math.min(...galleryCards.map((c) => c.definition.cost));
  const remaining = galleryCards.filter((c) => c.definition.cost !== lowestCost);
  const removedIds = new Set(
    galleryCards
      .filter((c) => c.definition.cost === lowestCost)
      .map((c) => c.instanceId)
  );

  const galleryPurchasedBy = { ...(state.galleryPurchasedBy ?? {}) };
  for (const id of removedIds) {
    delete galleryPurchasedBy[id];
  }

  return {
    ...state,
    galleryCards: remaining,
    galleryPurchasedBy,
  };
}

/** Flip an event from supply — apply instant effects or queue player discards. */
export function beginGalleryEventResolution(
  state: GameState,
  event: CardInstance,
  drawCards: DrawCardsFn,
  gainFlavorCard: GainFlavorFn
): GameState {
  let next: GameState = { ...state, pendingGalleryEvent: event };

  if (eventRequiresPlayerDiscards(event)) {
    const pendingEventDiscards = next.players
      .filter((p) => p.hand.length > 0)
      .map((p) => p.id);
    if (pendingEventDiscards.length === 0) {
      return { ...next, pendingGalleryEvent: null };
    }
    return { ...next, pendingEventDiscards };
  }

  if (eventIsImperialTax(event)) {
    next = {
      ...next,
      players: next.players.map((p) => ({
        ...p,
        imperialTaxPending: true,
      })),
    };
    return next;
  }

  return applyInstantGalleryEventEffects(next, event, drawCards, gainFlavorCard);
}

/** Draw the next supply card into gallery, or return a flipped event. */
export function drawGallerySupplyCard(state: GameState): {
  state: GameState;
  flippedEvent: CardInstance | null;
} {
  const supply = [...(state.gallerySupply ?? [])];
  if (supply.length === 0) {
    return { state, flippedEvent: null };
  }

  const drawn = supply.shift()!;
  const next = { ...state, gallerySupply: supply };

  if (isGalleryEventCard(drawn)) {
    return {
      state: next,
      flippedEvent: { ...drawn, faceUp: true },
    };
  }

  return {
    state: {
      ...next,
      galleryCards: [
        ...next.galleryCards,
        { ...drawn, location: 'GALLERY' as const, faceUp: true },
      ],
    },
    flippedEvent: null,
  };
}

export function galleryRefillPaused(state: GameState): boolean {
  return (
    state.pendingGalleryEvent != null ||
    (state.pendingEventDiscards?.length ?? 0) > 0
  );
}
