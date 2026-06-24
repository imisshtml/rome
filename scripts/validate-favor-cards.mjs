#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  FAVOR_EFFECT_SPECS,
  FAVOR_IMAGE_FILES,
} from './favor-effect-specs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const favorPath = path.join(root, 'cards_favor.json');
const imagesDir = path.join(root, 'src/assets/images');

const cards = JSON.parse(fs.readFileSync(favorPath, 'utf8'));

const ENGINE_READY = new Set([
  'gain_coins',
  'draw_cards',
  'discard_cards',
  'force_opponent_discard',
  'gain_gratia',
]);

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

let errors = 0;
let pending = 0;

console.log('=== Favor card validation ===\n');

const ids = new Set();
for (const card of cards) {
  if (ids.has(card.id)) {
    console.log(`DUPLICATE ID: ${card.id}`);
    errors++;
  }
  ids.add(card.id);

  const spec = FAVOR_EFFECT_SPECS[card.id];
  if (!spec) {
    console.log(`MISSING SPEC: ${card.id}`);
    errors++;
    continue;
  }

  if (!card.effect_text?.trim()) {
    console.log(`${card.id}: missing effect_text`);
    errors++;
  }

  if (!deepEqual(card.effects ?? {}, spec.effects)) {
    console.log(`${card.name} (${card.id}): effects mismatch`);
    console.log(`  expected: ${JSON.stringify(spec.effects)}`);
    console.log(`  actual:   ${JSON.stringify(card.effects)}`);
    errors++;
    continue;
  }

  const expectedImage = FAVOR_IMAGE_FILES[card.id];
  if (card.image !== expectedImage) {
    console.log(`${card.id}: image expected ${expectedImage}, got ${card.image}`);
    errors++;
  } else if (!fs.existsSync(path.join(imagesDir, 'favor', card.image))) {
    console.log(`${card.id}: image file missing: favor/${card.image}`);
    errors++;
  }

  const effectKeys = Object.keys(card.effects ?? {});
  const worksNow = effectKeys.every((k) => ENGINE_READY.has(k));
  if (worksNow) {
    console.log(`OK  ${card.name} (qty ${card.deck_qty}) → ${spec.engine}`);
  } else {
    console.log(`PENDING  ${card.name} → ${spec.engine}`);
    pending++;
  }
}

const specIds = Object.keys(FAVOR_EFFECT_SPECS);
for (const id of specIds) {
  if (!ids.has(id)) {
    console.log(`MISSING CARD IN JSON: ${id}`);
    errors++;
  }
}

const totalQty = cards.reduce((n, c) => n + (c.deck_qty ?? 1), 0);
console.log(`\n${cards.length} favor types, ${totalQty} cards in deck`);
console.log(`${errors} error(s), ${pending} pending engine handler(s)`);
process.exit(errors > 0 ? 1 : 0);
