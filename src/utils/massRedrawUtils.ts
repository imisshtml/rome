import type { CardInstance } from '../types/cardTypes';
import type { GameState, MassHandRedrawPlayerLog, PlayerState } from '../types/gameTypes';

export type { MassHandRedrawPlayerLog };

export function applyMassHandRedraw(
  state: GameState,
  drawCards: (player: PlayerState, count: number) => PlayerState,
  drawDelta: number
): { state: GameState; playerLogs: MassHandRedrawPlayerLog[] } {
  const playerLogs: MassHandRedrawPlayerLog[] = [];
  let next = state;
  const players = next.players.map((p) => ({ ...p }));

  for (let i = 0; i < players.length; i++) {
    let player = { ...players[i] };
    const previousHand = [...player.hand];
    const handSize = previousHand.length;

    if (handSize > 0) {
      player = {
        ...player,
        hand: [],
        discard: [
          ...player.discard,
          ...previousHand.map((card) => ({
            ...card,
            location: 'DISCARD' as const,
            faceUp: true,
          })),
        ],
      };
    }

    const drawCount = Math.max(0, handSize + drawDelta);
    if (drawCount > 0) {
      player = drawCards(player, drawCount);
    }

    players[i] = player;
    playerLogs.push({
      playerId: player.id,
      playerName: player.name,
      discardedCardNames: previousHand.map((c) => c.definition.name),
      drewCount: drawCount,
    });
  }

  return { state: { ...next, players }, playerLogs };
}

export function formatMassHandRedrawSummary(
  logs: MassHandRedrawPlayerLog[],
  controllerId: string,
  controllerBonusDraw: number
): string {
  const parts = logs.map((entry) => {
    const discarded =
      entry.discardedCardNames.length > 0
        ? entry.discardedCardNames.join(', ')
        : '(empty hand)';
    const redraw =
      entry.playerId === controllerId && controllerBonusDraw > 0
        ? `${entry.drewCount} (+${controllerBonusDraw} bonus)`
        : `${entry.drewCount}`;
    return `${entry.playerName}: discarded ${discarded}; redrew ${redraw}`;
  });
  return parts.join('; ');
}
