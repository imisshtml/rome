import type { CardInstance } from '../types/cardTypes';
import type { GameState } from '../types/gameTypes';

export function getTurnEpicDiscount(state: GameState): number {
  return state.turnEpicDiscount ?? 0;
}

export function getTurnFactionDiscount(state: GameState): number {
  return state.turnFactionDiscount ?? 0;
}

export function isEpicMarketCard(card: CardInstance): boolean {
  return card.definition.type === 'Epic' || card.location === 'EPIC_ROW';
}

export function isFactionMarketCard(card: CardInstance): boolean {
  const type = card.definition.type;
  if (type === 'Gladiator' || type === 'Action') return true;
  if (type === 'Basic' && card.definition.faction !== 'Favor') return true;
  return false;
}

export function getEffectivePurchaseCost(
  state: GameState,
  card: CardInstance
): number {
  const base = card.definition.cost ?? 0;
  if (isEpicMarketCard(card)) {
    return Math.max(0, base - getTurnEpicDiscount(state));
  }
  if (isFactionMarketCard(card)) {
    return Math.max(0, base - getTurnFactionDiscount(state));
  }
  return base;
}

export function canAffordPurchase(state: GameState, card: CardInstance): boolean {
  return state.turnCoins >= getEffectivePurchaseCost(state, card);
}
