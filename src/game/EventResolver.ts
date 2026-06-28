import type { CardDefinition, CardInstance } from '../types/cardTypes';
import type {
  EventHandChoiceKind,
  GameState,
  PendingEventHandChoice,
  PendingEventItemChoice,
  PlayerState,
  GalleryEventPlayerOutcome,
  GalleryEventDecreeOutcome,
} from '../types/gameTypes';
import { addToDestroyedPile } from '../utils/destroyedPileUtils';
import { refillPlayerDeckFromDiscard } from '../utils/deckCycleUtils';
import { isCharityCard } from '../utils/cardFactionUtils';
import { isGratiaCard } from '../utils/effectFlowUtils';
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

export function getEventHandChoiceSpec(
  event: CardInstance
): { count: number; kind: EventHandChoiceKind } | null {
  const legacy = getEventLegacy(event.definition);
  if (
    typeof legacy.all_players_discard === 'number' &&
    legacy.all_players_discard > 0
  ) {
    return { count: legacy.all_players_discard, kind: 'discard' };
  }
  if (
    typeof legacy.all_players_destroy_from_hand === 'number' &&
    legacy.all_players_destroy_from_hand > 0
  ) {
    return { count: legacy.all_players_destroy_from_hand, kind: 'destroy' };
  }
  if (
    typeof legacy.all_players_destroy_charity_or_gratia === 'number' &&
    legacy.all_players_destroy_charity_or_gratia > 0
  ) {
    return {
      count: legacy.all_players_destroy_charity_or_gratia,
      kind: 'destroy_charity_or_gratia',
    };
  }
  return null;
}

export function getPendingEventHandChoicePlayerIds(
  state: GameState
): string[] {
  return (state.pendingEventHandChoices ?? [])
    .filter((choice) => choice.remaining > 0)
    .map((choice) => choice.playerId);
}

export function getPendingEventItemChoicePlayerIds(state: GameState): string[] {
  return (state.pendingEventItemChoices ?? []).map((choice) => choice.playerId);
}

export function getPendingEventHandChoiceForPlayer(
  state: GameState,
  playerId: string
): PendingEventHandChoice | null {
  return (
    (state.pendingEventHandChoices ?? []).find(
      (choice) => choice.playerId === playerId && choice.remaining > 0
    ) ?? null
  );
}

export function handCardValidForEventChoice(
  card: CardInstance,
  kind: EventHandChoiceKind
): boolean {
  if (kind === 'destroy_charity_or_gratia') {
    return isCharityCard(card) || isGratiaCard(card);
  }
  return true;
}

export function playerHasValidEventHandChoice(
  player: PlayerState,
  kind: EventHandChoiceKind
): boolean {
  return player.hand.some((card) => handCardValidForEventChoice(card, kind));
}

function shuffleSupply(cards: CardInstance[]): CardInstance[] {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function returnItemsToGallerySupply(
  state: GameState,
  items: CardInstance[]
): GameState {
  if (items.length === 0) return state;
  const returned = items.map((item) => ({
    ...item,
    location: 'GALLERY' as const,
    faceUp: false,
  }));
  return {
    ...state,
    gallerySupply: shuffleSupply([...(state.gallerySupply ?? []), ...returned]),
  };
}

function applyAutomaticRequisitionLosses(
  state: GameState
): {
  state: GameState;
  pendingItemChoices: PendingEventItemChoice[];
  returnedItems: CardInstance[];
} {
  let next = state;
  const pendingItemChoices: PendingEventItemChoice[] = [];
  const returnedItems: CardInstance[] = [];
  const players = next.players.map((player) => {
    const items = [...player.itemsInPlay];
    if (items.length === 0) {
      return player;
    }
    if (items.length === 1) {
      returnedItems.push({ ...items[0], ownerId: player.id });
      return { ...player, itemsInPlay: [] };
    }
    pendingItemChoices.push({ playerId: player.id });
    return player;
  });

  next = { ...next, players };
  if (returnedItems.length > 0) {
    next = returnItemsToGallerySupply(next, returnedItems);
  }
  return { state: next, pendingItemChoices, returnedItems };
}

export function eventRequiresPlayerHandChoice(event: CardInstance): boolean {
  return getEventHandChoiceSpec(event) != null;
}

export function eventHandChoiceDestroys(event: CardInstance): boolean {
  const spec = getEventHandChoiceSpec(event);
  return spec?.kind === 'destroy' || spec?.kind === 'destroy_charity_or_gratia';
}

export function eventRequiresItemChoice(event: CardInstance): boolean {
  const legacy = getEventLegacy(event.definition);
  return (
    typeof legacy.all_players_lose_item === 'number' &&
    legacy.all_players_lose_item > 0
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

function isTriumphEligibleSupplyCard(card: CardInstance): boolean {
  if (isGalleryEventCard(card)) return false;
  const type = card.definition.type;
  if (type === 'Item') return true;
  if (type === 'Gladiator' || type === 'Action') return true;
  if (type === 'Basic' && card.definition.faction !== 'Favor') return true;
  return false;
}

function drawFactionOrItemFromGallerySupply(
  state: GameState
): { state: GameState; card: CardInstance | null } {
  let next = state;
  let supply = [...(next.gallerySupply ?? [])];
  if (supply.length === 0) return { state, card: null };

  const maxAttempts = supply.length * 3 + 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (supply.length === 0) {
      return { state: { ...next, gallerySupply: supply }, card: null };
    }
    const idx = Math.floor(Math.random() * supply.length);
    const [drawn] = supply.splice(idx, 1);
    next = { ...next, gallerySupply: supply };
    if (isTriumphEligibleSupplyCard(drawn)) {
      return { state: next, card: drawn };
    }
    supply = [...supply, drawn];
    next = { ...next, gallerySupply: supply };
  }
  return { state: next, card: null };
}

function applyTriumphOfRome(
  state: GameState,
  createCard: CreateCardFn
): { state: GameState; outcomes: GalleryEventPlayerOutcome[] } {
  let next = state;
  const outcomes: GalleryEventPlayerOutcome[] = [];
  let players = next.players.map((p) => ({
    ...p,
    hand: [...p.hand],
    discard: [...p.discard],
  }));

  for (let i = 0; i < players.length; i++) {
    const drawn = drawFactionOrItemFromGallerySupply(next);
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
    outcomes.push({
      playerId: players[i].id,
      playerName: players[i].name,
      cardName: gained.definition?.name ?? 'Card',
      definitionId: gained.definitionId,
      cardInstanceId: gained.instanceId,
      cost,
      gratiaCount: cost,
    });
  }

  return {
    state: { ...next, players, galleryEventOutcomes: outcomes },
    outcomes,
  };
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
  const decreeOutcomes: GalleryEventDecreeOutcome[] = [];
  const favorReturns: CardInstance[] = [];

  const players = state.players.map((p) => {
    let deck = [...p.deck];
    let hand = [...p.hand];
    let discard = [...p.discard];

    for (let i = 0; i < revealCount; i++) {
      if (deck.length === 0) {
        const refilled = refillPlayerDeckFromDiscard({ deck, discard });
        favorReturns.push(...refilled.favorReturns);
        deck = [...refilled.player.deck];
        discard = [...refilled.player.discard];
      }
      if (deck.length === 0) break;

      const revealed = deck.shift()!;
      const cost = revealed.definition?.cost ?? 0;
      const cardName = revealed.definition?.name ?? 'Card';
      if (cost >= drawThreshold) {
        hand.push({
          ...revealed,
          location: 'HAND',
          faceUp: true,
          ownerId: p.id,
        });
        decreeOutcomes.push({
          playerId: p.id,
          playerName: p.name,
          cardName,
          cost,
          result: 'drawn',
        });
      } else if (cost <= destroyThreshold) {
        destroyedCards.push({ ...revealed, ownerId: p.id });
        decreeOutcomes.push({
          playerId: p.id,
          playerName: p.name,
          cardName,
          cost,
          result: 'destroyed',
        });
      } else {
        deck.unshift(revealed);
        decreeOutcomes.push({
          playerId: p.id,
          playerName: p.name,
          cardName,
          cost,
          result: 'kept',
        });
      }
    }
    return { ...p, deck, hand, discard };
  });

  return {
    ...addToDestroyedPile(
      {
        ...state,
        players,
        flavorDeck:
          favorReturns.length > 0
            ? [...state.flavorDeck, ...favorReturns]
            : state.flavorDeck,
      },
      destroyedCards
    ),
    galleryEventDecreeOutcomes: decreeOutcomes,
  };
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
      next = { ...next, players };
    } else {
      next = { ...next, players };
      for (const p of next.players) {
        next = applyPlayerCoinDelta(next, p.id, gainCoins);
      }
    }
  }

  const loseCoins = legacy.all_players_lose_coins;
  if (typeof loseCoins === 'number' && loseCoins > 0 && legacy.next_turn) {
    players = players.map((p) => ({
      ...p,
      carryCoins: (p.carryCoins ?? 0) - loseCoins,
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

  if (
    typeof legacy.reveal_top_cards === 'number' ||
    (legacy.reveal_top_card && typeof legacy.draw_if_cost_gte === 'number')
  ) {
    next = applySenateDecreeFromLegacy(next, legacy);
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
    next = applyTriumphOfRome(next, createCard).state;
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

  return {
    ...addToDestroyedPile(
      {
        ...state,
        galleryCards: remaining,
        galleryPurchasedBy,
      },
      removed
    ),
    lastEventGalleryDestroyNames: removed.map((c) => c.definition.name),
  };
}

/** Gallery events / end-of-turn refill — bank on the player for a future turn. */
export function eventCoinFlowActive(state: GameState): boolean {
  return (
    state.pendingGalleryEvent != null ||
    (state.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0 ||
    getPendingEventHandChoicePlayerIds(state).length > 0 ||
    getPendingEventItemChoicePlayerIds(state).length > 0 ||
    state.deferredTurnEnd != null ||
    state.phase === 'CLEANUP'
  );
}

export function applyPlayerCoinDelta(
  state: GameState,
  playerId: string,
  delta: number
): GameState {
  const amount = Number(delta);
  if (!Number.isFinite(amount) || amount === 0) return state;

  const bankForLaterTurn =
    eventCoinFlowActive(state) || playerId !== state.turnPlayerId;

  if (!bankForLaterTurn) {
    return {
      ...state,
      turnCoins: Math.max(0, state.turnCoins + amount),
    };
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

export function awardOptionalEventDiscardCoins(
  state: GameState,
  playerId: string,
  amount: number
): GameState {
  return applyPlayerCoinDelta(state, playerId, amount);
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
    const legacy = getEventLegacy(event.definition);
    const coinReward =
      typeof legacy.optional_discard_for_coins === 'number'
        ? legacy.optional_discard_for_coins
        : 2;
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

  if (eventRequiresItemChoice(event)) {
    const applied = applyAutomaticRequisitionLosses(next);
    next = applied.state;
    if (applied.pendingItemChoices.length === 0) {
      return next;
    }
    return {
      ...next,
      pendingEventItemChoices: applied.pendingItemChoices,
    };
  }

  if (eventRequiresPlayerHandChoice(event)) {
    const spec = getEventHandChoiceSpec(event);
    if (!spec) {
      return { ...next, pendingGalleryEvent: null };
    }
    const pendingEventHandChoices = next.players
      .filter((p) => playerHasValidEventHandChoice(p, spec.kind))
      .map((p) => ({
        playerId: p.id,
        remaining: spec.count,
        kind: spec.kind,
      }));
    if (pendingEventHandChoices.length === 0) {
      return { ...next, pendingGalleryEvent: null };
    }
    return { ...next, pendingEventHandChoices };
  }

  if (eventIsImperialTax(event)) {
    const legacy = getEventLegacy(event.definition);
    const loseCoins =
      typeof legacy.all_players_lose_coins === 'number'
        ? legacy.all_players_lose_coins
        : 1;
    next = {
      ...next,
      players: next.players.map((p) => ({
        ...p,
        carryCoins: (p.carryCoins ?? 0) - loseCoins,
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

type GalleryRefillDeps = {
  drawCards: DrawCardsFn;
  gainFlavorCard: GainFlavorFn;
  createCard: CreateCardFn;
};

/** Remove event cards incorrectly sitting in the market row and resolve them. */
export function ejectStrayGalleryEvents(
  state: GameState,
  deps: GalleryRefillDeps
): GameState {
  const stray = (state.galleryCards ?? []).filter((c) => isGalleryEventCard(c));
  if (stray.length === 0) return state;

  let next: GameState = {
    ...state,
    galleryCards: state.galleryCards.filter((c) => !isGalleryEventCard(c)),
  };

  for (const event of stray) {
    next = beginGalleryEventResolution(
      next,
      { ...event, faceUp: true },
      deps.drawCards,
      deps.gainFlavorCard,
      deps.createCard
    );
    if (galleryRefillPaused(next)) break;
  }

  return next;
}

/** Draw from gallery supply into the market row, resolving flipped events. */
export function fillGalleryRowFromSupply(
  state: GameState,
  maxDraws: number,
  deps: GalleryRefillDeps
): GameState {
  let next = state;
  let draws = 0;

  while (
    draws < maxDraws &&
    next.galleryCards.length < GALLERY_ROW_SIZE &&
    (next.gallerySupply?.length ?? 0) > 0
  ) {
    if (galleryRefillPaused(next)) break;

    const { state: afterDraw, flippedEvent } = drawGallerySupplyCard(next);
    next = afterDraw;
    draws += 1;

    if (flippedEvent) {
      next = beginGalleryEventResolution(
        next,
        flippedEvent,
        deps.drawCards,
        deps.gainFlavorCard,
        deps.createCard
      );
      if (galleryRefillPaused(next)) break;
    }
  }

  return next;
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
    getPendingEventHandChoicePlayerIds(state).length > 0 ||
    getPendingEventItemChoicePlayerIds(state).length > 0 ||
    (state.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0
  );
}

export function clearPendingGalleryEventFlow(state: GameState): GameState {
  return {
    ...state,
    pendingGalleryEvent: null,
    pendingEventHandChoices: [],
    pendingEventDiscards: [],
    pendingEventItemChoices: [],
    pendingEventOptionalDiscards: null,
    galleryEventOutcomes: null,
  };
}

export function finishEventItemLossPick(
  state: GameState,
  playerIdx: number,
  itemInstanceId: string
): GameState {
  const player = state.players[playerIdx];
  const itemIdx = player.itemsInPlay.findIndex(
    (c) => c.instanceId === itemInstanceId
  );
  if (itemIdx === -1) return state;

  const removed = player.itemsInPlay[itemIdx];
  const players = [...state.players];
  players[playerIdx] = {
    ...player,
    itemsInPlay: player.itemsInPlay.filter((_, i) => i !== itemIdx),
  };

  let next = returnItemsToGallerySupply(state, [{ ...removed, ownerId: player.id }]);
  next = {
    ...next,
    players,
    pendingEventItemChoices: (next.pendingEventItemChoices ?? []).filter(
      (choice) => choice.playerId !== player.id
    ),
  };
  return next;
}
