import type { CardInstance } from '../types/cardTypes';
import type { PlayerState } from '../types/gameTypes';
import {
  normalizeDestroyFromZones,
  playerHasDestroyTargetsInZones,
  type DestroyFromZone,
} from './cardDestroyUtils';

export type RawEffects = Record<string, unknown>;

export function getRawEffects(card: CardInstance): RawEffects {
  return (card.definition.effects ?? {}) as RawEffects;
}

/** Coins apply after destroy when text leads with "+N Coins. Destroy …" */
export function destroyDefersOtherEffects(card: CardInstance): boolean {
  const text = (card.definition.text ?? '').replace(/\s+/g, ' ').trim();
  if (/^\+?\d+\s*Coins?\.\s*Destroy/i.test(text)) return false;
  if (/Destroy[\s\S]{0,80}(gain|\+)\s*\d+\s*Coins?/i.test(text)) return true;
  if (/^Destroy/i.test(text) && /Coins?/i.test(text)) return true;
  return false;
}

export function isOptionalDestroyText(card: CardInstance): boolean {
  return /\bmay\b/i.test(card.definition.text ?? '');
}

export type HandDiscardDestroySpec = {
  count: number;
  fromZones: DestroyFromZone[];
  optional: boolean;
  deferOtherEffects: boolean;
};

export function getHandDiscardDestroySpec(
  card: CardInstance
): HandDiscardDestroySpec | null {
  const raw = getRawEffects(card);
  const count = (raw.destroy_cards as number | undefined) ?? 0;
  const from = normalizeDestroyFromZones(raw.destroy_from as string[] | undefined);
  if (count <= 0 || from.length === 0) return null;
  const optional = isOptionalDestroyText(card);
  return {
    count,
    fromZones: from,
    optional,
    deferOtherEffects: !optional && destroyDefersOtherEffects(card),
  };
}

export function getOptionalBlockDestroySpec(
  card: CardInstance
): HandDiscardDestroySpec | null {
  const opt = getRawEffects(card).optional;
  if (!opt || typeof opt !== 'object') return null;
  const block = opt as RawEffects;
  const count = (block.destroy_cards as number | undefined) ?? 0;
  const from = normalizeDestroyFromZones(block.destroy_from as string[] | undefined);
  if (count <= 0 || from.length === 0) return null;
  return {
    count,
    fromZones: from,
    optional: true,
    deferOtherEffects: false,
  };
}

export function getOptionalBlockFollowUp(
  card: CardInstance
): Record<string, unknown> | null {
  const opt = getRawEffects(card).optional;
  if (!opt || typeof opt !== 'object') return null;
  const block = { ...(opt as RawEffects) };
  delete block.destroy_cards;
  delete block.destroy_from;
  if (Object.keys(block).length === 0) return null;
  return block;
}

export function getReplayFavorFromDiscardSpec(
  card: CardInstance
): { removeFromGame: boolean } | null {
  const raw = getRawEffects(card).replay_favor_from_discard;
  if (!raw || typeof raw !== 'object') return null;
  return {
    removeFromGame: (raw as { remove_from_game?: boolean }).remove_from_game === true,
  };
}

export function getGalleryDestroyCount(card: CardInstance): number {
  const raw = getRawEffects(card);
  return (raw.destroy_gallery_cards as number | undefined) ?? 0;
}

export function getDestroyEpicCount(card: CardInstance): number {
  return (getRawEffects(card).destroy_epic_cards as number | undefined) ?? 0;
}

export function isUpToGalleryDestroyText(card: CardInstance): boolean {
  return /\bup to\b/i.test(card.definition.text ?? '');
}

export function hasDestroyHandForCoins(card: CardInstance): boolean {
  return !!getRawEffects(card).destroy_hand_for_coins;
}

export function hasAnyDiscardDestroy(card: CardInstance): boolean {
  const raw = getRawEffects(card);
  return (
    ((raw.destroy_cards as number | undefined) ?? 0) > 0 &&
    Array.isArray(raw.destroy_from) &&
    raw.destroy_from.includes('any_discard')
  );
}

export function hasOrEffectChoice(card: CardInstance): boolean {
  const branches = getRawEffects(card).or_effects;
  return Array.isArray(branches) && branches.length > 0;
}

export function getOrEffectBranches(card: CardInstance): RawEffects[] {
  const branches = getRawEffects(card).or_effects;
  return Array.isArray(branches) ? (branches as RawEffects[]) : [];
}

export function playerCanFulfillHandDiscardDestroy(
  player: PlayerState,
  spec: HandDiscardDestroySpec
): boolean {
  return playerHasDestroyTargetsInZones(player, spec.fromZones);
}

export function canFulfillPlayDestroyRequirements(
  state: { players: PlayerState[]; galleryCards: CardInstance[] },
  player: PlayerState,
  card: CardInstance,
  isGalleryAvailable: (instanceId: string) => boolean
): boolean {
  if (hasOrEffectChoice(card)) return true;

  const spec = getHandDiscardDestroySpec(card);
  if (spec && !spec.optional) {
    const playerForCheck =
      spec.fromZones.includes('hand')
        ? {
            ...player,
            hand: player.hand.filter((c) => c.instanceId !== card.instanceId),
          }
        : player;
    if (!playerHasDestroyTargetsInZones(playerForCheck, spec.fromZones)) {
      return false;
    }
  }

  if (hasDestroyHandForCoins(card) && player.hand.length === 0) {
    return false;
  }

  if (hasAnyDiscardDestroy(card) && !anyOpponentHasDiscardTarget(state, player.id)) {
    return false;
  }

  const galleryCount = getGalleryDestroyCount(card);
  if (
    galleryCount > 0 &&
    destroyDefersOtherEffects(card) &&
    !state.galleryCards.some((c) => isGalleryAvailable(c.instanceId))
  ) {
    return false;
  }

  return true;
}

export function anyPlayerHasDiscardTarget(state: {
  players: PlayerState[];
}): boolean {
  return state.players.some((p) => p.discard.length > 0);
}

export function anyOpponentHasDiscardTarget(
  state: { players: PlayerState[] },
  playerId: string
): boolean {
  return state.players.some((p) => p.id !== playerId && p.discard.length > 0);
}
