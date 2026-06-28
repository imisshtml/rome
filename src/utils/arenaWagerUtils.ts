import type { CardInstance } from '../types/cardTypes';
import type { GameState, PlayerState } from '../types/gameTypes';
import { getRawEffects } from './playDestroyUtils';

export type ArenaWagerEntry = {
  playerId: string;
  playerName: string;
  card: CardInstance;
  sourceZone: 'HAND' | 'PLAY_AREA';
  score: number;
  randomPick: boolean;
};

export type ArenaWagerResult = {
  beneficiaryId: string;
  entries: ArenaWagerEntry[];
  winnerIds: string[];
  participantCount: number;
  gratiaPerWinner: number;
};

export function favorIsArenaWager(card: CardInstance): boolean {
  return getRawEffects(card).arena_wager === true;
}

export function scoreArenaWagerCard(card: CardInstance): number {
  const def = card.definition;
  return (def.valor ?? 0) + (def.cost ?? 0) + (def.victoryPoints ?? 0);
}

export function beneficiaryHasArenaWagerTargets(player: PlayerState): boolean {
  return player.hand.length > 0 || player.playArea.length > 0;
}

export function deterministicHandPickIndex(
  state: GameState,
  salt: string,
  opponentId: string,
  handLength: number
): number {
  if (handLength <= 0) return -1;
  const seed = `${state.id}:${state.version ?? 0}:${salt}:${opponentId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % handLength;
}

export function buildArenaWagerEntries(
  state: GameState,
  beneficiaryId: string,
  ownPick: { cardInstanceId: string; sourceZone: 'HAND' | 'PLAY_AREA' },
  favorCardInstanceId: string
): ArenaWagerEntry[] | null {
  const beneficiary = state.players.find((p) => p.id === beneficiaryId);
  if (!beneficiary) return null;

  const ownPool =
    ownPick.sourceZone === 'HAND' ? beneficiary.hand : beneficiary.playArea;
  const ownCard = ownPool.find((c) => c.instanceId === ownPick.cardInstanceId);
  if (!ownCard) return null;

  const entries: ArenaWagerEntry[] = [
    {
      playerId: beneficiaryId,
      playerName: beneficiary.name,
      card: { ...ownCard, faceUp: true },
      sourceZone: ownPick.sourceZone,
      score: scoreArenaWagerCard(ownCard),
      randomPick: false,
    },
  ];

  const salt = `${favorCardInstanceId}:${ownPick.cardInstanceId}`;

  for (const opponent of state.players) {
    if (opponent.id === beneficiaryId) continue;
    if (opponent.hand.length === 0) continue;
    const idx = deterministicHandPickIndex(
      state,
      salt,
      opponent.id,
      opponent.hand.length
    );
    const card = opponent.hand[idx];
    entries.push({
      playerId: opponent.id,
      playerName: opponent.name,
      card: { ...card, faceUp: true },
      sourceZone: 'HAND',
      score: scoreArenaWagerCard(card),
      randomPick: true,
    });
  }

  return entries;
}

export function resolveArenaWagerWinners(
  entries: ArenaWagerEntry[]
): { winnerIds: string[]; participantCount: number; gratiaPerWinner: number } {
  const participantCount = entries.length;
  const maxScore = Math.max(...entries.map((e) => e.score));
  const winnerIds = entries
    .filter((e) => e.score === maxScore)
    .map((e) => e.playerId);
  return {
    winnerIds,
    participantCount,
    gratiaPerWinner: participantCount,
  };
}

export function pickBestArenaWagerOwnCard(
  player: PlayerState
): { card: CardInstance; sourceZone: 'HAND' | 'PLAY_AREA' } | null {
  const candidates: {
    card: CardInstance;
    sourceZone: 'HAND' | 'PLAY_AREA';
    score: number;
  }[] = [
    ...player.hand.map((card) => ({
      card,
      sourceZone: 'HAND' as const,
      score: scoreArenaWagerCard(card),
    })),
    ...player.playArea.map((card) => ({
      card,
      sourceZone: 'PLAY_AREA' as const,
      score: scoreArenaWagerCard(card),
    })),
  ];
  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  return { card: best.card, sourceZone: best.sourceZone };
}

export function formatArenaWagerLogSummary(result: ArenaWagerResult): string {
  const winnerNames = result.entries
    .filter((e) => result.winnerIds.includes(e.playerId))
    .map((e) => e.playerName);
  const winnerLabel =
    winnerNames.length === 1
      ? winnerNames[0]
      : `${winnerNames.join(' & ')} (tie)`;
  const reveal = result.entries
    .map(
      (e) =>
        `${e.playerName}: ${e.card.definition.name} (${e.score} — ${e.card.definition.valor ?? 0}V+${e.card.definition.cost ?? 0}c+${e.card.definition.victoryPoints ?? 0}VP)`
    )
    .join('; ');
  return `${reveal}. Winner: ${winnerLabel} (+${result.gratiaPerWinner} Gratia each); others +1 Disfavor`;
}
