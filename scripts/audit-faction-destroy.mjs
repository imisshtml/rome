#!/usr/bin/env node
/**
 * Reports destroy-related faction/epic effects and engine support status.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cards = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'cards_factions.json'), 'utf8')
).cards;

const IMPLEMENTED = new Set([
  'destroy_cards_hand_discard', // top-level destroy_cards + hand/discard/play_area
  'destroy_cards_optional_may', // top-level + "may" in text
  'destroy_cards_optional_nested', // effects.optional.destroy_cards
  'destroy_gallery_cards',
  'destroy_hand_for_coins',
  'destroy_any_discard',
  'or_effects_destroy',
  'on_gain_destroy',
]);

function classify(card) {
  const fx = card.effects ?? {};
  const text = card.effect_text ?? '';

  if (fx.on_gain?.destroy_cards) {
    return { kind: 'on_gain_destroy', status: IMPLEMENTED.has('on_gain_destroy') ? 'ok' : 'missing' };
  }
  if (fx.or_effects?.some((b) => b.destroy_cards)) {
    return { kind: 'or_effects_destroy', status: IMPLEMENTED.has('or_effects_destroy') ? 'ok' : 'missing' };
  }
  if (fx.optional?.destroy_cards || fx.optional?.destroy_disfavor) {
    return { kind: 'destroy_cards_optional_nested', status: IMPLEMENTED.has('destroy_cards_optional_nested') ? 'ok' : 'missing' };
  }
  if (fx.destroy_hand_for_coins) {
    return { kind: 'destroy_hand_for_coins', status: IMPLEMENTED.has('destroy_hand_for_coins') ? 'ok' : 'missing' };
  }
  if ((fx.destroy_gallery_cards ?? 0) > 0) {
    return { kind: 'destroy_gallery_cards', status: IMPLEMENTED.has('destroy_gallery_cards') ? 'ok' : 'missing' };
  }
  if (fx.destroy_cards && fx.destroy_from?.includes('any_discard')) {
    return { kind: 'destroy_any_discard', status: IMPLEMENTED.has('destroy_any_discard') ? 'ok' : 'missing' };
  }
  if ((fx.destroy_cards ?? 0) > 0 && fx.destroy_from?.length) {
    const optional = /\bmay\b/i.test(text);
    const kind = optional ? 'destroy_cards_optional_may' : 'destroy_cards_hand_discard';
    return { kind, status: IMPLEMENTED.has(kind) ? 'ok' : 'missing' };
  }
  if (/destroy/i.test(text)) {
    return { kind: 'other_destroy_text', status: 'missing' };
  }
  return null;
}

const rows = [];
for (const card of cards) {
  const hit = classify(card);
  if (hit) rows.push({ id: card.id, name: card.name, ...hit, text: card.effect_text?.slice(0, 70) });
}

const missing = rows.filter((r) => r.status === 'missing');
const ok = rows.filter((r) => r.status === 'ok');

console.log(`Destroy-related cards: ${rows.length}`);
console.log(`Implemented: ${ok.length}`);
console.log(`Missing: ${missing.length}\n`);

for (const r of missing) {
  console.log(`[MISSING] ${r.id} ${r.name} (${r.kind})`);
  console.log(`  ${r.text}`);
}

if (missing.length > 0) process.exit(1);
