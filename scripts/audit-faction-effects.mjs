#!/usr/bin/env node
// Audits cards_factions.json: checks each card's `effects` against the set of
// effect keys the game engine actually consumes. Flags:
//   [DEAD]     effect keys present in JSON that the engine never reads (silent no-op)
//   [MISSING]  effect_text implies an action but `effects` only encodes coins/valor/vp
//   [NO-FX]    non-trivial effect_text but no `effects` object at all
//
// Usage: node scripts/audit-faction-effects.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(
  readFileSync(resolve(__dirname, '../cards_factions.json'), 'utf8')
);

// Top-level keys the engine reads somewhere (grep-verified in src/).
const SUPPORTED_TOP = new Set([
  // resource gains (EffectResolver / GameEngine)
  'gain_coins', 'gain_valor', 'gain_vp', 'gain_imperial_favor', 'gain_favor',
  'gain_gratia', 'gain_crowd_disfavor',
  // card flow
  'draw_cards', 'discard_cards', 'discard_hand', 'mass_hand_redraw',
  // destroy
  'destroy_cards', 'destroy_from', 'destroy_gallery_cards', 'destroy_epic_cards',
  'destroy_hand_for_coins', 'destroy_self',
  // gain / copy / look
  'gain_card', 'copy_card', 'look_at_top_cards', 'reorder_top_cards',
  'look_at_own_deck_only', 'reveal_all_player_deck_tops',
  // banding / faction
  'gain_banding_bonus', 'choose_faction_on_play', 'counts_as_faction',
  // deck manipulation
  'place_card_on_deck',
  // discounts / arena
  'discount_epics', 'discount_faction_cost', 'gain_valor_per_arena_challenger',
  'arena_bonus_valor', 'arena_wager', 'allow_fourth_arena_participant',
  'arena_support', 'arena_sabotage',
  // opponent interaction
  'force_opponent_discard', 'force_opponent_discard_single', 'controller_picks_discard',
  'steal_cheapest_from_opponent_hand',
  // favor
  'replay_favor_from_discard', 'reveal_favors',
  // hand/deck routing + discounts
  'return_card_to_hand', 'next_card_to_hand', 'discount_item_cost',
  'may_purchase_from_destroyed_pile', 'flip_market_face_down',
  // arena bonuses
  'beast_arena_valor_bonus', 'gain_gratia_on_arena_victory', 'cancel_sabotage',
  // nested containers (validated separately)
  'on_gain', 'optional', 'or_effects', 'conditional', 'passive',
  // refill timing modifiers
  'replace_gallery_at', 'replace_epic_at',
]);

// Keys with NO engine consumer yet — large subsystems intentionally deferred.
//   play_market_top / play_opponent_random : temporary-play subsystem (Captain, Bribery)
//   arena_decree_on_defeat                  : Decree arena-loss hook (Senate)
const DEAD_KEYS = new Set([
  'play_market_top', 'play_opponent_random', 'arena_decree_on_defeat',
  'consult_augur', 'copy_item', 'gain_item', 'protect_gallery_cards', 'discard_item_in_play',
]);

const SUPPORTED_PASSIVE = new Set([
  'opponent_coin_cap_per_card', 'deck_vp_per_faction', 'duration',
  'skip_arena_participation', 'sabotage_immune', 'reduce_sabotage_valor',
  'sabotage_on_fail_destroy_challenger',
]);

// optional block: destroy + follow-up (applyOptionalBlockFollowUp / dynamic gain / disfavor).
const SUPPORTED_OPTIONAL = new Set([
  'destroy_cards', 'destroy_from', 'place_card_on_deck', 'place_destroyed_on_market',
  'draw_cards', 'gain_favor', 'gain_imperial_favor',
  'then_gain_card', 'destroy_disfavor', 'draw_per_destroyed',
]);

// on_gain: applyOnGainEffects + beginInteractivePlayPicks + beginOnGainDestroyIfNeeded
const SUPPORTED_ON_GAIN = new Set([
  'draw_cards', 'gain_card', 'destroy_cards', 'destroy_from', 'optional',
  'look_at_top_cards', 'reorder_top_cards', 'copy_card', 'gain_banding_bonus',
  'place_card_on_deck',
]);

// conditional: getConditionalPlayEffect reads these.
const SUPPORTED_CONDITIONAL = new Set([
  'if_played_factions', 'if_arena_defeated_this_turn',
  'draw_cards', 'gain_coins', 'gain_favor', 'gain_imperial_favor', 'gain_vp',
]);

// or_effects branch keys: destroy_self path + recursive applyCardPlayEffects + gates.
const SUPPORTED_BRANCH = new Set([
  'destroy_self', 'gain_coins', 'draw_cards', 'gain_favor', 'gain_imperial_favor',
  'gain_valor', 'gain_vp', 'arena_bonus_valor', 'arena_support', 'arena_sabotage',
  'destroy_cards', 'destroy_from', 'gain_card', 'discard_hand', 'discount_epics',
  'if_first_card_played', 'gain_coins_per_matching_in_play',
]);

// Valid `source` values per spec parser.
const GAIN_CARD_SOURCES = new Set([
  'market', 'market_or_epic', 'destroyed_pile', 'favor_discard',
]);
const COPY_CARD_SOURCES = new Set(['market', 'in_play', 'market_or_epic']);

const ACTION_WORDS =
  /\b(destroy|draw|gain|discard|put|return|look|reveal|copy|search|topdeck|sabotage|support|faction bonus|costing|from the market|other players|opponent|each player)\b/i;

const COINS_ONLY_FX = new Set([
  'gain_coins', 'gain_valor', 'gain_vp', 'gain_imperial_favor', 'gain_favor',
]);

const findings = [];

for (const card of pack.cards) {
  const id = card.id;
  const name = card.name;
  const text = (card.effect_text ?? '').trim();
  const fx = card.effects;
  const issues = [];

  if (fx && typeof fx === 'object') {
    for (const key of Object.keys(fx)) {
      if (DEAD_KEYS.has(key)) {
        issues.push(`[DEAD] top key "${key}" — engine never reads it`);
      } else if (!SUPPORTED_TOP.has(key)) {
        issues.push(`[DEAD] top key "${key}" — not consumed by engine`);
      }
    }
    if (fx.passive && typeof fx.passive === 'object') {
      for (const k of Object.keys(fx.passive)) {
        if (!SUPPORTED_PASSIVE.has(k)) {
          issues.push(`[DEAD] passive."${k}" — not consumed by engine`);
        }
      }
    }
    if (fx.optional && typeof fx.optional === 'object') {
      for (const k of Object.keys(fx.optional)) {
        if (k === 'optional') continue;
        if (DEAD_KEYS.has(k)) {
          issues.push(`[DEAD] optional."${k}" — engine never reads it`);
        } else if (!SUPPORTED_OPTIONAL.has(k)) {
          issues.push(`[DEAD] optional."${k}" — not applied (follow-up supports draw/favor only)`);
        }
      }
    }
    if (fx.on_gain && typeof fx.on_gain === 'object') {
      for (const k of Object.keys(fx.on_gain)) {
        if (k === 'optional') continue;
        if (!SUPPORTED_ON_GAIN.has(k)) {
          issues.push(`[DEAD] on_gain."${k}" — not consumed on gain`);
        }
      }
    }
    if (fx.conditional && typeof fx.conditional === 'object') {
      for (const k of Object.keys(fx.conditional)) {
        if (!SUPPORTED_CONDITIONAL.has(k)) {
          issues.push(`[DEAD] conditional."${k}" — not read (needs if_played_factions + draw/coins/favor)`);
        }
      }
    }
    if (Array.isArray(fx.or_effects)) {
      fx.or_effects.forEach((branch, i) => {
        if (!branch || typeof branch !== 'object') return;
        for (const k of Object.keys(branch)) {
          if (DEAD_KEYS.has(k)) {
            issues.push(`[DEAD] or_effects[${i}]."${k}" — engine never reads it`);
          } else if (!SUPPORTED_BRANCH.has(k)) {
            issues.push(`[DEAD] or_effects[${i}]."${k}" — not applied in branch resolution`);
          }
        }
      });
    }
    // validate source enums on gain_card / copy_card
    const gc = fx.gain_card;
    if (gc && typeof gc === 'object' && gc.source && !GAIN_CARD_SOURCES.has(gc.source)) {
      issues.push(`[DEAD] gain_card.source "${gc.source}" — invalid; use market/market_or_epic/destroyed_pile`);
    }
    const cc = fx.copy_card;
    if (cc && typeof cc === 'object' && cc.source && !COPY_CARD_SOURCES.has(cc.source)) {
      issues.push(`[DEAD] copy_card.source "${cc.source}" — invalid; engine supports market/in_play only`);
    }

    // coins-only encoding but text implies more
    const activeKeys = Object.keys(fx).filter((k) => {
      const v = fx[k];
      return v != null && v !== false && v !== 0 &&
        !(Array.isArray(v) && v.length === 0);
    });
    const onlyResourceGains =
      activeKeys.length > 0 && activeKeys.every((k) => COINS_ONLY_FX.has(k));
    if (onlyResourceGains && ACTION_WORDS.test(text.replace(/^\+?\d+\s*Coins?\.?/i, ''))) {
      issues.push(`[MISSING] text implies action but effects only encodes resource gains`);
    }
  } else {
    // no effects object
    if (text && ACTION_WORDS.test(text) && !/^\+?\d+\s*Coins?$/i.test(text)) {
      issues.push(`[NO-FX] no effects object but text implies an action`);
    }
  }

  if (issues.length > 0) {
    findings.push({ id, name, text, issues });
  }
}

if (findings.length === 0) {
  console.log('No issues found.');
} else {
  console.log(`Found ${findings.length} card(s) with potential issues:\n`);
  for (const f of findings) {
    console.log(`${f.id}  ${f.name}`);
    console.log(`   text: ${f.text}`);
    for (const i of f.issues) console.log(`   ${i}`);
    console.log('');
  }
}

console.log(`\nTotal cards scanned: ${pack.cards.length}`);
console.log(`Cards flagged: ${findings.length}`);
