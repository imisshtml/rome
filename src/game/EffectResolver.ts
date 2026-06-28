import type { CardEffects, CardInstance } from '../types';
import type { GameState, PlayerState } from '../types/gameTypes';
import { capCoinGainForPlayer } from '../utils/effectFlowUtils';

type DrawCardsFn = (player: PlayerState, count: number) => PlayerState;

type ExtendedPlayEffects = CardEffects & {
  discard_hand?: boolean;
  discount_faction_cost?: number;
  gain_favor?: number;
  gain_valor_per_arena_challenger?: number;
};

/** Applies immediate on-play effects. Choice/interaction effects are not resolved here yet. */
export function applyStructuredPlayEffects(
  state: GameState,
  playerIdx: number,
  card: CardInstance,
  effects: CardEffects,
  drawCards: DrawCardsFn
): GameState {
  const fx = effects as ExtendedPlayEffects;
  const cappedCoins = capCoinGainForPlayer(
    state.players[playerIdx],
    fx.gain_coins
  );
  let next: GameState = {
    ...state,
    turnCoins: state.turnCoins + cappedCoins,
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

  if (fx.discount_epics) {
    next = {
      ...next,
      turnEpicDiscount: (next.turnEpicDiscount ?? 0) + fx.discount_epics,
    };
  }

  if (fx.discount_faction_cost) {
    next = {
      ...next,
      turnFactionDiscount:
        (next.turnFactionDiscount ?? 0) + fx.discount_faction_cost,
    };
  }

  const perChallenger = fx.gain_valor_per_arena_challenger ?? 0;
  if (perChallenger > 0) {
    const challengerCount = state.arenaCommitZone?.length ?? 0;
    if (challengerCount > 0) {
      next = {
        ...next,
        turnValor: next.turnValor + perChallenger * challengerCount,
      };
    }
  }

  return next;
}

export function getLegacyCoinGain(card: CardInstance): number {
  if (card.definition.type === 'Favor' || card.definition.faction === 'Favor') {
    return 1;
  }
  return 0;
}
