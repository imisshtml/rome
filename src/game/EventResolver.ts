import type { CardDefinition, CardInstance } from '../types/cardTypes';
import type { GameState, PlayerState } from '../types/gameTypes';
import { addToDestroyedPile } from '../utils/destroyedPileUtils';
import { GRATIA_SUPPLY, isGalleryEventCard } from './CardCatalog';

export const GALLERY_ROW_SIZE = 6;
export const GALLERY_EVENT_DISPLAY_MS = 5000;

const GRATIA_DEFINITION_ID = GRATIA_SUPPLY.id;

type DrawCardsFn = (player: PlayerState, count: number) => PlayerState;
type GainFlavorFn = (
  state: GameState,
  player: PlayerState
) => { state: GameState; player: PlayerState };
type CreateCardFn = (
  definitionId: string,
  location: CardInstance['location'],
  ownerId: string,
  faceUp?: boolean
) => CardInstance;

function getEventLegacy(
  definition: CardDefinition
): Record<string, number | boolean> {
  return definition.effectLegacy ?? {};
}

export function eventRequiresPlayerHandChoice(event: CardInstance): boolean {
  const legacy = getEventLegacy(event.definition);
  return (
    (typeof legacy.all_players_destroy_from_hand === 'number' &&
      legacy.all_players_destroy_from_hand > 0) ||
    (typeof legacy.all_players_discard === 'number' &&
      legacy.all_players_discard > 0)
  );
}

export function eventHandChoiceDestroys(event: CardInstance): boolean {
  const legacy = getEventLegacy(event.definition);
  return (
    typeof legacy.all_players_destroy_from_hand === 'number' &&
    legacy.all_players_destroy_from_hand > 0
  );
}

export function eventIsOptionalDiscardForCoins(event: CardInstance): boolean {
  const legacy = getEventLegacy(event.definition);
  return typeof legacy.optional_discard_for_coins === 'number';
}

export function eventIsImperialTax(event: CardInstance): boolean {
  const legacy = getEventLegacy(event.definition);
  return typeof legacy.all_players_lose_coins === 'number';
}

function drawRandomGallerySupplyCard(
  state: GameState
): { state: GameState; card: CardInstance | null } {
  const supply = [...(state.gallerySupply ?? [])];
  if (supply.length === 0) {
    return { state, card: null };
  }
  const idx = Math.floor(Math.random() * supply.length);
  const [drawn] = supply.splice(idx, 1);
  return {
    state: { ...state, gallerySupply: supply },
    card: drawn,
  };
}

function applyTriumphOfRome(
  state: GameState,
  createCard: CreateCardFn
): GameState {
  let next = state;
  let players = next.players.map((p) => ({
    ...p,
    hand: [...p.hand],
    discard: [...p.discard],
  }));

  for (let i = 0; i < players.length; i++) {
    const drawn = drawRandomGallerySupplyCard(next);
    next = drawn.state;
    if (!drawn.card) continue;

    const gained = {
      ...drawn.card,
      location: 'DISCARD' as const,
      faceUp: true,
      ownerId: players[i].id,
    };
    const cost = gained.definition?.cost ?? 0;
    const gratiaCards = Array.from({ length: cost }, () =>
      createGratiaInstance(createCard, players[i].id)
    );
    players[i] = {
      ...players[i],
      discard: [...players[i].discard, gained, ...gratiaCards],
    };
  }

  return { ...next, players };
}

function createGratiaInstance(
  createCard: CreateCardFn,
  ownerId: string
): CardInstance {
  return createCard(GRATIA_DEFINITION_ID, 'DISCARD', ownerId, true);
}

function applySenateDecreeFromLegacy(
  state: GameState,
  legacy: Record<string, number | boolean>
): GameState {
  const revealCount =
    typeof legacy.reveal_top_cards === 'number' ? legacy.reveal_top_cards : 0;
  if (revealCount <= 0) return state;

  const drawThreshold =
    typeof legacy.draw_if_cost_gte === 'number' ? legacy.draw_if_cost_gte : 5;
  const destroyThreshold =
    typeof legacy.destroy_if_cost_lte === 'number'
      ? legacy.destroy_if_cost_lte
      : 4;

  const destroyedCards: CardInstance[] = [];

  const players = state.players.map((p) => {
    let deck = [...p.deck];
    let hand = [...p.hand];
    for (let i = 0; i < revealCount && deck.length > 0; i++) {
      const revealed = deck.shift()!;
      const cost = revealed.definition?.cost ?? 0;
      if (cost >= drawThreshold) {
        hand.push({
          ...revealed,
          location: 'HAND',
          faceUp: true,
          ownerId: p.id,
        });
      } else if (cost <= destroyThreshold) {
        destroyedCards.push({ ...revealed, ownerId: p.id });
      } else {
        deck.unshift(revealed);
      }
    }
    return { ...p, deck, hand };
  });

  return addToDestroyedPile({ ...state, players }, destroyedCards);
}

/** Immediate gallery event effects (not interactive player choices). */
export function applyInstantGalleryEventEffects(
  state: GameState,
  event: CardInstance,
  drawCards: DrawCardsFn,
  gainFlavorCard: GainFlavorFn,
  createCard: CreateCardFn
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
    if (legacy.next_turn) {
      players = players.map((p) => ({
        ...p,
        carryCoins: (p.carryCoins ?? 0) + gainCoins,
      }));
    } else {
      players = players.map((p) =>
        p.id === next.turnPlayerId
          ? { ...p }
          : { ...p, carryCoins: (p.carryCoins ?? 0) + gainCoins }
      );
      if (next.turnPlayerId) {
        next = { ...next, turnCoins: next.turnCoins + gainCoins };
      }
    }
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

  if (
    typeof legacy.reveal_top_cards === 'number' ||
    (legacy.reveal_top_card && typeof legacy.draw_if_cost_gte === 'number')
  ) {
    next = applySenateDecreeFromLegacy({ ...next, players }, legacy);
    players = next.players;
  }

  if (typeof legacy.temporary_max_purchase_cost === 'number') {
    const nextPlayerId =
      state.deferredTurnEnd?.nextPlayerIdx != null
        ? (state.players[state.deferredTurnEnd.nextPlayerIdx]?.id ?? null)
        : null;
    next = {
      ...next,
      purchaseCostCap: legacy.temporary_max_purchase_cost,
      purchaseCostCapActiveForPlayerId: nextPlayerId,
    };
  }

  next = { ...next, players };

  if (legacy.destroy_lowest_gallery_card) {
    next = destroyLowestGalleryCards(next);
  }

  if (legacy.all_players_gain_random_gallery_card) {
    next = applyTriumphOfRome(next, createCard);
  }

  return next;
}

/** Remove all gallery cards at the lowest cost (ties included). */
export function destroyLowestGalleryCards(state: GameState): GameState {
  const galleryCards = state.galleryCards ?? [];
  if (galleryCards.length === 0) return state;

  const lowestCost = Math.min(...galleryCards.map((c) => c.definition.cost));
  const removed = galleryCards.filter((c) => c.definition.cost === lowestCost);
  const remaining = galleryCards.filter((c) => c.definition.cost !== lowestCost);
  const removedIds = new Set(removed.map((c) => c.instanceId));

  const galleryPurchasedBy = { ...(state.galleryPurchasedBy ?? {}) };
  for (const id of removedIds) {
    delete galleryPurchasedBy[id];
  }

  return addToDestroyedPile(
    {
      ...state,
      galleryCards: remaining,
      galleryPurchasedBy,
    },
    removed
  );
}

export function awardOptionalEventDiscardCoins(
  state: GameState,
  playerId: string,
  amount: number
): GameState {
  if (playerId === state.turnPlayerId) {
    return { ...state, turnCoins: state.turnCoins + amount };
  }
  const idx = state.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return state;
  const players = [...state.players];
  const player = players[idx];
  players[idx] = {
    ...player,
    carryCoins: (player.carryCoins ?? 0) + amount,
  };
  return { ...state, players };
}

/** Flip an event from supply — apply instant effects or queue player choices. */
export function beginGalleryEventResolution(
  state: GameState,
  event: CardInstance,
  drawCards: DrawCardsFn,
  gainFlavorCard: GainFlavorFn,
  createCard: CreateCardFn
): GameState {
  let next: GameState = { ...state, pendingGalleryEvent: event };

  if (eventIsOptionalDiscardForCoins(event)) {
    const coinReward = getEventLegacy(event.definition)
      .optional_discard_for_coins as number;
    const pendingPlayerIds = next.players
      .filter((p) => p.hand.length > 0)
      .map((p) => p.id);
    if (pendingPlayerIds.length === 0) {
      return { ...next, pendingGalleryEvent: null };
    }
    return {
      ...next,
      pendingEventOptionalDiscards: { coinReward, pendingPlayerIds },
    };
  }

  if (eventRequiresPlayerHandChoice(event)) {
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

  return applyInstantGalleryEventEffects(
    next,
    event,
    drawCards,
    gainFlavorCard,
    createCard
  );
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
    (state.pendingEventDiscards?.length ?? 0) > 0 ||
    (state.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0
  );
}

export function clearPendingGalleryEventFlow(state: GameState): GameState {
  return {
    ...state,
    pendingGalleryEvent: null,
    pendingEventDiscards: [],
    pendingEventOptionalDiscards: null,
  };
}
