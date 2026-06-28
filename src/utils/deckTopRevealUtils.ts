import type { CardInstance } from '../types/cardTypes';
import type { GameState, PendingDeckTopRevealPick } from '../types/gameTypes';

export function beginDeckTopRevealPick(
  state: GameState,
  playerIdx: number,
  card: CardInstance
): GameState {
  const picks: PendingDeckTopRevealPick['picks'] = [];
  const players = state.players.map((player, idx) => {
    if (player.deck.length === 0) return player;
    const top = {
      ...player.deck[0],
      location: 'DECK' as const,
      faceUp: true,
    };
    picks.push({
      targetPlayerId: player.id,
      targetPlayerName: player.name,
      card: top,
    });
    if (idx === playerIdx) {
      return { ...player, deck: player.deck.slice(1) };
    }
    return { ...player, deck: player.deck.slice(1) };
  });

  if (picks.length === 0) {
    return { ...state, players };
  }

  return {
    ...state,
    players,
    pendingDeckTopRevealPick: {
      playerId: state.players[playerIdx].id,
      sourceCardName: card.definition.name,
      sourceCardInstanceId: card.instanceId,
      picks,
      currentIndex: 0,
    },
  };
}

export function getCurrentDeckTopRevealPick(
  pending: PendingDeckTopRevealPick
): PendingDeckTopRevealPick['picks'][number] | null {
  return pending.picks[pending.currentIndex] ?? null;
}
