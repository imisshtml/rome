import { CardInstance } from '../types/cardTypes';

/** AI (or auto) pick — highest cost, random among ties. */
export function pickForcedDiscardCard(hand: CardInstance[]): CardInstance | null {
  if (hand.length === 0) return null;
  const maxCost = Math.max(...hand.map((c) => c.definition.cost ?? 0));
  const tied = hand.filter((c) => (c.definition.cost ?? 0) === maxCost);
  return tied[Math.floor(Math.random() * tied.length)];
}
