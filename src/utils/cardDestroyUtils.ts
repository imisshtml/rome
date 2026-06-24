import type { CardInstance } from '../types/cardTypes';
import type { PlayerState } from '../types/gameTypes';

export type DestroyFromZone = 'hand' | 'discard' | 'play_area';

export function normalizeDestroyFromZones(
  raw: string[] | undefined
): DestroyFromZone[] {
  const zones: DestroyFromZone[] = [];
  for (const zone of raw ?? []) {
    if (zone === 'hand' || zone === 'discard' || zone === 'play_area') {
      zones.push(zone);
    }
  }
  return zones;
}

export function playerHasDestroyTargetsInZones(
  player: PlayerState,
  fromZones: DestroyFromZone[]
): boolean {
  if (fromZones.includes('hand') && player.hand.length > 0) return true;
  if (fromZones.includes('discard') && player.discard.length > 0) return true;
  if (fromZones.includes('play_area') && player.playArea.length > 0) return true;
  return false;
}

/** True when destroy is optional ("may destroy") rather than mandatory. */
export function isOptionalDestroyOnPlay(card: CardInstance): boolean {
  const effects = card.definition.effects as
    | (typeof card.definition.effects & { optional?: boolean | Record<string, unknown> })
    | undefined;
  if (effects?.optional === true || typeof effects?.optional === 'object') {
    return true;
  }
  const text = card.definition.text ?? '';
  return /\bmay\b/i.test(text) && (effects?.destroy_cards ?? 0) > 0;
}

export function playRequiresMandatoryDestroy(card: CardInstance): boolean {
  const effects = card.definition.effects;
  const destroyCount = effects?.destroy_cards ?? 0;
  if (destroyCount <= 0) return false;
  return !isOptionalDestroyOnPlay(card);
}

export function canFulfillPlayDestroy(
  player: PlayerState,
  card: CardInstance
): boolean {
  const effects = card.definition.effects;
  const destroyCount = effects?.destroy_cards ?? 0;
  if (destroyCount <= 0) return true;
  if (isOptionalDestroyOnPlay(card)) return true;
  const fromZones = normalizeDestroyFromZones(effects?.destroy_from);
  if (fromZones.length === 0) return true;
  return playerHasDestroyTargetsInZones(player, fromZones);
}
