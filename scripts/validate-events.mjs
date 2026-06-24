#!/usr/bin/env node
/**
 * Validates cards_events.json effect_text vs effect_legacy vs engine handlers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'cards_events.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

/** Expected legacy keys per event id — mirrors EventResolver.ts handlers. */
const EVENT_SPECS = {
  event_bread_and_circuses: {
    handler: 'instant: carryCoins (+1 next turn)',
    required: { all_players_gain_coins: 1, next_turn: true },
  },
  event_senate_decree: {
    handler: 'instant: reveal top 2, draw cost≥5, destroy cost≤4',
    required: {
      reveal_top_cards: 2,
      draw_if_cost_gte: 5,
      destroy_if_cost_lte: 4,
    },
  },
  event_barbarian_incursion: {
    handler: 'interactive: optional discard for coins',
    required: { optional_discard_for_coins: 2 },
  },
  event_plague_spreads: {
    handler: 'interactive: destroy 1 from hand',
    required: { all_players_destroy_from_hand: 1 },
  },
  event_triumph_of_rome: {
    handler: 'instant: random gallery card + Gratia = cost',
    required: {
      all_players_gain_random_gallery_card: true,
      gain_gratia_matching_card_cost: true,
    },
  },
  event_grain_shortage: {
    handler: 'instant: max purchase cost 3 for next player turn',
    required: { temporary_max_purchase_cost: 3 },
  },
  event_temple_omen: {
    handler: 'instant: all draw 1',
    required: { all_players_draw: 1 },
  },
  event_slave_revolt: {
    handler: 'instant: destroy lowest gallery (ties all)',
    required: { destroy_lowest_gallery_card: true },
  },
  event_imperial_tax: {
    handler: 'instant: imperialTaxPending (-1 coin next turn)',
    required: { all_players_lose_coins: 1, next_turn: true },
  },
  event_military_tribute: {
    handler: 'instant: all gain 1 Favor',
    required: { all_players_gain_favor: 1 },
  },
};

let errors = 0;

console.log('=== Gallery event validation ===\n');

for (const card of data.cards) {
  const spec = EVENT_SPECS[card.id];
  if (!spec) {
    console.log(`UNKNOWN EVENT ID: ${card.id}`);
    errors++;
    continue;
  }

  const legacy = card.effect_legacy ?? {};
  const missing = Object.entries(spec.required).filter(
    ([key, val]) => legacy[key] !== val
  );

  if (!card.effect_text?.trim()) {
    console.log(`${card.id}: missing effect_text`);
    errors++;
  }

  if (missing.length > 0) {
    console.log(`${card.name} (${card.id}): legacy mismatch`);
    for (const [key, val] of missing) {
      console.log(`  ${key}: expected ${JSON.stringify(val)}, got ${JSON.stringify(legacy[key])}`);
    }
    errors++;
  } else {
    console.log(`OK  ${card.name} → ${spec.handler}`);
  }
}

console.log(`\n${data.cards.length} events, ${errors} error(s)`);
process.exit(errors > 0 ? 1 : 0);
