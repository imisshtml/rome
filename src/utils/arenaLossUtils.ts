import { CardInstance } from '../types/cardTypes';
import { GameState, PendingArenaLoss, PlayerState } from '../types/gameTypes';
import { CROWD_DISFAVOR } from '../game/CardCatalog';
import { addToDestroyedPile } from './destroyedPileUtils';

let disfavorInstanceCounter = 0;

function createDisfavorForDiscard(ownerId: string): CardInstance {
  disfavorInstanceCounter += 1;
  return {
    instanceId: `disfavor_${Date.now()}_${disfavorInstanceCounter}`,
    definitionId: CROWD_DISFAVOR.id,
    definition: CROWD_DISFAVOR,
    location: 'DISCARD',
    ownerId,
    faceUp: true,
  };
}

export type ArenaLossType =
  | 'disfavor'
  | 'destroy_fighter'
  | 'primus_choice'
  | 'destroy_deck_top';

export interface ArenaLossSpec {
  type: ArenaLossType;
  disfavorCount?: number;
  destroyFighterCount?: number;
  drawLessAtEndOfTurn?: number;
}

export function parseArenaLossSpec(
  card: CardInstance | null
): ArenaLossSpec {
  const lossText = card?.definition.effectTextLoss?.trim() ?? '';
  const effectsDisfavor = card?.definition.effects?.gain_crowd_disfavor ?? 0;

  if (/gain\s+5\s+disfavor\s+or\s+destroy your strongest fighter/i.test(lossText)) {
    return { type: 'primus_choice', disfavorCount: 5 };
  }

  if (/destroy\s+1\s+of your fighters/i.test(lossText)) {
    return { type: 'destroy_fighter', destroyFighterCount: 1 };
  }

  if (/destroy the top card of your deck/i.test(lossText)) {
    return { type: 'destroy_deck_top' };
  }

  const disfavorMatch = lossText.match(/gain\s+(\d+)\s+disfavor/i);
  if (disfavorMatch) {
    const count = parseInt(disfavorMatch[1], 10);
    const drawLess = lossText.match(/draw\s+(\d+)\s+less card/i);
    return {
      type: 'disfavor',
      disfavorCount: count,
      drawLessAtEndOfTurn: drawLess ? parseInt(drawLess[1], 10) : undefined,
    };
  }

  if (effectsDisfavor > 0) {
    return { type: 'disfavor', disfavorCount: effectsDisfavor };
  }

  return { type: 'disfavor', disfavorCount: 1 };
}

export function arenaLossNeedsPrompt(spec: ArenaLossSpec): boolean {
  return spec.type === 'destroy_fighter' || spec.type === 'primus_choice';
}

export function getFighterStrength(card: CardInstance): number {
  return (card.definition.valor ?? 0) + (card.definition.cost ?? 0);
}

function fighterStatKey(card: CardInstance): string {
  const def = card.definition;
  return `${def.valor ?? 0}|${def.cost ?? 0}|${def.victoryPoints ?? 0}`;
}

/** Strongest by Valor + Cost. Returns multiple only when fully tied on valor, cost, and VP. */
export function getPrimusDestroyCandidates(
  fighters: CardInstance[]
): CardInstance[] {
  if (fighters.length === 0) return [];
  const maxStrength = Math.max(...fighters.map(getFighterStrength));
  const top = fighters.filter((f) => getFighterStrength(f) === maxStrength);
  if (top.length <= 1) return top;

  const groups = new Map<string, CardInstance[]>();
  for (const fighter of top) {
    const key = fighterStatKey(fighter);
    groups.set(key, [...(groups.get(key) ?? []), fighter]);
  }

  const tiedGroups = [...groups.values()].filter((group) => group.length > 1);
  if (tiedGroups.length > 0) {
    return tiedGroups.sort((a, b) => b.length - a.length)[0];
  }

  return [
    top.reduce((best, fighter) => {
      const def = fighter.definition;
      const bestDef = best.definition;
      if ((def.victoryPoints ?? 0) !== (bestDef.victoryPoints ?? 0)) {
        return (def.victoryPoints ?? 0) > (bestDef.victoryPoints ?? 0) ? fighter : best;
      }
      if ((def.cost ?? 0) !== (bestDef.cost ?? 0)) {
        return (def.cost ?? 0) > (bestDef.cost ?? 0) ? fighter : best;
      }
      return (def.valor ?? 0) > (bestDef.valor ?? 0) ? fighter : best;
    }),
  ];
}

function discardCardToPlayer(
  player: PlayerState,
  card: CardInstance
): PlayerState {
  return {
    ...player,
    discard: [
      ...player.discard,
      { ...card, location: 'DISCARD' as const, faceUp: true },
    ],
  };
}

export function giveDisfavorToPlayer(
  state: GameState,
  player: PlayerState,
  count: number
): { state: GameState; player: PlayerState } {
  let disfavorDeck = [...state.disfavorDeck];
  let updated = player;

  for (let i = 0; i < count; i++) {
    const fromDeck =
      disfavorDeck.length > 0
        ? {
            ...disfavorDeck.pop()!,
            location: 'DISCARD' as const,
            ownerId: player.id,
            faceUp: true,
          }
        : createDisfavorForDiscard(player.id);
    updated = discardCardToPlayer(updated, fromDeck);
  }

  return { state: { ...state, disfavorDeck }, player: updated };
}

function removeCardFromDiscard(
  player: PlayerState,
  instanceId: string
): { player: PlayerState; card: CardInstance | null } {
  const idx = player.discard.findIndex((c) => c.instanceId === instanceId);
  if (idx === -1) return { player, card: null };
  const card = player.discard[idx];
  return {
    player: {
      ...player,
      discard: player.discard.filter((_, i) => i !== idx),
    },
    card,
  };
}

export function destroyFighterFromDiscard(
  state: GameState,
  playerIdx: number,
  instanceId: string
): GameState {
  const players = [...state.players];
  const player = { ...players[playerIdx] };
  const { player: without, card } = removeCardFromDiscard(player, instanceId);
  if (!card) return state;

  players[playerIdx] = without;
  return addToDestroyedPile({ ...state, players }, [card]);
}

export function applyAutomaticArenaLoss(
  state: GameState,
  playerIdx: number,
  spec: ArenaLossSpec
): GameState {
  const players = [...state.players];
  let player = { ...players[playerIdx] };
  let next = state;

  if (spec.type === 'disfavor') {
    const result = giveDisfavorToPlayer(next, player, spec.disfavorCount ?? 1);
    next = result.state;
    player = result.player;
    if (spec.drawLessAtEndOfTurn) {
      player = {
        ...player,
        drawPenalty: (player.drawPenalty ?? 0) + spec.drawLessAtEndOfTurn,
      };
    }
  } else if (spec.type === 'destroy_deck_top') {
    if (player.deck.length > 0) {
      const top = { ...player.deck[0], location: 'DESTROYED' as const, faceUp: true };
      player = { ...player, deck: player.deck.slice(1) };
      next = addToDestroyedPile(next, [top]);
    }
  }

  players[playerIdx] = player;
  return { ...next, players };
}

export function beginPendingArenaLoss(
  state: GameState,
  playerId: string,
  spec: ArenaLossSpec,
  committedFighters: CardInstance[]
): PendingArenaLoss {
  if (spec.type === 'primus_choice') {
    const candidates = getPrimusDestroyCandidates(committedFighters);
    return {
      playerId,
      loss: spec,
      committedFighters,
      phase: 'primus_choice',
      primusCandidates: candidates,
    };
  }

  return {
    playerId,
    loss: spec,
    committedFighters,
    phase: 'destroy_fighter_pick',
    remainingDestroyPicks: spec.destroyFighterCount ?? 1,
  };
}
