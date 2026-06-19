import { CardDefinition, CardInstance, Faction } from '../types/cardTypes';

/** Factions a Spy may become when played. */
export const SPY_FACTION_CHOICES: Faction[] = ['Legion', 'Ludus', 'Senate'];

export function requiresFactionChoiceOnPlay(definition: CardDefinition): boolean {
  return definition.effects?.choose_faction_on_play === true;
}

export function isSpyFactionChoice(faction: string): faction is Faction {
  return (SPY_FACTION_CHOICES as string[]).includes(faction);
}

/** Factions shown on the card edge label. */
export const CARD_FACTION_LABELS: readonly Faction[] = [
  'Ludus',
  'Legion',
  'Senate',
  'Epic',
];

export function getCardDisplayFaction(
  definition: CardDefinition,
  chosenFaction?: Faction | null
): Faction | null {
  if (chosenFaction && CARD_FACTION_LABELS.includes(chosenFaction)) {
    return chosenFaction;
  }
  if (definition.type === 'Basic') return null;
  if (definition.type === 'Epic') return 'Epic';
  if (CARD_FACTION_LABELS.includes(definition.faction)) {
    return definition.faction;
  }
  return null;
}

/** Faction used for banding / display — instance choice overrides definition. */
export function getCardEffectiveFaction(card: CardInstance): Faction {
  if (card.chosenFaction) return card.chosenFaction;
  const fixed = card.definition.effects?.counts_as_faction;
  if (fixed) return fixed;
  return card.definition.faction;
}
