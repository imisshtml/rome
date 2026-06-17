import factionsPack from '../../cards_factions.json';
import arenaPack from '../../cards_arena.json';
import eventsPack from '../../cards_events.json';
import favorPack from '../../cards_favor.json';
import { CardDefinition, CardType, Faction } from '../types/cardTypes';
import { CardEffects, mergeCardEffects } from '../types/effectsTypes';

type RawFactionCard = (typeof factionsPack.cards)[number];
type RawArenaCard = (typeof arenaPack.cards)[number];
type RawEventCard = (typeof eventsPack.cards)[number];
type RawFavorCard = (typeof favorPack)[number];

export interface PoolEntry {
  definitionId: string;
  qty: number;
}

const ARENA_TIER_COPIES: Record<string, number> = {
  easy: 3,
  medium: 2,
  hard: 2,
  epic: 1,
};

const ARENA_TIER_REWARD_VP: Record<string, number> = {
  easy: 2,
  medium: 3,
  hard: 4,
  epic: 5,
};

const EVENT_DECK_QTY = 2;

function slugToId(slug: string): string {
  return slug.replace(/-/g, '_');
}

function mapFactionFromFaction(raw: RawFactionCard): Faction {
  if (raw.faction === 'Ludus') return 'Ludus';
  if (raw.faction === 'Legion') return 'Legion';
  if (raw.faction === 'Senate') return 'Senate';
  return 'Epic';
}

function mapCardTypeFromFaction(raw: RawFactionCard): CardType {
  if (raw.card_type === 'epic') return 'Epic';
  if (raw.card_type === 'item') return 'Item';
  if (raw.faction === 'Senate') return 'Action';
  return 'Gladiator';
}

function buildDefinition(
  id: string,
  partial: Omit<CardDefinition, 'id'> & { id?: string }
): CardDefinition {
  return { id, ...partial };
}

function fromFactionCard(raw: RawFactionCard): CardDefinition {
  const id = raw.slug ? slugToId(raw.slug) : slugToId(raw.id.toLowerCase());
  return buildDefinition(id, {
    name: raw.name,
    cost: raw.cost ?? 0,
    valor: raw.valor ?? 0,
    victoryPoints: raw.victory_points ?? 0,
    type: mapCardTypeFromFaction(raw),
    faction: mapFactionFromFaction(raw),
    text: raw.effect_text ?? '',
    image: raw.image,
    ...('effects' in raw && raw.effects
      ? { effects: mergeCardEffects(raw.effects as Partial<CardEffects>) }
      : {}),
  });
}

function fromArenaCard(raw: RawArenaCard): CardDefinition {
  const id = slugToId(raw.id);
  const tier = raw.tier ?? 'medium';
  return buildDefinition(id, {
    name: raw.name,
    cost: 0,
    valor: 0,
    victoryPoints: 0,
    type: 'Event',
    faction: 'Arena',
    text: `Requires ${raw.valor_required} Valor to defeat.`,
    image: raw.image,
    valorRequired: raw.valor_required,
    rewardVp: ARENA_TIER_REWARD_VP[tier] ?? 3,
    tier,
  });
}

function fromEventCard(raw: RawEventCard): CardDefinition {
  const id = slugToId(raw.id);
  return buildDefinition(id, {
    name: raw.name,
    cost: 0,
    valor: 0,
    victoryPoints: 0,
    type: 'Event',
    faction: 'Event',
    text: raw.effect_text ?? '',
    image: raw.image,
  });
}

function fromFavorCard(raw: RawFavorCard): CardDefinition {
  const id = slugToId(raw.id);
  return buildDefinition(id, {
    name: raw.name,
    cost: 0,
    valor: 0,
    victoryPoints: 0,
    type: 'Favor',
    faction: 'Favor',
    text: raw.effect_text ?? '',
    image: raw.image,
    ...(raw.effects
      ? { effects: mergeCardEffects(raw.effects as Partial<CardEffects>) }
      : {}),
  });
}

const BASIC_GLADIATOR: CardDefinition = buildDefinition('basic_gladiator', {
  name: 'Novice Gladiator',
  cost: 0,
  valor: 1,
  victoryPoints: 0,
  type: 'Basic',
  faction: 'Ludus',
  text: 'A fresh recruit to the arena.',
  image: 'legion_fresh_recruit.jpg',
});

const BASIC_FAVOR: CardDefinition = buildDefinition('basic_favor', {
  name: 'Minor Favor',
  cost: 0,
  valor: 0,
  victoryPoints: 0,
  type: 'Favor',
  faction: 'Favor',
  text: 'Gain 1 Coin.',
  image: 'favor_bread_circus.jpg',
  effects: mergeCardEffects({ gain_coins: 1 }),
});

export const CROWD_DISFAVOR: CardDefinition = buildDefinition('crowd_disfavor', {
  name: 'Disfavor',
  cost: 0,
  valor: 0,
  victoryPoints: -1,
  type: 'CrowdDisfavor',
  faction: 'CrowdDisfavor',
  text: 'The crowd jeers. -1 VP.',
  image: 'disfavor.jpg',
});

const factionDefinitions = factionsPack.cards.map(fromFactionCard);
const arenaDefinitions = arenaPack.cards.map(fromArenaCard);
const eventDefinitions = eventsPack.cards.map(fromEventCard);
const favorDefinitions = favorPack.map(fromFavorCard);

export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  [BASIC_GLADIATOR.id]: BASIC_GLADIATOR,
  [BASIC_FAVOR.id]: BASIC_FAVOR,
  [CROWD_DISFAVOR.id]: CROWD_DISFAVOR,
};

for (const def of [
  ...factionDefinitions,
  ...arenaDefinitions,
  ...eventDefinitions,
  ...favorDefinitions,
]) {
  CARD_DEFINITIONS[def.id] = def;
}

export function getCardDefinition(definitionId: string): CardDefinition {
  return CARD_DEFINITIONS[definitionId] ?? CARD_DEFINITIONS.basic_gladiator;
}

export function getGalleryPoolEntries(): PoolEntry[] {
  const entries: PoolEntry[] = [];
  for (const raw of factionsPack.cards) {
    if (raw.deck_source !== 'gallery') continue;
    const id = raw.slug ? slugToId(raw.slug) : slugToId(raw.id.toLowerCase());
    entries.push({ definitionId: id, qty: raw.deck_qty ?? 1 });
  }
  for (const raw of eventsPack.cards) {
    entries.push({
      definitionId: slugToId(raw.id),
      qty: EVENT_DECK_QTY,
    });
  }
  return entries;
}

export function getEpicPoolEntries(): PoolEntry[] {
  return factionsPack.cards
    .filter((raw) => raw.deck_source === 'epic')
    .map((raw) => ({
      definitionId: raw.slug ? slugToId(raw.slug) : slugToId(raw.id.toLowerCase()),
      qty: raw.deck_qty ?? 1,
    }));
}

export function getArenaPoolEntries(): PoolEntry[] {
  return arenaPack.cards.map((raw) => ({
    definitionId: slugToId(raw.id),
    qty: ARENA_TIER_COPIES[raw.tier ?? 'medium'] ?? 2,
  }));
}

export function getFlavorPoolEntries(): PoolEntry[] {
  return favorPack.map((raw) => ({
    definitionId: slugToId(raw.id),
    qty: raw.deck_qty ?? 1,
  }));
}

/** @deprecated use getGalleryPoolEntries */
export const GALLERY_CARD_IDS = getGalleryPoolEntries().flatMap((e) =>
  Array.from({ length: e.qty }, () => e.definitionId)
);

/** @deprecated use getArenaPoolEntries */
export const ARENA_CARD_IDS = getArenaPoolEntries().flatMap((e) =>
  Array.from({ length: e.qty }, () => e.definitionId)
);

/** @deprecated use getEpicPoolEntries */
export const EPIC_CARD_IDS = getEpicPoolEntries().map((e) => e.definitionId);
