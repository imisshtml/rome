import { PlayerState } from '../types/gameTypes';
import { CardInstance } from '../types/cardTypes';

export const MAX_COUNTED_VALOR_CARDS = 3;

function sumTopValorCards(cards: CardInstance[], limit: number): number {
  if (cards.length === 0 || limit <= 0) return 0;
  const sorted = [...cards].sort(
    (a, b) => (b.definition?.valor ?? 0) - (a.definition?.valor ?? 0)
  );
  return sorted
    .slice(0, limit)
    .reduce((sum, c) => sum + (c.definition?.valor ?? 0), 0);
}

/** Sum top printed valor cards in play (+ items), plus bonus valor this turn. */
export function getValorInPlay(
  player: PlayerState,
  turnValorBonus = 0
): number {
  const inPlay = [...player.playArea, ...player.itemsInPlay];
  const topValor = sumTopValorCards(inPlay, MAX_COUNTED_VALOR_CARDS);
  return topValor + turnValorBonus;
}

export function getTopValorFromCards(
  cards: CardInstance[],
  limit = MAX_COUNTED_VALOR_CARDS
): number {
  return sumTopValorCards(cards, limit);
}
