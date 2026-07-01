import { CardInstance } from '../types/cardTypes';
import { GameState, PlayerState } from '../types/gameTypes';
import {
  countFactionCardsInDeck,
  getDeckVpPerFactionPassive,
} from '../utils/effectFlowUtils';

export interface PostGameCardRow {
  definitionId: string;
  name: string;
  count: number;
  vpEach: number;
  vpTotal: number;
}

export interface PostGamePlayerSummary {
  id: string;
  name: string;
  isAI?: boolean;
  rank: number;
  totalVp: number;
  bonusVp: number;
  deckVp: number;
  deckCardCount: number;
  cardRows: PostGameCardRow[];
}

export interface PostGameSummary {
  winnerId: string | null;
  players: PostGamePlayerSummary[];
}

export function getAllPlayerCards(player: PlayerState): CardInstance[] {
  return [
    ...player.deck,
    ...player.discard,
    ...player.hand,
    ...player.playArea,
    ...player.itemsInPlay,
  ];
}

/** One card instance must not appear in multiple zones — dedupe before VP math. */
export function uniqueCardsByInstance(cards: CardInstance[]): CardInstance[] {
  const seen = new Set<string>();
  const out: CardInstance[] = [];
  for (const card of cards) {
    if (seen.has(card.instanceId)) continue;
    seen.add(card.instanceId);
    out.push(card);
  }
  return out;
}

/** VP from a card's printed value plus deck-wide scaling passives (Spectators, etc.). */
export function getCardEffectiveVictoryPoints(
  card: CardInstance,
  player: PlayerState
): number {
  const allCards = uniqueCardsByInstance(getAllPlayerCards(player));
  const base = card.definition?.victoryPoints ?? 0;
  const spec = getDeckVpPerFactionPassive(card);
  if (!spec) return base;
  return base + countFactionCardsInDeck(allCards, spec.faction) * spec.per;
}

export function buildCardVpBreakdown(cards: CardInstance[]): PostGameCardRow[] {
  const byDef = new Map<string, PostGameCardRow>();

  for (const card of cards) {
    const definitionId = card.definitionId;
    const vpEach = card.definition?.victoryPoints ?? 0;
    const name = card.definition?.name ?? definitionId;
    const existing = byDef.get(definitionId);

    if (existing) {
      existing.count += 1;
      existing.vpTotal += vpEach;
    } else {
      byDef.set(definitionId, {
        definitionId,
        name,
        count: 1,
        vpEach,
        vpTotal: vpEach,
      });
    }
  }

  return Array.from(byDef.values()).sort(
    (a, b) => b.vpTotal - a.vpTotal || a.name.localeCompare(b.name)
  );
}

export function getScalingPassiveVp(cards: CardInstance[]): number {
  const unique = uniqueCardsByInstance(cards);
  let total = 0;
  for (const card of unique) {
    const spec = getDeckVpPerFactionPassive(card);
    if (!spec) continue;
    const matches = countFactionCardsInDeck(unique, spec.faction);
    total += matches * spec.per;
  }
  return total;
}

export function getDeckVpFromCards(player: PlayerState): number {
  const cards = uniqueCardsByInstance(getAllPlayerCards(player));
  const baseVp = cards.reduce(
    (sum, card) => sum + (card.definition?.victoryPoints ?? 0),
    0
  );
  return baseVp + getScalingPassiveVp(cards);
}

/** Arena and other VP tracked on player.victoryPoints during play. */
export function getPlayerTotalVp(player: PlayerState): number {
  return player.victoryPoints + getDeckVpFromCards(player);
}

export function buildPostGameSummary(state: GameState): PostGameSummary {
  const ranked = state.players
    .map((player) => {
      const cards = getAllPlayerCards(player);
      const cardRows = buildCardVpBreakdown(cards);
      const deckVp = getDeckVpFromCards(player);
      const bonusVp = player.victoryPoints;

      return {
        id: player.id,
        name: player.name,
        isAI: player.isAI,
        rank: 0,
        totalVp: bonusVp + deckVp,
        bonusVp,
        deckVp,
        deckCardCount: cards.length,
        cardRows,
      };
    })
    .sort((a, b) => b.totalVp - a.totalVp || a.name.localeCompare(b.name))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const topScore = ranked[0]?.totalVp ?? 0;
  const leaders = ranked.filter((p) => p.totalVp === topScore && topScore > 0);
  const winnerId = state.winnerId ?? leaders[0]?.id ?? null;

  return { winnerId, players: ranked };
}

export function isArenaSupplyFinished(state: GameState): boolean {
  return state.arenaDeck.length === 0 && state.arenaCard === null;
}

export function isEpicSupplyFinished(state: GameState): boolean {
  return state.epicCards.length === 0 && (state.epicSupply?.length ?? 0) === 0;
}

export function isGameEndConditionMet(state: GameState): boolean {
  return isArenaSupplyFinished(state) || isEpicSupplyFinished(state);
}

export function finishGameIfNeeded(state: GameState): GameState {
  if (state.status === 'finished' || state.phase === 'PREGAME') {
    return state;
  }

  if (!isGameEndConditionMet(state)) {
    return state;
  }

  const leader = [...state.players].sort(
    (a, b) => getPlayerTotalVp(b) - getPlayerTotalVp(a)
  )[0];

  return {
    ...state,
    status: 'finished',
    winnerId: leader?.id ?? null,
  };
}
