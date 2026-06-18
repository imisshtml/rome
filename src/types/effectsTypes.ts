import type { Faction } from './cardTypes';

/** Universal structured effects — mirrors `effects_schema.json`. */
export interface CardEffects {
  gain_coins: number;
  gain_vp: number;
  gain_imperial_favor: number;
  gain_crowd_disfavor: number;
  gain_valor: number;
  draw_cards: number;
  discard_cards: number;
  destroy_cards: number;
  destroy_from: string[];
  destroy_gallery_cards: number;
  gain_card: string | null;
  gain_item: string | null;
  copy_card: boolean;
  copy_item: boolean;
  consult_augur: boolean;
  arena_bonus_valor: number;
  look_at_top_cards: number;
  reorder_top_cards: boolean;
  return_card_to_hand: string | null;
  place_card_on_deck: string | null;
  counts_as_faction: Faction | null;
  /** Player must pick Ludus/Legion/Senate when this card is played (Spy). */
  choose_faction_on_play: boolean;
  next_card_to_hand: boolean;
  discount_epics: number;
  force_opponent_discard: number;
  discard_item_in_play: number;
  protect_gallery_cards: number;
  gain_banding_bonus: Faction | null;
}

export const DEFAULT_CARD_EFFECTS: CardEffects = {
  gain_coins: 0,
  gain_vp: 0,
  gain_imperial_favor: 0,
  gain_crowd_disfavor: 0,
  gain_valor: 0,
  draw_cards: 0,
  discard_cards: 0,
  destroy_cards: 0,
  destroy_from: [],
  destroy_gallery_cards: 0,
  gain_card: null,
  gain_item: null,
  copy_card: false,
  copy_item: false,
  consult_augur: false,
  arena_bonus_valor: 0,
  look_at_top_cards: 0,
  reorder_top_cards: false,
  return_card_to_hand: null,
  place_card_on_deck: null,
  counts_as_faction: null,
  choose_faction_on_play: false,
  next_card_to_hand: false,
  discount_epics: 0,
  force_opponent_discard: 0,
  discard_item_in_play: 0,
  protect_gallery_cards: 0,
  gain_banding_bonus: null,
};

export function mergeCardEffects(partial?: Partial<CardEffects> | null): CardEffects {
  if (!partial) return { ...DEFAULT_CARD_EFFECTS };
  return {
    ...DEFAULT_CARD_EFFECTS,
    ...partial,
    destroy_from: partial.destroy_from ?? DEFAULT_CARD_EFFECTS.destroy_from,
  };
}
