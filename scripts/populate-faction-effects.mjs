#!/usr/bin/env node
/**
 * Populates sparse `effects` on cards_factions.json from effect_text / effect_keywords.
 * Only writes non-default fields (see effects_schema.json).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  FACTION_EFFECT_OVERRIDES,
  TIMING_FIXES,
} from './faction-effect-overrides.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const filePath = path.join(root, 'cards_factions.json');

const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, a: 1, an: 1 };

function wordToNum(word) {
  if (!word) return null;
  const n = parseInt(word, 10);
  if (!Number.isNaN(n)) return n;
  return WORD_NUM[word.toLowerCase()] ?? null;
}

function normalizeEffectText(text) {
  return text.replace(/\bMarket\b/gi, 'gallery');
}

function parseCoins(text) {
  const destroyPay = text.match(
    /destroy a card from your hand or discard to gain \+(\d+) Coins?/i
  );
  if (destroyPay) return parseInt(destroyPay[1], 10);

  const orCoins = text.match(/\+(\d+) Coins? OR \+(\d+) Coins?/i);
  if (orCoins) return parseInt(orCoins[1], 10);

  const leading = text.match(/^\+(\d+) Coins?/i);
  if (leading) return parseInt(leading[1], 10);

  const anyPlus = text.match(/\+(\d+) Coins?/i);
  if (anyPlus) return parseInt(anyPlus[1], 10);

  return null;
}

function parseDrawCards(text) {
  // Ignore conditional branches after OR
  const primary = text.split(/\s+OR\s+/i)[0];
  let total = 0;
  const re = /draw\s+(\d+|one|two|three|four|a)\s+cards?/gi;
  let m;
  while ((m = re.exec(primary)) !== null) {
    total += wordToNum(m[1]) ?? 0;
  }
  return total || null;
}

function parseDiscardCards(text) {
  const handDiscard = text.match(
    /discard\s+(\d+|one|two|three|a)\s+card(?:s)?(?:\s+from your hand)?/i
  );
  if (handDiscard) return wordToNum(handDiscard[1]);

  const thenDiscard = text.match(/then discard\s+(\d+|one|two|a)\s+card/i);
  if (thenDiscard) return wordToNum(thenDiscard[1]);

  const upTo = text.match(/discard up to\s+(\d+)/i);
  if (upTo && /gallery/i.test(text)) return null; // gallery handled separately

  return null;
}

function parseDestroyFromHandDiscard(text) {
  // Destroy-on-gain is handled separately (on_gain); skip here.
  if (/when gained.*destroy/i.test(text)) return null;

  // When card is an OR choice, only treat destroy in the primary clause as on-play
  const destroyText =
    /\s+OR\s+/i.test(text) ? text.split(/\s+OR\s+/i)[0] : text;

  if (
    /destroy (?:a card|any card|up to \d+ cards?) from (?:your )?hand(?: and\/or discard| or discard)/i.test(
      destroyText
    ) ||
    /destroy a card from your hand or discard/i.test(destroyText) ||
    /you may destroy a card from your hand or discard/i.test(destroyText)
  ) {
    const upTo = text.match(
      /destroy up to\s+(\d+)\s+cards? from your hand/i
    );
    const count = upTo ? parseInt(upTo[1], 10) : 1;
    return { destroy_cards: count, destroy_from: ['hand', 'discard'] };
  }

  if (/destroy any card from any discard pile/i.test(text)) {
    return { destroy_cards: 1, destroy_from: ['any_discard'] };
  }

  if (/destroy a crowd disfavor from your hand or discard/i.test(text)) {
    return { destroy_cards: 1, destroy_from: ['hand', 'discard'] };
  }

  return null;
}

function parseDestroyGallery(text) {
  const normalized = normalizeEffectText(text);
  const upTo = normalized.match(
    /(?:destroy|discard) up to\s+(\d+)\s+cards? in the gallery/i
  );
  if (upTo) return parseInt(upTo[1], 10);

  if (
    /destroy a card in the gallery/i.test(normalized) ||
    /destroy a card from the gallery/i.test(normalized) ||
    /destroy a card in the gallery and replace/i.test(normalized) ||
    /destroy a card in the gallery, replace/i.test(normalized) ||
    /destroy a card in the gallery and gain/i.test(normalized)
  ) {
    return 1;
  }

  if (/then destroy a card in the gallery/i.test(normalized)) return 1;
  if (/draw 1 card, then destroy a card in the gallery/i.test(normalized)) {
    return 1;
  }

  return null;
}

function parseLookAtTop(text) {
  const m = text.match(/look at the top\s+(\d+)\s+cards?/i);
  if (!m) return null;
  const count = parseInt(m[1], 10);
  const reorder =
    /keep one on top|put one on top|put them back in any order|reorder/i.test(
      text
    );
  return { look_at_top_cards: count, reorder_top_cards: reorder || undefined };
}

function parseGainCard(text) {
  const normalized = normalizeEffectText(text);

  const fromDestroyed = text.match(
    /gain a card from the Destroyed Pile costing\s+(\d+) or less/i
  );
  if (fromDestroyed) {
    return {
      max_cost: parseInt(fromDestroyed[1], 10),
      source: 'destroyed_pile',
    };
  }

  const factionFromMarket = normalized.match(
    /gain a Faction card from the gallery costing\s+(\d+) or less/i
  );
  if (factionFromMarket) {
    return {
      max_cost: parseInt(factionFromMarket[1], 10),
      source: 'market',
      type: 'faction',
    };
  }

  const galleryCost = normalized.match(
    /gain a(?:n)?\s+(?:(\w+)\s+)?card(?:s)?(?: from the gallery)? costing\s+(\d+) or less/i
  );
  if (galleryCost) {
    const faction = galleryCost[1]?.toLowerCase();
    const max_cost = parseInt(galleryCost[2], 10);
    const payload = { max_cost, source: 'gallery' };
    if (faction === 'legion' || faction === 'senate' || faction === 'ludus') {
      payload.faction = faction;
    }
    return payload;
  }

  const freeGallery = normalized.match(
    /gain a card costing\s+(\d+) or less from the gallery for free/i
  );
  if (freeGallery) {
    return { max_cost: parseInt(freeGallery[1], 10), source: 'market' };
  }

  const senateGain = normalized.match(
    /gain a card from the gallery costing\s+(\d+) or less/i
  );
  if (senateGain) {
    return {
      max_cost: parseInt(senateGain[1], 10),
      source: 'market',
    };
  }

  const epicGain = normalized.match(
    /gain a card of cost\s+(\d+) or less/i
  );
  if (epicGain) {
    return { max_cost: parseInt(epicGain[1], 10), source: 'market' };
  }

  const marketGain = normalized.match(
    /gain a card from the gallery costing\s+(\d+) or less/i
  );
  if (marketGain) {
    return { max_cost: parseInt(marketGain[1], 10), source: 'market' };
  }

  const conditionalGain = text.match(
    /gain a card costing up to 1 more than the destroyed card/i
  );
  if (conditionalGain) {
    return { source: 'market', dynamic: 'destroyed_cost_plus_1' };
  }

  return null;
}

function parseGainItem(text) {
  const normalized = normalizeEffectText(text);
  const m = normalized.match(
    /gain an item(?: card)?(?: from the gallery)? costing\s+(\d+) or less/i
  );
  if (m) {
    return { max_cost: parseInt(m[1], 10), source: 'market', type: 'item' };
  }
  return null;
}

function parseCountsAsFaction(text) {
  const m = text.match(/count as (\w+) or (\w+) this turn/i);
  if (m) {
    return `${capitalize(m[1])}|${capitalize(m[2])}`;
  }
  return null;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function parseEffects(card) {
  const text = card.effect_text ?? '';
  const keywords = card.effect_keywords ?? [];
  const effects = {};

  if (
    card.id === 'ALL-002' ||
    /choose a faction \[Legion, Ludus, Senate\]/i.test(text)
  ) {
    effects.choose_faction_on_play = true;
  }

  if (/other players must discard\s+(\d+)/i.test(text)) {
    effects.force_opponent_discard = parseInt(
      text.match(/other players must discard\s+(\d+)/i)[1],
      10
    );
  }

  const coins = parseCoins(text);
  if (coins != null) effects.gain_coins = coins;

  if (/consult the augur/i.test(text) || keywords.includes('augury')) {
    effects.consult_augur = true;
  }

  if (/take an imperial favor from the favor discard pile/i.test(text)) {
    effects.gain_imperial_favor = 1;
    effects.gain_card = { type: 'imperial_favor', source: 'favor_discard' };
  }

  if (
    /gain an imperial favor/i.test(text) &&
    !/^take an imperial favor from/i.test(text)
  ) {
    const parts = text.split(/\.\s*OR\s+/i);
    const primary = parts[0];
    if (/gain an imperial favor/i.test(primary)) {
      effects.gain_imperial_favor = 1;
    }
  }

  if (/gain 1 flavor card/i.test(text)) {
    effects.gain_card = { type: 'favor', source: 'flavor_deck' };
  }

  const draw = parseDrawCards(text);
  if (draw) effects.draw_cards = draw;

  const discard = parseDiscardCards(text);
  if (discard) effects.discard_cards = discard;

  const destroySelf = parseDestroyFromHandDiscard(text);
  if (destroySelf) {
    effects.destroy_cards = destroySelf.destroy_cards;
    effects.destroy_from = destroySelf.destroy_from;
  }

  const destroyGallery = parseDestroyGallery(text);
  if (destroyGallery) effects.destroy_gallery_cards = destroyGallery;

  const look = parseLookAtTop(text);
  if (look) {
    effects.look_at_top_cards = look.look_at_top_cards;
    if (look.reorder_top_cards) effects.reorder_top_cards = true;
  }

  const gainCard = parseGainCard(text);
  if (gainCard) effects.gain_card = gainCard;

  const gainItem = parseGainItem(text);
  if (gainItem) effects.gain_item = gainItem;

  if (
    /copy the effect(?:s)? of/i.test(text) &&
    !FACTION_EFFECT_OVERRIDES[card.id]
  ) {
    effects.copy_card = true;
  }

  const countsAs = parseCountsAsFaction(text);
  if (countsAs) effects.counts_as_faction = countsAs;

  if (/next card you gain this turn goes into your hand/i.test(text)) {
    effects.next_card_to_hand = true;
  }

  const epicDiscount = text.match(/(?:all )?epics cost\s+(\d+) less/i);
  if (epicDiscount) {
    effects.discount_epics = parseInt(epicDiscount[1], 10);
  }

  const arenaValor = text.match(/contributes \+(\d+) additional valor/i);
  if (arenaValor) {
    effects.arena_bonus_valor = parseInt(arenaValor[1], 10);
  }

  const sabotageValor = text.match(/-(\d+)\s*Valor/i);
  if (
    sabotageValor &&
    (keywords.includes('sabotage') || card.timing === 'arena_response')
  ) {
    effects.arena_bonus_valor = -parseInt(sabotageValor[1], 10);
  }

  if (/force them to discard 1 card/i.test(text)) {
    effects.force_opponent_discard = 1;
  }

  const bonusVp = text.match(
    /(?:if you defeat arena this turn, )?gain \+(\d+) victory points/i
  );
  if (bonusVp) {
    effects.gain_vp = parseInt(bonusVp[1], 10);
  }

  if (/flip up to\s+(\d+) cards in the gallery face down/i.test(text)) {
    const n = parseInt(
      text.match(/flip up to\s+(\d+) cards in the gallery face down/i)[1],
      10
    );
    effects.protect_gallery_cards = n;
  }

  if (/gain the faction bonus of ludus, senate, or legion/i.test(text)) {
    effects.gain_banding_bonus = 'choose_faction';
  }

  if (/put an item from your discard pile into your hand/i.test(text)) {
    effects.return_card_to_hand = { type: 'item', source: 'discard' };
  }

  if (
    /put a (\w+) card from your discard pile on top of your deck/i.test(text)
  ) {
    const faction = text.match(
      /put a (\w+) card from your discard pile on top of your deck/i
    )[1];
    effects.place_card_on_deck = {
      source: 'discard',
      faction: faction.toLowerCase(),
      position: 'top',
    };
  }

  if (
    /put a ludus, legion, or senate card from your discard pile on top of your deck/i.test(
      text
    )
  ) {
    effects.place_card_on_deck = {
      source: 'discard',
      faction: 'any_faction',
      position: 'top',
    };
  }

  if (/put a card from your discard pile into your hand/i.test(text)) {
    effects.return_card_to_hand = { source: 'discard' };
  }

  if (/put a ludus card from your discard pile into your hand/i.test(text)) {
    effects.return_card_to_hand = {
      source: 'discard',
      faction: 'ludus',
    };
  }

  // Keyword fallbacks when text is minimal
  if (!effects.gain_coins && keywords.includes('coins')) {
    const c = parseCoins(text);
    if (c != null) effects.gain_coins = c;
  }

  if (keywords.includes('draw') && !effects.draw_cards) {
    const d = parseDrawCards(text);
    if (d) effects.draw_cards = d;
  }

  if (keywords.includes('destroy') && !effects.destroy_cards && !effects.destroy_gallery_cards) {
    const destroyText =
      /\s+OR\s+/i.test(text) ? text.split(/\s+OR\s+/i)[0] : text;
    if (/gallery/i.test(destroyText)) effects.destroy_gallery_cards = 1;
    else if (/hand|discard/i.test(destroyText)) {
      effects.destroy_cards = 1;
      effects.destroy_from = ['hand', 'discard'];
    }
  }

  return Object.keys(effects).length ? effects : undefined;
}

function mergeManual(card, effects) {
  const manual = FACTION_EFFECT_OVERRIDES[card.id];
  if (!manual) return effects;
  return manual;
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
let updated = 0;
let skipped = 0;

for (const card of data.cards) {
  if (
    card.card_type !== 'faction' &&
    card.card_type !== 'epic' &&
    card.card_type !== 'basic' &&
    card.id !== 'ALL-001' &&
    card.id !== 'ALL-002'
  ) {
    continue;
  }
  if (!card.effect_text) {
    delete card.effects;
    skipped++;
    continue;
  }

  if (TIMING_FIXES[card.id]) {
    card.timing = TIMING_FIXES[card.id];
  }

  const parsed = parseEffects(card);
  const effects = mergeManual(card, parsed);
  if (effects && Object.keys(effects).length > 0) {
    card.effects = effects;
    updated++;
  } else {
    delete card.effects;
    skipped++;
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

console.log(`Updated ${updated} cards, ${skipped} without effects`);
const sample = data.cards.filter((c) => c.effects).slice(0, 5);
sample.forEach((c) =>
  console.log(c.id, JSON.stringify(c.effects))
);