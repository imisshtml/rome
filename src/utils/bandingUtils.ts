import { CardInstance, Faction } from '../types/cardTypes';
import {
  getCardEffectiveFaction,
  requiresFactionChoiceOnPlay,
} from './cardFactionUtils';

export type BandingFaction = 'Ludus' | 'Legion' | 'Senate';

export const BANDING_FACTIONS: BandingFaction[] = ['Ludus', 'Legion', 'Senate'];

export const BANDING_BONUS_LABEL: Record<BandingFaction, string> = {
  Ludus: 'Gain 1 Favor card',
  Senate: 'Gain +2 Coins',
  Legion: 'Draw 1 card',
};

export function isBandingFaction(faction: Faction): faction is BandingFaction {
  return (BANDING_FACTIONS as readonly string[]).includes(faction);
}

function cardCountsForBanding(card: CardInstance, faction: BandingFaction): boolean {
  // Charity and other plain basics don't band; Spies with a chosen faction do.
  if (card.definition.type === 'Basic' && !card.chosenFaction) return false;
  return getCardEffectiveFaction(card) === faction;
}

export function countBandingFactionInPlayArea(
  playArea: CardInstance[],
  faction: BandingFaction
): number {
  return playArea.filter((c) => cardCountsForBanding(c, faction)).length;
}

/** Returns the faction whose banding bonus was just earned, if any. */
export function detectTriggeredBandingFaction(
  playArea: CardInstance[],
  claimedFactions: Faction[],
  triggeringCard: CardInstance
): BandingFaction | null {
  const faction = getCardEffectiveFaction(triggeringCard);
  if (!isBandingFaction(faction)) return null;
  if (triggeringCard.definition.type === 'Basic' && !triggeringCard.chosenFaction) {
    return null;
  }
  if (claimedFactions.includes(faction)) return null;
  if (countBandingFactionInPlayArea(playArea, faction) < 3) return null;
  return faction;
}

function phaseBandingPreference(faction: BandingFaction, turnNumber: number): number {
  const earlyGame = turnNumber <= 3;
  const lateGame = turnNumber >= 6;

  if (earlyGame) {
    if (faction === 'Senate') return 80;
    if (faction === 'Legion') return 25;
    return 15;
  }
  if (lateGame) {
    if (faction === 'Ludus') return 65;
    if (faction === 'Legion') return 55;
    return 25;
  }
  if (faction === 'Senate') return 45;
  if (faction === 'Legion') return 40;
  return 38;
}

function countBandingFactionInHand(
  hand: CardInstance[],
  faction: BandingFaction
): number {
  return hand.filter((c) => {
    if (requiresFactionChoiceOnPlay(c.definition)) return false;
    const f = getCardEffectiveFaction(c);
    return f === faction;
  }).length;
}

function spyChosenFactionInPlay(playArea: CardInstance[]): BandingFaction | null {
  const chosen = playArea
    .filter(
      (c) =>
        requiresFactionChoiceOnPlay(c.definition) &&
        c.chosenFaction &&
        isBandingFaction(c.chosenFaction)
    )
    .map((c) => c.chosenFaction as BandingFaction);

  if (chosen.length === 0) return null;

  const counts: Record<BandingFaction, number> = { Ludus: 0, Legion: 0, Senate: 0 };
  for (const f of chosen) counts[f] += 1;
  return BANDING_FACTIONS.reduce((best, f) =>
    counts[f] > counts[best] ? f : best
  );
}

/** Pick a banding faction target for Spy / Demagogue when the AI plays it. */
export function chooseSpyFactionForAI(
  playArea: CardInstance[],
  hand: CardInstance[],
  claimedFactions: BandingFaction[],
  turnNumber: number
): BandingFaction {
  const committed = spyChosenFactionInPlay(playArea);
  if (committed && !claimedFactions.includes(committed)) {
    return committed;
  }

  const spiesInHand = hand.filter((c) =>
    requiresFactionChoiceOnPlay(c.definition)
  );
  const spyCount = spiesInHand.length;

  let bestFaction: BandingFaction = 'Senate';
  let bestScore = -Infinity;

  for (const faction of BANDING_FACTIONS) {
    if (claimedFactions.includes(faction)) continue;

    const inPlay = countBandingFactionInPlayArea(playArea, faction);
    const inHand = countBandingFactionInHand(hand, faction);
    const afterThisSpy = inPlay + 1;
    const potentialThisTurn = inPlay + inHand + spyCount;

    let score = phaseBandingPreference(faction, turnNumber);

    if (potentialThisTurn >= 3) {
      score += 1200 + inPlay * 30 + inHand * 40;
    } else if (afterThisSpy >= 3) {
      score += 1000;
    } else if (inPlay + inHand >= 2 && spyCount > 0) {
      score += 550 + (inPlay + inHand) * 35;
    } else if (afterThisSpy === 2) {
      score += 250;
    }

    score += inPlay * 40 + inHand * 55;

    if (score > bestScore) {
      bestScore = score;
      bestFaction = faction;
    }
  }

  return bestFaction;
}

/** Prefer matching faction cards before Spies when a triple is reachable. */
export function pickAICardToPlayFirst(
  hand: CardInstance[],
  playArea: CardInstance[],
  claimedFactions: BandingFaction[],
  turnNumber: number
): CardInstance {
  if (hand.length === 0) throw new Error('pickAICardToPlayFirst: empty hand');

  const spies = hand.filter((c) => requiresFactionChoiceOnPlay(c.definition));
  const committed = spyChosenFactionInPlay(playArea);

  const targetFaction =
    committed && !claimedFactions.includes(committed)
      ? committed
      : spies.length > 0
        ? chooseSpyFactionForAI(playArea, hand, claimedFactions, turnNumber)
        : null;

  if (targetFaction && !claimedFactions.includes(targetFaction)) {
    const matching = hand.filter(
      (c) =>
        !requiresFactionChoiceOnPlay(c.definition) &&
        getCardEffectiveFaction(c) === targetFaction
    );
    const inPlay = countBandingFactionInPlayArea(playArea, targetFaction);
    if (matching.length > 0 && inPlay + matching.length + spies.length >= 3) {
      return matching[0];
    }
    if (spies.length > 0 && (inPlay >= 2 || inPlay + spies.length >= 3)) {
      return spies[0];
    }
  }

  if (spies.length === 0) return hand[0];

  const shouldStackSpies = BANDING_FACTIONS.some((faction) => {
    if (claimedFactions.includes(faction)) return false;
    const inPlay = countBandingFactionInPlayArea(playArea, faction);
    const inHand = countBandingFactionInHand(hand, faction);
    return inPlay + inHand + spies.length >= 3 || inPlay >= 2;
  });

  if (shouldStackSpies || spies.length >= 2) {
    return spies[0];
  }

  return hand[0];
}
