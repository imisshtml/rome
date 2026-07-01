import { CardDefinition, CardInstance, Faction } from '../types/cardTypes';

/** Factions a Spy may become when played. */
export type BandingFactionChoice = 'Legion' | 'Ludus' | 'Senate';
export const SPY_FACTION_CHOICES: BandingFactionChoice[] = ['Legion', 'Ludus', 'Senate'];

export function requiresFactionChoiceOnPlay(definition: CardDefinition): boolean {
  return definition.effects?.choose_faction_on_play === true;
}

export function isSpyFactionChoice(faction: string): faction is Faction {
  return (SPY_FACTION_CHOICES as string[]).includes(faction);
}

export function isCharityCard(
  card: CardInstance | Pick<CardInstance, 'definitionId' | 'definition'>
): boolean {
  const id = card.definitionId ?? card.definition?.id;
  return id === 'all_001';
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

/**
 * Whether a card counts as an owned faction card (Legion/Ludus/Senate). Basic
 * cards (Charity/Gratia) carry a Ludus faction tag for display but must NOT
 * count toward faction membership (Secutor top-deck, deck_vp_per_faction, etc.).
 */
export function countsAsFactionMember(card: CardInstance): boolean {
  if (card.chosenFaction) return true;
  if (card.definition.effects?.counts_as_faction) return true;
  const type = card.definition.type;
  return type === 'Gladiator' || type === 'Action';
}
