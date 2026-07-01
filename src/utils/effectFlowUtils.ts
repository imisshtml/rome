import type { CardInstance, Faction } from '../types/cardTypes';
import type { GameState, PlayerState } from '../types/gameTypes';
import { GRATIA_SUPPLY, isGalleryEventCard } from '../game/CardCatalog';
import { getCardEffectiveFaction, isCharityCard, countsAsFactionMember } from './cardFactionUtils';
import { getCardsPlayedThisTurn } from './bandingUtils';
import { getRawEffects } from './playDestroyUtils';

export type GainCardSpec = {
  maxCost?: number;
  source: 'market' | 'market_or_epic' | 'destroyed_pile' | 'favor_discard';
  type?: 'faction' | 'item' | 'imperial_favor';
  faction?: Faction;
};

export type ConditionalPlayEffect = {
  if_played_factions: string[];
  if_arena_defeated_this_turn?: boolean;
  draw_cards?: number;
  gain_coins?: number;
  gain_favor?: number;
  gain_imperial_favor?: number;
  gain_vp?: number;
};

export function capCoinGainForPlayer(
  player: PlayerState,
  amount: number
): number {
  const cap = player.coinCapPerCardNextTurn;
  if (cap == null || amount <= 0) return amount;
  return Math.min(amount, cap);
}

export function normalizeGainCardFaction(raw?: string): Faction | undefined {
  if (!raw) return undefined;
  const key = raw.toLowerCase();
  if (key === 'legion') return 'Legion';
  if (key === 'ludus') return 'Ludus';
  if (key === 'senate') return 'Senate';
  if (raw === 'Legion' || raw === 'Ludus' || raw === 'Senate') return raw;
  return undefined;
}

function parseGainCardSpec(raw: unknown): GainCardSpec | null {
  if (!raw) return null;
  if (typeof raw === 'object') {
    const spec = raw as Record<string, unknown>;
    const source = (spec.source as GainCardSpec['source']) ?? 'market';
    const maxCost =
      (spec.maxCost as number | undefined) ??
      (spec.max_cost as number | undefined);
    const faction =
      normalizeGainCardFaction(spec.faction as string | undefined) ??
      normalizeGainCardFaction(spec.faction_filter as string | undefined);
    return {
      source,
      maxCost,
      type: spec.type as GainCardSpec['type'],
      faction,
    };
  }
  return { source: 'market' };
}

export type CopyCardSpec = {
  source: 'market' | 'in_play' | 'market_or_epic';
  maxCost?: number;
};

export function getGainCardSpec(card: CardInstance): GainCardSpec | null {
  return parseGainCardSpec(getRawEffects(card).gain_card);
}

export function getConditionalPlayEffect(
  card: CardInstance
): ConditionalPlayEffect | null {
  const raw = getRawEffects(card).conditional as
    | Record<string, unknown>
    | undefined;
  if (!raw) return null;
  const factions = raw.if_played_factions;
  const factionList = Array.isArray(factions) ? factions.map(String) : [];
  const arenaDefeated = raw.if_arena_defeated_this_turn === true;
  if (factionList.length === 0 && !arenaDefeated) return null;
  return {
    if_played_factions: factionList,
    if_arena_defeated_this_turn: arenaDefeated,
    draw_cards: (raw.draw_cards as number | undefined) ?? undefined,
    gain_coins: (raw.gain_coins as number | undefined) ?? undefined,
    gain_favor: (raw.gain_favor as number | undefined) ?? undefined,
    gain_imperial_favor:
      (raw.gain_imperial_favor as number | undefined) ?? undefined,
    gain_vp: (raw.gain_vp as number | undefined) ?? undefined,
  };
}

export function getFactionsPlayedThisTurn(player: PlayerState): Set<Faction> {
  const factions = new Set<Faction>();
  for (const card of getCardsPlayedThisTurn(player)) {
    const faction = getCardEffectiveFaction(card);
    if (faction === 'Legion' || faction === 'Ludus' || faction === 'Senate') {
      factions.add(faction);
    }
  }
  return factions;
}

export function meetsConditionalPlayedFactions(
  player: PlayerState,
  required: string[]
): boolean {
  const played = getFactionsPlayedThisTurn(player);
  return required.every((raw) => {
    const faction = normalizeGainCardFaction(raw);
    return faction != null && played.has(faction);
  });
}

export function getCopyCardSpec(card: CardInstance): CopyCardSpec | null {
  const raw = getRawEffects(card).copy_card;
  if (!raw) return null;
  if (raw === true) return { source: 'in_play' };
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const source = (obj.source as CopyCardSpec['source']) ?? 'in_play';
    const maxCost = (obj.maxCost ?? obj.max_cost) as number | undefined;
    return { source, maxCost };
  }
  return null;
}

export function getLookAtTopCount(card: CardInstance): number {
  return (getRawEffects(card).look_at_top_cards as number) ?? 0;
}

export function wantsOwnDeckLookOnly(card: CardInstance): boolean {
  const raw = getRawEffects(card);
  return (
    raw.reorder_top_cards === true || raw.look_at_own_deck_only === true
  );
}

export function wantsDeckReorder(card: CardInstance): boolean {
  return getRawEffects(card).reorder_top_cards === true;
}

export function getOnGainEffects(
  card: CardInstance
): Record<string, unknown> | null {
  const raw = getRawEffects(card).on_gain;
  if (!raw || typeof raw !== 'object') return null;
  return raw as Record<string, unknown>;
}

export function cardHasOnGainEffects(card: CardInstance): boolean {
  const onGain = getOnGainEffects(card);
  if (!onGain) return false;
  return Object.entries(onGain).some(([key, value]) => {
    if (key === 'optional') return false;
    return value != null && value !== false && value !== 0;
  });
}

export function cardWithOnGainAsPlayEffects(card: CardInstance): CardInstance {
  const onGain = getOnGainEffects(card);
  if (!onGain) return card;
  return {
    ...card,
    definition: {
      ...card.definition,
      effects: onGain as unknown as CardInstance['definition']['effects'],
    },
  };
}

export function wantsGainBandingBonusChoice(card: CardInstance): boolean {
  const raw = getRawEffects(card).gain_banding_bonus;
  return raw === 'choose_faction' || raw === true;
}

export function shouldDeferGalleryRefill(card: CardInstance): boolean {
  return getRawEffects(card).replace_gallery_at === 'end_of_turn';
}

export function shouldDeferEpicRefill(card: CardInstance): boolean {
  return getRawEffects(card).replace_epic_at === 'end_of_turn';
}

const ARENA_ONLY_OR_KEYS = new Set([
  'arena_sabotage',
  'arena_support',
  'arena_bonus_valor',
  'gain_valor',
]);

function branchIsArenaOnly(branch: Record<string, unknown>): boolean {
  const keys = Object.keys(branch).filter((k) => {
    const v = branch[k];
    return v != null && v !== false && v !== 0 && !(Array.isArray(v) && v.length === 0);
  });
  return keys.length > 0 && keys.every((k) => ARENA_ONLY_OR_KEYS.has(k));
}

/** Main-phase play uses base effect; arena OR branches resolve in arena only. */
export function skipOrChoiceOnMainPlay(card: CardInstance): boolean {
  const raw = getRawEffects(card);
  const branches = raw.or_effects as Record<string, unknown>[] | undefined;
  if (!Array.isArray(branches) || branches.length === 0) return false;

  if (branches.every(branchIsArenaOnly)) return true;

  if (branches.length === 1) {
    const branch = branches[0];
    if (typeof branch.arena_bonus_valor === 'number') {
      const baseDraw = (raw.draw_cards as number) ?? 0;
      const baseCoins = (raw.gain_coins as number) ?? 0;
      return baseDraw > 0 && baseCoins === 0 && !!branch.draw_cards;
    }
  }
  return false;
}

export function getOptionalPlaceDestroyedOnMarket(card: CardInstance): boolean {
  const opt = getRawEffects(card).optional;
  if (!opt || typeof opt !== 'object') return false;
  return !!(opt as Record<string, unknown>).place_destroyed_on_market;
}

export function getSabotageArenaBonus(card: CardInstance): number {
  const branches = getRawEffects(card).or_effects as Record<string, unknown>[] | undefined;
  if (!Array.isArray(branches) || branches.length === 0) return 0;
  for (const branch of branches) {
    if (typeof branch.arena_bonus_valor === 'number') {
      return branch.arena_bonus_valor;
    }
  }
  return (getRawEffects(card).arena_bonus_valor as number) ?? 0;
}

export function getSabotageDrawCards(card: CardInstance): number {
  const branches = getRawEffects(card).or_effects as Record<string, unknown>[] | undefined;
  if (!Array.isArray(branches)) return 0;
  for (const branch of branches) {
    if (typeof branch.draw_cards === 'number') return branch.draw_cards;
  }
  return 0;
}

export function isGratiaCard(
  card: CardInstance | Pick<CardInstance, 'definitionId' | 'definition'>
): boolean {
  const id = card.definitionId ?? card.definition?.id;
  return id === GRATIA_SUPPLY.id;
}

export function isCoinOnlyPlayCard(card: CardInstance): boolean {
  if (isCharityCard(card) || isGratiaCard(card)) return true;
  const raw = getRawEffects(card);
  const coins = (raw.gain_coins as number) ?? 0;
  if (coins <= 0) return false;

  for (const [key, value] of Object.entries(raw)) {
    if (key === 'gain_coins') continue;
    if (value == null || value === false || value === 0) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    return false;
  }
  return true;
}

function cardMatchesGainType(card: CardInstance, type?: string): boolean {
  if (!type) return true;
  if (type === 'faction') {
    if (card.definition.type === 'Gladiator' || card.definition.type === 'Action') {
      return true;
    }
    if (card.definition.type === 'Basic' && card.definition.faction !== 'Favor') {
      return true;
    }
    return false;
  }
  if (type === 'item') return card.definition.type === 'Item';
  return true;
}

function cardMatchesGainFaction(card: CardInstance, faction?: Faction): boolean {
  if (!faction) return true;
  return getCardEffectiveFaction(card) === faction;
}

export function isCardEligibleForGainPick(
  card: CardInstance,
  spec: Pick<GainCardSpec, 'maxCost' | 'type' | 'faction'>
): boolean {
  const maxCost = spec.maxCost ?? Infinity;
  if ((card.definition.cost ?? 0) > maxCost) return false;
  if (!cardMatchesGainType(card, spec.type)) return false;
  return cardMatchesGainFaction(card, spec.faction);
}

export function listEligibleMarketGainCards(
  state: GameState,
  spec: GainCardSpec,
  isGalleryAvailable: (instanceId: string) => boolean
): CardInstance[] {
  const maxCost = spec.maxCost ?? Infinity;
  const results: CardInstance[] = [];

  if (spec.source === 'market' || spec.source === 'market_or_epic') {
    for (const card of state.galleryCards) {
      if (!isGalleryAvailable(card.instanceId)) continue;
      if (isGalleryEventCard(card)) continue;
      if ((card.definition.cost ?? 0) > maxCost) continue;
      if (!cardMatchesGainType(card, spec.type)) continue;
      if (!cardMatchesGainFaction(card, spec.faction)) continue;
      results.push(card);
    }

    const recruit = state.recruitCard;
    if (
      recruit &&
      (recruit.definition.cost ?? 0) <= maxCost &&
      cardMatchesGainType(recruit, spec.type) &&
      cardMatchesGainFaction(recruit, spec.faction)
    ) {
      results.push(recruit);
    }
  }

  if (spec.source === 'market_or_epic') {
    for (const card of state.epicCards) {
      if ((card.definition.cost ?? 0) > maxCost) continue;
      results.push(card);
    }
  }

  return results;
}

export function listEligibleDestroyedGainCards(
  state: GameState,
  spec: GainCardSpec
): CardInstance[] {
  if (spec.source !== 'destroyed_pile') return [];
  const maxCost = spec.maxCost ?? Infinity;
  return (state.destroyedPile ?? []).filter((card) => {
    if ((card.definition.cost ?? 0) > maxCost) return false;
    if (!cardMatchesGainType(card, spec.type)) return false;
    return cardMatchesGainFaction(card, spec.faction);
  });
}

export function wantsDeckTopRevealPick(card: CardInstance): boolean {
  const raw = getRawEffects(card).reveal_all_player_deck_tops as
    | { destroy_or_return?: boolean }
    | undefined;
  return raw?.destroy_or_return === true;
}

export function listEligibleDestroyedPlaceCards(state: GameState): CardInstance[] {
  return [...(state.destroyedPile ?? [])];
}

export function listEligibleMarketCopyCards(
  state: GameState,
  spec: CopyCardSpec,
  isGalleryAvailable: (instanceId: string) => boolean
): CardInstance[] {
  const maxCost = spec.maxCost ?? Infinity;
  if (spec.source !== 'market' && spec.source !== 'market_or_epic') return [];

  const gallery = state.galleryCards.filter((card) => {
    if (!isGalleryAvailable(card.instanceId)) return false;
    if (isGalleryEventCard(card)) return false;
    return (card.definition.cost ?? 0) <= maxCost;
  });

  if (spec.source === 'market_or_epic') {
    const epics = state.epicCards.filter(
      (card) => (card.definition.cost ?? 0) <= maxCost
    );
    return [...gallery, ...epics];
  }
  return gallery;
}

export function listEligibleInPlayCopyCards(
  state: GameState,
  spec: CopyCardSpec,
  excludeInstanceId?: string
): CardInstance[] {
  const maxCost = spec.maxCost ?? Infinity;
  if (spec.source !== 'in_play') return [];

  const results: CardInstance[] = [];
  for (const player of state.players) {
    for (const card of [...player.playArea, ...player.itemsInPlay]) {
      if (excludeInstanceId && card.instanceId === excludeInstanceId) continue;
      if ((card.definition.cost ?? 0) > maxCost) continue;
      results.push(card);
    }
  }
  return results;
}

export function getPlaceCardOnDeckSpec(card: CardInstance): {
  source: 'discard';
  faction?: Faction;
  anyFaction?: boolean;
  position: 'top' | 'bottom';
  optional: boolean;
} | null {
  const raw = getRawEffects(card);
  const optionalBlock = raw.optional as Record<string, unknown> | undefined;
  const fromOptional = optionalBlock?.place_card_on_deck;
  const direct = raw.place_card_on_deck;
  const spec = fromOptional ?? direct;
  if (!spec || typeof spec !== 'object') return null;

  const record = spec as Record<string, unknown>;
  const factionRaw = record.faction as string | undefined;
  const optional =
    fromOptional != null || /\bmay\b/i.test(card.definition.text ?? '');

  return {
    source: 'discard',
    faction:
      factionRaw === 'any_faction'
        ? undefined
        : normalizeGainCardFaction(factionRaw),
    anyFaction: factionRaw === 'any_faction',
    position: (record.position as 'top' | 'bottom') ?? 'top',
    optional,
  };
}

export function listEligiblePlaceOnDeckCards(
  player: PlayerState,
  spec: NonNullable<ReturnType<typeof getPlaceCardOnDeckSpec>>
): CardInstance[] {
  return player.discard.filter((card) => {
    if (!countsAsFactionMember(card)) return false;
    if (spec.anyFaction || !spec.faction) {
      const faction = getCardEffectiveFaction(card);
      return faction === 'Legion' || faction === 'Ludus' || faction === 'Senate';
    }
    return getCardEffectiveFaction(card) === spec.faction;
  });
}

export function getDeckVpPerFactionPassive(card: CardInstance): {
  faction: string;
  per: number;
} | null {
  const passive = getRawEffects(card).passive as Record<string, unknown> | undefined;
  const spec = passive?.deck_vp_per_faction as
    | { faction: string; per: number }
    | undefined;
  if (!spec?.faction) return null;
  return { faction: spec.faction, per: spec.per ?? 1 };
}

export function countFactionCardsInDeck(
  cards: CardInstance[],
  faction: string
): number {
  return cards.filter((c) => {
    if (!countsAsFactionMember(c)) return false;
    if (c.definition.faction === faction) return true;
    return getCardEffectiveFaction(c) === faction;
  }).length;
}
