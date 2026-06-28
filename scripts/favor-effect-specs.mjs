/**
 * Expected structured effects for each favor card (from effect_text).
 * Used by scripts/validate-favor-cards.mjs
 */
export const FAVOR_EFFECT_SPECS = {
  favor_bread_circuses: {
    engine: 'play: gain_coins',
    effects: { gain_coins: 2 },
  },
  favor_mars: {
    engine: 'play: draw_cards',
    effects: { draw_cards: 3 },
  },
  favor_boast: {
    engine: 'play: draw_cards',
    effects: { draw_cards: 1 },
  },
  favor_patrons_donation: {
    engine: 'play: gain_coins',
    effects: { gain_coins: 3 },
  },
  favor_slave_revolt: {
    engine: 'play: optional destroy (pending)',
    effects: {
      optional: true,
      destroy_cards: 1,
      destroy_from: ['hand', 'discard'],
    },
  },
  favor_military_tribute: {
    engine: 'play: gain_card (pending)',
    effects: {
      gain_card: { faction: 'legion', max_cost: 5, source: 'market' },
    },
  },
  favor_senate_decree: {
    engine: 'play: gain_card (pending)',
    effects: {
      gain_card: { faction: 'senate', max_cost: 5, source: 'market' },
    },
  },
  favor_ludus_recruitment: {
    engine: 'play: gain_card (pending)',
    effects: {
      gain_card: { faction: 'ludus', max_cost: 5, source: 'market' },
    },
  },
  favor_hidden_stash: {
    engine: 'play: gain_coins + draw',
    effects: { gain_coins: 2, draw_cards: 1 },
  },
  favor_oracles_warning: {
    engine: 'play: look/reorder deck (pending)',
    effects: { look_at_top_cards: 3, reorder_top_cards: true },
  },
  favor_veterans_advice: {
    engine: 'play: draw + discard prompt',
    effects: { draw_cards: 2, discard_cards: 1 },
  },
  favor_spoils_of_victory: {
    engine: 'play: destroy opponent hand pick (pending)',
    effects: { destroy_opponent_hand_card: { each_opponent: true } },
  },
  favor_imperial_tax: {
    engine: 'play: force_opponent_discard all',
    effects: { force_opponent_discard: 1 },
  },
  favor_arena_wager: {
    engine: 'play: arena_wager pick + reveal',
    effects: { arena_wager: true },
  },
  favor_merchant_caravan: {
    engine: 'play: gain_coins',
    effects: { gain_coins: 4 },
  },
  favor_triumphal_parade: {
    engine: 'play: gain_gratia',
    effects: { gain_gratia: 1 },
  },
  favor_temple_blessing: {
    engine: 'play: gain_gratia + draw',
    effects: { gain_gratia: 1, draw_cards: 1 },
  },
  favor_black_market_deal: {
    engine: 'play: gain_card + discard (partial)',
    effects: {
      gain_card: { max_cost: 5, source: 'market' },
      discard_cards: 1,
    },
  },
  favor_gladiators_funeral: {
    engine: 'play: destroy then gain (pending)',
    effects: {
      destroy_cards: 1,
      destroy_from: ['hand', 'play_area'],
      gain_card: {
        source: 'market_or_epic',
        dynamic: 'destroyed_cost_plus_2',
      },
    },
  },
  favor_crowd_frenzy: {
    engine: 'play: deck-top swap (pending)',
    effects: {
      destroy_each_player_deck_top: true,
      replace_from_market_matching_cost: true,
    },
  },
};

export const FAVOR_IMAGE_FILES = {
  favor_bread_circuses: 'favor_bread_circus.jpg',
  favor_mars: 'favor_mars.jpg',
  favor_boast: 'favor_boast.jpg',
  favor_patrons_donation: 'favor_spoils.jpg',
  favor_slave_revolt: 'favor_revolt.jpg',
  favor_military_tribute: 'favor_legion_tribute.jpg',
  favor_senate_decree: 'favor_senate_control.jpg',
  favor_ludus_recruitment: 'favor_ludus_recruits.jpg',
  favor_hidden_stash: 'favor_hidden_stash.jpg',
  favor_oracles_warning: 'favor_oracle.jpg',
  favor_veterans_advice: 'favor_advice.jpg',
  favor_spoils_of_victory: 'favor_spoils_of_war.jpg',
  favor_imperial_tax: 'favor_imperial_tax.jpg',
  favor_arena_wager: 'favor_wager.jpg',
  favor_merchant_caravan: 'favor_merchants.jpg',
  favor_triumphal_parade: 'favor_parade.jpg',
  favor_temple_blessing: 'favor_temple_blessing.jpg',
  favor_black_market_deal: 'favor_black_market.jpg',
  favor_gladiators_funeral: 'favor_pyre.jpg',
  favor_crowd_frenzy: 'favor_crowd.jpg',
};
