import { CardInstance } from '../types/cardTypes';
import { GameState } from '../types/gameTypes';
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
