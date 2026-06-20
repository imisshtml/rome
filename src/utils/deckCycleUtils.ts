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
