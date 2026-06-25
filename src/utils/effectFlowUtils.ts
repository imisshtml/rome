import type { CardInstance } from '../types/cardTypes';
import type { GameState } from '../types/gameTypes';
import { GRATIA_SUPPLY, isGalleryEventCard } from '../game/CardCatalog';
import { getCardEffectiveFaction, isCharityCard } from './cardFactionUtils';
import { getRawEffects } from './playDestroyUtils';

export type GainCardSpec = {
  maxCost?: number;
  source: 'market' | 'market_or_epic' | 'destroyed_pile' | 'favor_discard';
  type?: 'faction' | 'item' | 'imperial_favor';
};

export type CopyCardSpec = {
  source: 'market' | 'in_play';
  maxCost?: number;
};

export function getGainCardSpec(card: CardInstance): GainCardSpec | null {
  const raw = getRawEffects(card).gain_card;
  if (!raw) return null;
  if (typeof raw === 'object') return raw as GainCardSpec;
  return { source: 'market' };
}

export function getCopyCardSpec(card: CardInstance): CopyCardSpec | null {
  const raw = getRawEffects(card).copy_card;
  if (!raw) return null;
  if (raw === true) return { source: 'in_play' };
  if (typeof raw === 'object') return raw as CopyCardSpec;
  return null;
}

export function getLookAtTopCount(card: CardInstance): number {
  return (getRawEffects(card).look_at_top_cards as number) ?? 0;
}

export function wantsGainBandingBonusChoice(card: CardInstance): boolean {
  const raw = getRawEffects(card).gain_banding_bonus;
  return raw === 'choose_faction' || raw === true;
}

export function shouldDeferGalleryRefill(card: CardInstance): boolean {
  return getRawEffects(card).replace_gallery_at === 'end_of_turn';
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
    return card.definition.type === 'Gladiator' || card.definition.type === 'Action';
  }
  if (type === 'item') return card.definition.type === 'Item';
  return true;
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
      results.push(card);
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
    return cardMatchesGainType(card, spec.type);
  });
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
  if (spec.source !== 'market') return [];

  return state.galleryCards.filter((card) => {
    if (!isGalleryAvailable(card.instanceId)) return false;
    if (isGalleryEventCard(card)) return false;
    return (card.definition.cost ?? 0) <= maxCost;
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
    if (c.definition.faction === faction) return true;
    return getCardEffectiveFaction(c) === faction;
  }).length;
}
