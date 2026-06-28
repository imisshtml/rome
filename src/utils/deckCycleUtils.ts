import { CardInstance } from '../types/cardTypes';
import {
  isFavorDefinitionId,
  isNonDeckablePlayerCard,
} from '../game/CardCatalog';

/** Cards that belong in a player's deck/discard cycle (not Favor, Event, etc.). */
export function isPersistentPlayerDeckCard(card: CardInstance): boolean {
  return !isNonDeckablePlayerCard(card);
}

function isFavorCard(card: CardInstance): boolean {
  return (
    card.definition?.type === 'Favor' ||
    card.definition?.faction === 'Favor' ||
    isFavorDefinitionId(card)
  );
}

export function splitPlayerDeckCycleCards(cards: CardInstance[]): {
  deckable: CardInstance[];
  favorReturns: CardInstance[];
} {
  const deckable: CardInstance[] = [];
  const favorReturns: CardInstance[] = [];

  for (const card of cards) {
    if (isFavorCard(card)) {
      favorReturns.push({
        ...card,
        location: 'FLAVOR_DECK',
        faceUp: false,
        ownerId: 'market',
        chosenFaction: undefined,
      });
    } else if (isPersistentPlayerDeckCard(card)) {
      deckable.push(card);
    }
  }

  return { deckable, favorReturns };
}

function shuffleDeckCycleCards(cards: CardInstance[]): CardInstance[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.map((c) => ({
    ...c,
    location: 'DECK' as const,
    faceUp: false,
    chosenFaction: undefined,
  }));
}

/** When the deck is empty, shuffle discard pile into deck (same as drawing). */
export function refillPlayerDeckFromDiscard(player: {
  deck: CardInstance[];
  discard: CardInstance[];
}): {
  player: { deck: CardInstance[]; discard: CardInstance[] };
  favorReturns: CardInstance[];
} {
  if (player.deck.length > 0) {
    return { player, favorReturns: [] };
  }
  const { deckable, favorReturns } = splitPlayerDeckCycleCards(player.discard);
  if (deckable.length === 0) {
    return { player, favorReturns };
  }
  return {
    player: {
      deck: shuffleDeckCycleCards(deckable),
      discard: [],
    },
    favorReturns,
  };
}
