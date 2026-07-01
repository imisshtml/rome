import type { CardInstance, Faction } from '../types/cardTypes';
import { getRawEffects } from './playDestroyUtils';

export type ItemActivation = 'tap' | 'destroy' | 'passive';

type ItemBlock = {
  activation?: ItemActivation;
  tap?: Record<string, unknown>;
  destroyed?: Record<string, unknown>;
};

function getItemBlock(card: CardInstance): ItemBlock | null {
  const raw = getRawEffects(card).item as ItemBlock | undefined;
  if (!raw || typeof raw !== 'object') return null;
  return raw;
}

export function isItemCard(card: CardInstance): boolean {
  return card.definition.type === 'Item';
}

export function getItemActivation(card: CardInstance): ItemActivation | null {
  return getItemBlock(card)?.activation ?? null;
}

/** Item can be manually triggered (tap or destroy) by its owner. */
export function isActivatableItem(card: CardInstance): boolean {
  const activation = getItemActivation(card);
  return activation === 'tap' || activation === 'destroy';
}

export interface ItemTapSpec {
  flipGalleryFacedown?: number;
  revealTopDrawMaxCost?: number;
  gainFavor?: number;
}

export function getItemTapSpec(card: CardInstance): ItemTapSpec | null {
  const block = getItemBlock(card);
  if (!block || block.activation !== 'tap' || !block.tap) return null;
  const tap = block.tap;
  const reveal = tap.reveal_top_optional_draw as
    | { max_cost?: number }
    | undefined;
  return {
    flipGalleryFacedown:
      typeof tap.flip_gallery_facedown === 'number'
        ? tap.flip_gallery_facedown
        : undefined,
    revealTopDrawMaxCost:
      reveal && typeof reveal.max_cost === 'number' ? reveal.max_cost : undefined,
    gainFavor: typeof tap.gain_favor === 'number' ? tap.gain_favor : undefined,
  };
}

export interface ItemDestroySpec {
  gainCardFaction?: Faction;
  discardHandDraw?: number;
  epicDiscount?: number;
  shuffleBack: boolean;
}

export function getItemDestroySpec(card: CardInstance): ItemDestroySpec | null {
  const block = getItemBlock(card);
  if (!block || block.activation !== 'destroy' || !block.destroyed) return null;
  const d = block.destroyed;
  const gainCard = d.gain_card as { faction?: string } | undefined;
  return {
    gainCardFaction: gainCard?.faction as Faction | undefined,
    discardHandDraw:
      typeof d.discard_hand_draw === 'number' ? d.discard_hand_draw : undefined,
    epicDiscount:
      typeof d.epic_discount === 'number' ? d.epic_discount : undefined,
    shuffleBack: d.shuffle_back === true,
  };
}

function getPassive(card: CardInstance): Record<string, unknown> | null {
  const passive = getRawEffects(card).passive as
    | Record<string, unknown>
    | undefined;
  return passive ?? null;
}

export function itemCoinsPerTurn(card: CardInstance): number {
  const passive = getPassive(card);
  return typeof passive?.coins_per_turn === 'number' ? passive.coins_per_turn : 0;
}

export function itemExtraDrawTurnEnd(card: CardInstance): number {
  const passive = getPassive(card);
  return typeof passive?.extra_draw_turn_end === 'number'
    ? passive.extra_draw_turn_end
    : 0;
}

export function itemArenaValorBonus(card: CardInstance): number {
  const passive = getPassive(card);
  return typeof passive?.arena_valor_bonus === 'number'
    ? passive.arena_valor_bonus
    : 0;
}

export function itemTriggersRandomEventTurnStart(card: CardInstance): boolean {
  return getPassive(card)?.random_event_turn_start === true;
}

/** Total passive per-turn coins from a player's items in play. */
export function sumItemCoinsPerTurn(items: CardInstance[]): number {
  return items.reduce((sum, c) => sum + itemCoinsPerTurn(c), 0);
}

/** Total extra end-of-turn draws from a player's items in play. */
export function sumItemExtraDrawTurnEnd(items: CardInstance[]): number {
  return items.reduce((sum, c) => sum + itemExtraDrawTurnEnd(c), 0);
}

/** Total passive arena valor bonus from a player's items in play. */
export function sumItemArenaValorBonus(items: CardInstance[]): number {
  return items.reduce((sum, c) => sum + itemArenaValorBonus(c), 0);
}
