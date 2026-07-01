import type { CardInstance } from '../types/cardTypes';
import type { GameState, PendingCrowdFrenzyPick, PlayerState } from '../types/gameTypes';
import { isGalleryEventCard } from '../game/CardCatalog';
import { refillPlayerDeckFromDiscard } from './deckCycleUtils';
import { addToDestroyedPile } from './destroyedPileUtils';
import { getRawEffects } from './playDestroyUtils';

export type CrowdFrenzyReplacement = PendingCrowdFrenzyPick['replacements'][number];

export function listCrowdFrenzyMarketCards(
  state: GameState,
  exactCost: number,
  isGalleryAvailable: (state: GameState, instanceId: string) => boolean
): CardInstance[] {
  const results: CardInstance[] = [];

  for (const card of state.galleryCards) {
    if (!isGalleryAvailable(state, card.instanceId)) continue;
    if (isGalleryEventCard(card)) continue;
    if ((card.definition.cost ?? 0) !== exactCost) continue;
    results.push(card);
  }

  if (
    state.recruitCard &&
    isGalleryAvailable(state, state.recruitCard.instanceId) &&
    (state.recruitCard.definition.cost ?? 0) === exactCost
  ) {
    results.push(state.recruitCard);
  }

  return results;
}

export function getCurrentCrowdFrenzyReplacement(
  pending: PendingCrowdFrenzyPick
): CrowdFrenzyReplacement | null {
  return pending.replacements[pending.currentIndex] ?? null;
}

export function advanceCrowdFrenzyIndex(
  pending: PendingCrowdFrenzyPick
): PendingCrowdFrenzyPick | null {
  const nextIndex = pending.currentIndex + 1;
  if (nextIndex >= pending.replacements.length) return null;
  return { ...pending, currentIndex: nextIndex };
}

export function wantsCrowdFrenzyEffect(card: CardInstance): boolean {
  return getRawEffects(card).destroy_each_player_deck_top === true;
}

export function beginCrowdFrenzyPick(
  state: GameState,
  controllerIdx: number,
  card: CardInstance,
  isGalleryAvailable: (state: GameState, instanceId: string) => boolean
): GameState {
  if (!wantsCrowdFrenzyEffect(card)) return state;

  let next: GameState = { ...state, players: [...state.players] };
  const replacements: PendingCrowdFrenzyPick['replacements'] = [];

  for (let i = 0; i < next.players.length; i++) {
    const refilled = refillPlayerDeckFromDiscard(next.players[i]);
    let player: PlayerState = { ...next.players[i], ...refilled.player };
    if (refilled.favorReturns.length > 0) {
      next = {
        ...next,
        flavorDeck: [...next.flavorDeck, ...refilled.favorReturns],
      };
    }

    if (player.deck.length === 0) {
      next.players[i] = player;
      continue;
    }

    const destroyed: CardInstance = {
      ...player.deck[0],
      ownerId: player.id,
      faceUp: true,
    };
    player = { ...player, deck: player.deck.slice(1) };
    next = addToDestroyedPile(next, [destroyed]);
    next.players[i] = player;

    replacements.push({
      targetPlayerId: player.id,
      targetPlayerName: player.name,
      destroyedCard: destroyed,
      targetCost: destroyed.definition.cost ?? 0,
    });
  }

  if (replacements.length === 0) return next;

  let pending: PendingCrowdFrenzyPick = {
    playerId: next.players[controllerIdx].id,
    sourceCardName: card.definition.name,
    replacements,
    currentIndex: 0,
  };

  while (pending.currentIndex < pending.replacements.length) {
    const current = getCurrentCrowdFrenzyReplacement(pending);
    if (!current) break;
    const eligible = listCrowdFrenzyMarketCards(
      next,
      current.targetCost,
      isGalleryAvailable
    );
    if (eligible.length > 0) {
      return { ...next, pendingCrowdFrenzyPick: pending };
    }
    const advanced = advanceCrowdFrenzyIndex(pending);
    if (!advanced) {
      return next;
    }
    pending = advanced;
  }

  return next;
}

export function gainMarketCardToPlayerDeckTop(
  state: GameState,
  targetPlayerIdx: number,
  cardInstanceId: string,
  isGalleryAvailable: (state: GameState, instanceId: string) => boolean
): { state: GameState; gained: CardInstance | null } {
  const galleryIdx = state.galleryCards.findIndex(
    (c) => c.instanceId === cardInstanceId
  );

  let gained: CardInstance | null = null;
  let next = state;
  const targetId = state.players[targetPlayerIdx].id;

  if (galleryIdx !== -1) {
    if (!isGalleryAvailable(state, cardInstanceId)) {
      return { state, gained: null };
    }
    const card = state.galleryCards[galleryIdx];
    if (isGalleryEventCard(card)) return { state, gained: null };
    gained = {
      ...card,
      location: 'DECK',
      ownerId: targetId,
      faceUp: false,
    };
    const galleryCards = [...state.galleryCards];
    galleryCards.splice(galleryIdx, 1);
    next = {
      ...next,
      galleryCards,
      galleryPurchasedBy: {
        ...(next.galleryPurchasedBy ?? {}),
        [gained.instanceId]: targetId,
      },
    };
  } else if (state.recruitCard?.instanceId === cardInstanceId) {
    gained = {
      ...state.recruitCard,
      location: 'DECK',
      ownerId: targetId,
      faceUp: false,
    };
    const recruitDeck = [...(state.recruitDeck ?? [])];
    next = {
      ...next,
      recruitCard:
        recruitDeck.length > 0
          ? {
              ...recruitDeck.shift()!,
              location: 'RECRUIT' as const,
              faceUp: true,
            }
          : null,
      recruitDeck,
    };
  }

  if (!gained) return { state, gained: null };

  const player = { ...next.players[targetPlayerIdx] };
  player.deck = [gained, ...player.deck];
  next.players = [...next.players];
  next.players[targetPlayerIdx] = player;
  return { state: next, gained };
}

export function advanceCrowdFrenzyAfterResolve(
  state: GameState,
  isGalleryAvailable: (state: GameState, instanceId: string) => boolean
): GameState {
  const pending = state.pendingCrowdFrenzyPick;
  if (!pending) return state;

  let nextPending = advanceCrowdFrenzyIndex(pending);
  while (nextPending) {
    const current = getCurrentCrowdFrenzyReplacement(nextPending);
    if (!current) break;
    const eligible = listCrowdFrenzyMarketCards(
      state,
      current.targetCost,
      isGalleryAvailable
    );
    if (eligible.length > 0) {
      return { ...state, pendingCrowdFrenzyPick: nextPending };
    }
    const advanced = advanceCrowdFrenzyIndex(nextPending);
    if (!advanced) {
      return { ...state, pendingCrowdFrenzyPick: null };
    }
    nextPending = advanced;
  }

  return { ...state, pendingCrowdFrenzyPick: null };
}
