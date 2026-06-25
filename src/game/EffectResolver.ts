import type { CardEffects, CardInstance } from '../types';
import type { GameState, PlayerState } from '../types/gameTypes';

type DrawCardsFn = (player: PlayerState, count: number) => PlayerState;

type ExtendedPlayEffects = CardEffects & { discard_hand?: boolean };

/** Applies immediate on-play effects. Choice/interaction effects are not resolved here yet. */
export function applyStructuredPlayEffects(
  state: GameState,
  playerIdx: number,
  card: CardInstance,
  effects: CardEffects,
  drawCards: DrawCardsFn
): GameState {
  const fx = effects as ExtendedPlayEffects;
  let next: GameState = {
    ...state,
    turnCoins: state.turnCoins + fx.gain_coins,
    turnValor: state.turnValor + fx.gain_valor,
  };

  let player: PlayerState = { ...next.players[playerIdx] };
  let playerChanged = false;

  if (effects.gain_vp) {
    player.victoryPoints += effects.gain_vp;
    playerChanged = true;
  }

  if (fx.discard_hand && player.hand.length > 0) {
    const discarded = player.hand.map((c) => ({
      ...c,
      location: 'DISCARD' as const,
      faceUp: true,
    }));
    player = {
      ...player,
      hand: [],
      discard: [...player.discard, ...discarded],
    };
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
