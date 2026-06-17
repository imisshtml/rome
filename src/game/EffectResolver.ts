import type { CardEffects, CardInstance } from '../types';
import type { GameState, PlayerState } from '../types/gameTypes';

type DrawCardsFn = (player: PlayerState, count: number) => PlayerState;

/** Applies immediate on-play effects. Choice/interaction effects are not resolved here yet. */
export function applyStructuredPlayEffects(
  state: GameState,
  playerIdx: number,
  card: CardInstance,
  effects: CardEffects,
  drawCards: DrawCardsFn
): GameState {
  const baseValor = card.definition.valor ?? 0;
  let next: GameState = {
    ...state,
    turnCoins: state.turnCoins + effects.gain_coins,
    turnValor: state.turnValor + baseValor + effects.gain_valor,
  };

  let player: PlayerState = { ...next.players[playerIdx] };
  let playerChanged = false;

  if (effects.gain_vp) {
    player.victoryPoints += effects.gain_vp;
    playerChanged = true;
  }
  if (effects.draw_cards) {
    player = drawCards(player, effects.draw_cards);
    playerChanged = true;
  }

  if (playerChanged) {
    next = { ...next, players: [...next.players] };
    next.players[playerIdx] = player;
  }

  return next;
}

export function getLegacyCoinGain(card: CardInstance): number {
  if (card.definition.type === 'Favor' || card.definition.faction === 'Favor') {
    return 1;
  }
  return 0;
}
