#!/usr/bin/env node
/**
 * Validates cards_factions.json effects against effect_text and engine support.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FACTION_EFFECT_OVERRIDES } from './faction-effect-overrides.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'cards_factions.json');

const ENGINE_PLAY_EFFECTS = new Set([
  'gain_coins',
  'gain_valor',
  'gain_vp',
  'draw_cards',
  'discard_cards',
  'force_opponent_discard',
]);

const ENGINE_PARTIAL = new Set([
  'choose_faction_on_play',
  'next_card_to_hand',
  'discount_epics',
  'arena_bonus_valor',
]);

function collectEffectKeys(obj, prefix = '') {
  const keys = new Set();
  if (!obj || typeof obj !== 'object') return keys;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'or_effects' || k === 'optional' || k === 'conditional' || k === 'on_gain') {
      keys.add(k);
      collectEffectKeys(v, `${prefix}${k}.`).forEach((x) => keys.add(x));
      if (Array.isArray(v)) v.forEach((item) => collectEffectKeys(item).forEach((x) => keys.add(x)));
      continue;
    }
    keys.add(k);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      collectEffectKeys(v, `${prefix}${k}.`).forEach((x) => keys.add(x));
    }
  }
  return keys;
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const cards = data.cards.filter(
  (c) =>
    c.card_type === 'faction' ||
    c.card_type === 'epic' ||
    c.card_type === 'basic' ||
    c.id.startsWith('ALL-')
);

let missing = 0;
let overrideMismatch = 0;
let unimplemented = 0;

console.log('=== Faction / Epic effect validation ===\n');

for (const card of cards) {
  if (!card.effect_text?.trim()) continue;

  const expected = FACTION_EFFECT_OVERRIDES[card.id];
  const actual = card.effects;

  if (!actual || Object.keys(actual).length === 0) {
    console.log(`MISSING effects: ${card.id} ${card.name}`);
    console.log(`  text: ${card.effect_text}`);
    missing++;
    continue;
  }

  if (expected && JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.log(`OVERRIDE MISMATCH: ${card.id}`);
    console.log(`  expected: ${JSON.stringify(expected)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
    overrideMismatch++;
  }

  const keys = collectEffectKeys(actual);
  const notPlayReady = [...keys].filter(
    (k) => !ENGINE_PLAY_EFFECTS.has(k) && !ENGINE_PARTIAL.has(k)
  );
  if (notPlayReady.length > 0) {
    unimplemented++;
  }
}

console.log(`\nCards checked: ${cards.length}`);
console.log(`Missing effects: ${missing}`);
console.log(`Override mismatches: ${overrideMismatch}`);
console.log(`Cards with unimplemented play logic: ${unimplemented}`);

if (missing > 0 || overrideMismatch > 0) {
  process.exit(1);
}
