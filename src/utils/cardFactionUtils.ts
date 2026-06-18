import { CardDefinition, CardInstance, Faction } from '../types/cardTypes';

/** Factions a Spy may become when played. */
export const SPY_FACTION_CHOICES: Faction[] = ['Legion', 'Ludus', 'Senate'];

export function requiresFactionChoiceOnPlay(definition: CardDefinition): boolean {
  return definition.effects?.choose_faction_on_play === true;
}

export function isSpyFactionChoice(faction: string): faction is Faction {
  return (SPY_FACTION_CHOICES as string[]).includes(faction);
}

/** Faction used for banding / display — instance choice overrides definition. */
export function getCardEffectiveFaction(card: CardInstance): Faction {
  if (card.chosenFaction) return card.chosenFaction;
  const fixed = card.definition.effects?.counts_as_faction;
  if (fixed) return fixed;
  return card.definition.faction;
}
