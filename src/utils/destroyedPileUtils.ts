import { CardInstance } from '../types/cardTypes';
import { GameState } from '../types/gameTypes';

export function toDestroyedCard(card: CardInstance): CardInstance {
  return {
    ...card,
    location: 'DESTROYED',
    faceUp: true,
    ownerId: 'market',
  };
}

export function addToDestroyedPile(
  state: GameState,
  cards: CardInstance[]
): GameState {
  if (cards.length === 0) return state;
  return {
    ...state,
    destroyedPile: [
      ...(state.destroyedPile ?? []),
      ...cards.map(toDestroyedCard),
    ],
  };
}
