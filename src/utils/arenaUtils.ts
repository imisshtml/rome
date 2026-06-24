import { CardInstance } from '../types/cardTypes';
import type { GameState, PlayerState } from '../types/gameTypes';
import { isCharityCard } from './cardFactionUtils';

export const OPENING_GAMES_ARENA_ID = 'arena_opening_games';

export function normalizeArenaDefinitionId(id: string): string {
  return id.replace(/-/g, '_').toLowerCase();
}

export function isOpeningGamesArena(
  cardOrId: CardInstance | string
): boolean {
  const id =
    typeof cardOrId === 'string'
      ? cardOrId
      : cardOrId.definitionId ?? cardOrId.definition?.id ?? '';
  return normalizeArenaDefinitionId(id) === OPENING_GAMES_ARENA_ID;
}

/** Faction or Epic in play area — triggers mandatory arena when open. */
export function playAreaTriggersMandatoryArena(
  playArea: CardInstance[]
): boolean {
  return playArea.some((card) => {
    if (isCharityCard(card) && !card.chosenFaction) return false;
    const type = card.definition.type;
    if (type === 'Gladiator' || type === 'Action' || type === 'Epic') {
      return true;
    }
    return type === 'Basic' && !!card.chosenFaction;
  });
}

export function playAreaIsCharityOnlyOrEmpty(
  playArea: CardInstance[]
): boolean {
  if (playArea.length === 0) return true;
  return playArea.every((c) => isCharityCard(c) && !c.chosenFaction);
}

export function mustEnterArenaBeforeEndTurn(
  state: GameState,
  playerId: string
): boolean {
  if (!state.arenaOpen) return false;
  if (!state.arenaCard) return false;
  if (state.turnArenaResolved) return false;
  if (state.turnArenaExempt) return false;
  if (state.arenaChallenge) return false;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;

  return playAreaTriggersMandatoryArena(player.playArea);
}

export const ARENA_MIN_COMMIT = 1;
export const ARENA_DEFAULT_MAX_COMMIT = 3;

export function playerHasFourthArenaParticipantEffect(
  player: Pick<PlayerState, 'playArea' | 'itemsInPlay'>
): boolean {
  const cards = [...player.playArea, ...player.itemsInPlay];
  return cards.some((card) => {
    const effects = card.definition.effects as
      | { allow_fourth_arena_participant?: boolean }
      | undefined;
    return effects?.allow_fourth_arena_participant === true;
  });
}

export function getArenaMaxCommit(
  player: Pick<PlayerState, 'playArea' | 'itemsInPlay'>
): number {
  return playerHasFourthArenaParticipantEffect(player)
    ? 4
    : ARENA_DEFAULT_MAX_COMMIT;
}

export function isValidArenaCommitCount(
  count: number,
  maxCommit: number
): boolean {
  return count >= ARENA_MIN_COMMIT && count <= maxCommit;
}
