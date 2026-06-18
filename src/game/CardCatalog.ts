import factionsPack from '../../cards_factions.json';
import arenaPack from '../../cards_arena.json';
import eventsPack from '../../cards_events.json';
import favorPack from '../../cards_favor.json';
import { CardDefinition, CardInstance, CardType, Faction } from '../types/cardTypes';
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

function factionDefinitionId(raw: RawFactionCard): string {
  if (raw.id.startsWith('ALL-')) {
    return slugToId(raw.id.toLowerCase());
  }
  return raw.slug ? slugToId(raw.slug) : slugToId(raw.id.toLowerCase());
}

function mapFactionFromFaction(raw: RawFactionCard): Faction {
  if (raw.card_type === 'basic') return 'Ludus';
  if (raw.faction === 'Ludus') return 'Ludus';
  if (raw.faction === 'Legion') return 'Legion';
  if (raw.faction === 'Senate') return 'Senate';
  return 'Epic';
}

function mapCardTypeFromFaction(raw: RawFactionCard): CardType {
  if (raw.card_type === 'basic') return 'Basic';
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

function normalizeFactionEffects(raw: Record<string, unknown>): Partial<CardEffects> {
  const partial = { ...raw } as Partial<CardEffects> & Record<string, unknown>;
  const countsAs = partial.counts_as_faction as string | null | undefined;
  if (countsAs === 'choose' || countsAs === 'choose_faction') {
    partial.choose_faction_on_play = true;
    partial.counts_as_faction = null;
  }
  return partial;
}

function fromFactionCard(raw: RawFactionCard): CardDefinition {
  const id = factionDefinitionId(raw);
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
      ? {
          effects: mergeCardEffects(
            normalizeFactionEffects(raw.effects as Record<string, unknown>)
          ),
        }
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

const BASIC_CHARITY: CardDefinition = buildDefinition('all_001', {
  name: 'Charity',
  cost: 0,
  valor: 0,
  victoryPoints: 0,
  type: 'Basic',
  faction: 'Ludus',
  text: '+1 Coin',
  image: 'charity.jpg',
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
  [BASIC_CHARITY.id]: BASIC_CHARITY,
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
  return CARD_DEFINITIONS[definitionId] ?? CARD_DEFINITIONS.all_001;
}

export function getStartingDeckEntries(): PoolEntry[] {
  const configured = factionsPack.mechanics?.starting_deck?.cards;
  if (configured?.length) {
    return configured.map(({ id, qty }) => {
      const raw = factionsPack.cards.find((card) => card.id === id);
      if (!raw) {
        throw new Error(`Starting deck references unknown card id: ${id}`);
      }
      return {
        definitionId: factionDefinitionId(raw),
        qty,
      };
    });
  }

  return factionsPack.cards
    .filter((raw) => raw.deck_source === 'starting')
    .map((raw) => ({
      definitionId: factionDefinitionId(raw),
      qty: raw.starting_deck_qty ?? 1,
    }));
}

export function getGalleryPoolEntries(): PoolEntry[] {
  const entries: PoolEntry[] = [];
  for (const raw of factionsPack.cards) {
    if (raw.deck_source !== 'gallery') continue;
    const id = factionDefinitionId(raw);
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
      definitionId: factionDefinitionId(raw),
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

const GALLERY_EVENT_IDS = new Set(
  eventsPack.cards.map((raw) => slugToId(raw.id))
);

/** Gallery event cards (from cards_events.json), not arena challenges. */
export function isGalleryEventCard(
  cardOrId: CardInstance | CardDefinition | string
): boolean {
  const id =
    typeof cardOrId === 'string'
      ? cardOrId
      : 'definitionId' in cardOrId
        ? cardOrId.definitionId
        : cardOrId.id;
  return GALLERY_EVENT_IDS.has(id);
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
