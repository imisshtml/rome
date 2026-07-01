/**
 * Hand-tuned structured effects keyed by card id.
 * Overrides auto-parsed effects when effect_text is conditional, passive, or multi-step.
 */
export const FACTION_EFFECT_OVERRIDES = {
  'ALL-002': { choose_faction_on_play: true },

  'LEG-002': {
    gain_coins: 2,
    on_gain: {
      destroy_cards: 2,
      destroy_from: ['hand', 'discard'],
      optional: true,
    },
  },
  'LEG-003': {
    gain_coins: 1,
    or_effects: [{ destroy_cards: 1, destroy_from: ['hand', 'discard'], draw_cards: 1 }],
  },
  'LEG-006': {
    draw_cards: 2,
    or_effects: [{ draw_cards: 2, arena_bonus_valor: -2 }],
  },
  'LEG-010': {
    gain_coins: 2,
    passive: { deck_vp_per_faction: { faction: 'Legion', per: 1 } },
  },
  'LEG-011': {
    gain_coins: 2,
    conditional: {
      if_played_factions: ['Ludus', 'Senate'],
      draw_cards: 1,
    },
  },
  'LEG-012': {
    gain_card: { max_cost: 4, source: 'market', type: 'faction' },
  },
  'LEG-013': { force_opponent_discard: 2 },
  'LEG-015': {
    gain_coins: 4,
    passive: { sabotage_on_fail_destroy_challenger: true },
  },
  'LEG-016': { gain_coins: 1, gain_banding_bonus: 'choose_faction' },
  'LEG-017': { allow_fourth_arena_participant: true },
  'LEG-019': {
    on_gain: {
      draw_cards: 1,
      gain_card: { max_cost: 5, source: 'market', type: 'faction' },
    },
  },
  'LEG-020': {
    gain_coins: 2,
    passive: { reduce_sabotage_valor: 1 },
  },
  'LEG-021': { gain_coins: 3, discount_faction_cost: 1 },
  'LEG-022': {
    gain_coins: 2,
    play_market_top: { destroy_at_end_of_turn: true },
  },
  'LEG-023': {
    gain_coins: 3,
    optional: {
      destroy_cards: 1,
      destroy_from: ['hand', 'discard'],
      then_gain_card: { source: 'market', dynamic: 'destroyed_cost_plus_1' },
    },
  },
  'LEG-025': {
    gain_coins: 2,
    place_card_on_deck: { source: 'discard', faction: 'legion', position: 'top' },
  },
  'LEG-026': {
    gain_card: { max_cost: 4, source: 'market' },
    destroy_gallery_cards: 1,
  },

  'SEN-005': {
    gain_item: { max_cost: 4, source: 'market', type: 'item' },
  },
  'SEN-006': {
    copy_card: { source: 'in_play', max_cost: 5 },
  },
  'SEN-007': {
    gain_coins: 2,
    play_opponent_random: { destroy_at_end_of_turn: true },
  },
  'SEN-008': {
    gain_coins: 4,
    or_effects: [{ arena_decree_on_defeat: true }],
  },
  'SEN-009': { passive: { skip_arena_participation: true } },
  'SEN-010': {
    gain_coins: 1,
    conditional: { if_played_faction: 'Senate', gain_coins: 3 },
  },
  'SEN-011': {
    gain_coins: 2,
    optional: { place_destroyed_on_market: true },
  },
  'SEN-012': {
    gain_coins: 2,
    flip_market_face_down: { count: 2, until: 'next_turn' },
  },
  'SEN-013': {
    gain_coins: 2,
    conditional: {
      if_played_factions: ['Legion', 'Ludus'],
      gain_coins: 2,
    },
  },
  'SEN-014': {
    gain_coins: 2,
    or_effects: [{ arena_bonus_valor: -3 }],
  },
  'SEN-015': {
    gain_coins: 1,
    or_effects: [{ destroy_cards: 1, destroy_from: ['hand', 'discard'], gain_coins: 2 }],
  },
  'SEN-017': { gain_gratia_on_arena_victory: 2 },
  'SEN-018': {
    gain_coins: 2,
    or_effects: [{ gain_item: { max_cost: 4, source: 'market', type: 'item' } }],
  },
  'SEN-019': {
    gain_coins: 2,
    passive: { deck_vp_per_faction: { faction: 'Senate', per: 1 } },
  },
  'SEN-021': {
    gain_coins: 2,
    gain_item: { max_cost: 5, source: 'market', type: 'item' },
  },
  'SEN-022': {
    gain_coins: 2,
    destroy_hand_for_coins: { source: 'hand' },
  },
  'SEN-023': {
    mass_hand_redraw: { all_players: true, draw_delta: -1 },
    draw_cards: 2,
  },
  'SEN-025': { gain_coins: 3, discount_item_cost: 2 },
  'SEN-026': { gain_coins: 3, destroy_gallery_cards: 3 },

  'LUD-001': {
    gain_coins: 2,
    optional: {
      place_card_on_deck: { source: 'discard', faction: 'ludus', position: 'top' },
    },
  },
  'LUD-004': {
    gain_coins: 2,
    or_effects: [{ gain_valor: 3, arena_support: true }],
  },
  'LUD-006': {
    gain_coins: 2,
    conditional: {
      if_played_factions: ['Senate', 'Legion'],
      gain_favor: 1,
    },
  },
  'LUD-007': {
    gain_coins: 1,
    or_effects: [{ destroy_cards: 1, destroy_from: ['hand', 'discard'], gain_favor: 1 }],
  },
  'LUD-008': {
    gain_favor: 1,
    gain_valor_per_arena_challenger: 1,
  },
  'LUD-009': {
    gain_coins: 2,
    or_effects: [
      { arena_bonus_valor: -4, arena_sabotage: true },
      { gain_valor: 3, arena_support: true },
    ],
  },
  'LUD-010': {
    gain_card: { max_cost: 4, source: 'destroyed_pile' },
  },
  'LUD-011': {
    gain_coins: 1,
    destroy_gallery_cards: 1,
    replace_gallery_at: 'end_of_turn',
  },
  'LUD-012': {
    gain_coins: 1,
    gain_favor: 1,
    beast_arena_valor_bonus: 2,
  },
  'LUD-013': {
    reveal_favors: { count: 3, pick: 1, discard_rest: 2 },
  },
  'LUD-014': {
    gain_favor: 1,
    gain_card: { max_cost: 5, source: 'destroyed_pile' },
  },
  'LUD-015': {
    gain_coins: 2,
    or_effects: [
      {
        if_first_card_played: true,
        discard_hand: true,
        draw_cards: 5,
      },
    ],
  },
  'LUD-016': {
    passive: {
      opponent_coin_cap_per_card: 1,
      duration: 'opponent_next_turn',
    },
    self_restrictions: { cannot_purchase_cards: true },
  },
  'LUD-017': {
    gain_coins: 2,
    passive: { deck_vp_per_faction: { faction: 'Ludus', per: 1 } },
  },
  'LUD-018': { gain_coins: 3, discount_epics: 1 },
  'LUD-019': {
    copy_card: { source: 'market', max_cost: 6 },
  },
  'LUD-020': { cancel_sabotage: 1 },
  'LUD-021': { passive: { sabotage_immune: true } },
  'LUD-022': {
    gain_coins: 4,
    reveal_all_player_deck_tops: { destroy_or_return: true },
  },
  'LUD-023': {
    gain_coins: 3,
    may_purchase_from_destroyed_pile: true,
  },
  'LUD-025': {
    replay_favor_from_discard: { remove_from_game: true },
  },

  'EPI-001': {
    gain_coins: 3,
    or_effects: [{ gain_coins_per_matching_in_play: { names: ['Clerk', 'Fresh Recruit', 'Novicii'], per: 2 } }],
  },
  'EPI-003': {
    steal_cheapest_from_opponent_hand: true,
  },
  'EPI-004': {
    gain_coins: 3,
    conditional: { if_arena_defeated_this_turn: true, gain_vp: 2 },
  },
  'EPI-006': {
    gain_coins: 3,
    on_gain: { place_card_on_deck: { position: 'top' } },
  },
  'EPI-007': {
    draw_cards: 2,
    optional: {
      destroy_disfavor: { max: 2, zones: ['hand', 'discard'] },
      draw_per_destroyed: 1,
    },
  },
  'EPI-008': {
    gain_coins: 2,
    return_card_to_hand: { source: 'discard', exclude_type: 'epic' },
  },
  'EPI-010': {
    gain_coins: 4,
    gain_banding_bonus: 'choose_faction',
  },
  'EPI-011': {
    gain_coins: 4,
    destroy_gallery_cards: 1,
    then_gain_coins: 5,
  },
  'EPI-012': {
    gain_coins: 2,
    gain_card: { max_cost: 6, source: 'market' },
  },
  'EPI-013': {
    gain_coins: 3,
    optional: { destroy_cards: 1, destroy_from: ['hand'], draw_cards: 1 },
  },
  'EPI-014': {
    gain_coins: 3,
    gain_card: { max_cost: 6, source: 'market' },
  },
  'EPI-015': { gain_coins: 4, next_card_to_hand: true },
  'EPI-016': {
    reveal_favors: { count: 5, pick: 2, discard_rest: 3 },
  },
  'EPI-017': {
    copy_card: { source: 'market_or_epic' },
  },
  'EPI-018': {
    gain_coins: 4,
    copy_card: { source: 'in_play', exclude_type: 'epic' },
  },
};

/** Cards whose `timing` field should be corrected to match effect_text. */
export const TIMING_FIXES = {
  'LUD-018': 'main',
  'LUD-020': 'arena_response',
  'SEN-018': 'main',
  'LUD-022': 'main',
};
