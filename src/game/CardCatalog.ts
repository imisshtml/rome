import factionsPack from '../../cards_factions.json';
import arenaPack from '../../cards_arena.json';
import eventsPack from '../../cards_events.json';
import favorPack from '../../cards_favor.json';
import itemsPack from '../../cards_items.json';
import { CardDefinition, CardInstance, CardType, Faction } from '../types/cardTypes';
import { CardEffects, mergeCardEffects } from '../types/effectsTypes';

type RawFactionCard = (typeof factionsPack.cards)[number];
type RawArenaCard = (typeof arenaPack.cards)[number];
type RawEventCard = (typeof eventsPack.cards)[number];
type RawFavorCard = (typeof favorPack)[number];
type RawItemCard = (typeof itemsPack)[number];

const ITEM_DECK_QTY = 1;

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

function buildArenaDisplayText(raw: RawArenaCard): string {
  const effectText = raw.effect_text?.trim();
  if (effectText) return effectText;

  const parts: string[] = [];
  const win = raw.effect_text_win?.trim();
  const loss = raw.effect_text_loss?.trim();
  if (win) parts.push(win);
  if (loss) parts.push(loss);
  if (parts.length > 0) return parts.join('\n');

  const tier = raw.tier ?? 'medium';
  const valorGain = raw.valor_required ?? 0;
  const rewardVp = raw.reward_vp ?? ARENA_TIER_REWARD_VP[tier] ?? 3;
  return `Gain ${valorGain} Valor and ${rewardVp} Victory Points.`;
}

function fromArenaCard(raw: RawArenaCard): CardDefinition {
  const id = slugToId(raw.id);
  const tier = raw.tier ?? 'medium';
  const valorGain = raw.valor_required ?? 0;
  const rewardVp = raw.reward_vp ?? ARENA_TIER_REWARD_VP[tier] ?? 3;
  return buildDefinition(id, {
    name: raw.name,
    cost: 0,
    valor: 0,
    victoryPoints: 0,
    type: 'Event',
    faction: 'Arena',
    text: buildArenaDisplayText(raw),
    image: raw.image,
    valorRequired: valorGain,
    rewardVp,
    tier,
    effectTextLoss: raw.effect_text_loss?.trim() || undefined,
    ...(raw.effects
      ? { effects: mergeCardEffects(raw.effects as Partial<CardEffects>) }
      : {}),
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
    ...('effect_legacy' in raw && raw.effect_legacy
      ? {
          effectLegacy: raw.effect_legacy as unknown as Record<
            string,
            number | boolean
          >,
        }
      : {}),
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

/** Gratia — gained via events; +1 Coin on play, 1 VP. Not sold in the market. */
export const GRATIA_SUPPLY: CardDefinition = buildDefinition('gratia_supply', {
  name: 'Gratia',
  cost: 0,
  valor: 0,
  victoryPoints: 1,
  type: 'Basic',
  faction: 'Ludus',
  text: '+1 Coin',
  image: 'gratia.jpg',
  effects: mergeCardEffects({ gain_coins: 1 }),
});

export function isGratiaSupplyDefinition(
  cardOrId: CardInstance | CardDefinition | string
): boolean {
  const id =
    typeof cardOrId === 'string'
      ? cardOrId
      : 'definitionId' in cardOrId
        ? cardOrId.definitionId
        : cardOrId.id;
  return id === GRATIA_SUPPLY.id;
}

function fromItemCard(raw: RawItemCard): CardDefinition {
  const hasEffects =
    raw.effects != null && Object.keys(raw.effects).length > 0;
  return buildDefinition(slugToId(raw.id), {
    name: raw.name,
    cost: raw.cost ?? 0,
    valor: 0,
    victoryPoints: raw.victory_points ?? 0,
    type: 'Item',
    faction: 'Item',
    text: raw.effect_text ?? '',
    image: raw.image,
    ...(hasEffects
      ? { effects: mergeCardEffects(raw.effects as Partial<CardEffects>) }
      : {}),
  });
}

const factionDefinitions = factionsPack.cards.map(fromFactionCard);
const arenaDefinitions = arenaPack.cards.map(fromArenaCard);
const eventDefinitions = eventsPack.cards.map(fromEventCard);
const favorDefinitions = favorPack.map(fromFavorCard);
const itemDefinitions = itemsPack.map(fromItemCard);

export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  [BASIC_CHARITY.id]: BASIC_CHARITY,
  [CROWD_DISFAVOR.id]: CROWD_DISFAVOR,
  [GRATIA_SUPPLY.id]: GRATIA_SUPPLY,
};

for (const def of [
  ...factionDefinitions,
  ...arenaDefinitions,
  ...eventDefinitions,
  ...favorDefinitions,
  ...itemDefinitions,
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
  const qtyById = new Map<string, number>();
  for (const raw of factionsPack.cards) {
    if (raw.deck_source !== 'gallery') continue;
    if ('recruit' in raw && raw.recruit) continue;
    const id = factionDefinitionId(raw);
    qtyById.set(id, (qtyById.get(id) ?? 0) + (raw.deck_qty ?? 1));
  }
  for (const raw of eventsPack.cards) {
    const id = slugToId(raw.id);
    qtyById.set(id, (qtyById.get(id) ?? 0) + EVENT_DECK_QTY);
  }
  for (const raw of itemsPack) {
    const id = slugToId(raw.id);
    qtyById.set(id, (qtyById.get(id) ?? 0) + (raw.deck_qty ?? ITEM_DECK_QTY));
  }
  return Array.from(qtyById.entries()).map(([definitionId, qty]) => ({
    definitionId,
    qty,
  }));
}

/** Definition ids of all gallery event cards (for random-event effects). */
export function getGalleryEventDefinitionIds(): string[] {
  return eventsPack.cards.map((raw) => slugToId(raw.id));
}

/** Item cards shuffled into the market (gallery) deck. */
export function getItemPoolEntries(): PoolEntry[] {
  return itemsPack.map((raw) => ({
    definitionId: slugToId(raw.id),
    qty: raw.deck_qty ?? ITEM_DECK_QTY,
  }));
}

const ITEM_DEFINITION_IDS = new Set(itemsPack.map((raw) => slugToId(raw.id)));

export function isItemDefinitionId(
  cardOrId: CardInstance | CardDefinition | string
): boolean {
  const id =
    typeof cardOrId === 'string'
      ? cardOrId
      : 'definitionId' in cardOrId
        ? cardOrId.definitionId
        : cardOrId.id;
  return ITEM_DEFINITION_IDS.has(id);
}

/** Recruit pile — 10 copies each of the three faction recruit cards. */
export function getRecruitPoolEntries(): PoolEntry[] {
  return factionsPack.cards
    .filter(
      (raw) =>
        raw.deck_source === 'gallery' && 'recruit' in raw && raw.recruit === true
    )
    .map((raw) => ({
      definitionId: factionDefinitionId(raw),
      qty: raw.deck_qty ?? 10,
    }));
}

export function isRecruitDefinition(definitionId: string): boolean {
  return getRecruitPoolEntries().some((e) => e.definitionId === definitionId);
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
  return arenaPack.cards
    .filter(
      (raw) =>
        normalizeArenaDefinitionId(slugToId(raw.id)) !== OPENING_GAMES_ARENA_ID
    )
    .map((raw) => ({
      definitionId: slugToId(raw.id),
      qty: ARENA_TIER_COPIES[raw.tier ?? 'medium'] ?? 2,
    }));
}

function normalizeArenaDefinitionId(id: string): string {
  return id.replace(/-/g, '_').toLowerCase();
}

export const OPENING_GAMES_ARENA_ID = 'arena_opening_games';

export function isOpeningGamesArenaDefinition(
  definitionId: string
): boolean {
  return normalizeArenaDefinitionId(definitionId) === OPENING_GAMES_ARENA_ID;
}

export function getOpeningGamesArenaDefinitionId(): string | null {
  const raw = arenaPack.cards.find(
    (card) =>
      normalizeArenaDefinitionId(slugToId(card.id)) === OPENING_GAMES_ARENA_ID
  );
  return raw ? slugToId(raw.id) : null;
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

const FAVOR_DEFINITION_IDS = new Set(
  favorPack.map((raw) => slugToId(raw.id))
);

export function isFavorDefinitionId(
  cardOrId: CardInstance | CardDefinition | string
): boolean {
  const id =
    typeof cardOrId === 'string'
      ? cardOrId
      : 'definitionId' in cardOrId
        ? cardOrId.definitionId
        : cardOrId.id;
  return FAVOR_DEFINITION_IDS.has(id);
}

/** Cards that must never live in a player's deck/discard cycle. */
export function isNonDeckablePlayerCard(
  cardOrId: CardInstance | CardDefinition | string
): boolean {
  if (isGalleryEventCard(cardOrId)) return true;
  if (isFavorDefinitionId(cardOrId)) return true;

  const id =
    typeof cardOrId === 'string'
      ? cardOrId
      : 'definitionId' in cardOrId
        ? cardOrId.definitionId
        : cardOrId.id;

  if (id === CROWD_DISFAVOR.id) return true;

  const def =
    typeof cardOrId === 'string'
      ? getCardDefinition(cardOrId)
      : 'definition' in cardOrId && cardOrId.definition
        ? cardOrId.definition
        : getCardDefinition(id);

  return (
    def.type === 'Favor' ||
    def.type === 'Event' ||
    def.type === 'CrowdDisfavor'
  );
}

export function isPurchasableMarketCard(card: CardInstance): boolean {
  return !isNonDeckablePlayerCard(card);
}

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
