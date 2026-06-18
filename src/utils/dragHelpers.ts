import { CardInstance, CardLocation } from '../types/cardTypes';

export interface DragPayload {
  card: CardInstance;
  sourceZone: CardLocation;
}

export interface DropResult {
  accepted: boolean;
  targetZone: CardLocation;
}

/**
 * Strategic drag flow:
 *   Hand → Play Area (MAIN phase)
 *   Hand/Play Area → Discard
 *   Hand → Items in Play
 *
 * Arena fighters are committed via the Arena challenge modal, not drag-and-drop.
 */
export function canDropCard(
  card: CardInstance,
  sourceZone: CardLocation,
  targetZone: CardLocation
): boolean {
  const rules: Partial<Record<CardLocation, CardLocation[]>> = {
    PLAY_AREA: ['HAND'],
    DISCARD: ['HAND', 'PLAY_AREA'],
    ITEMS_IN_PLAY: ['HAND'],
  };

  const acceptedSources = rules[targetZone];
  if (!acceptedSources) return false;
  return acceptedSources.includes(sourceZone);
}

export function getDropZoneHighlight(
  isOver: boolean,
  canDrop: boolean
): { borderColor: string; borderWidth: number; opacity: number } {
  if (!isOver) return { borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1, opacity: 1 };
  if (canDrop) return { borderColor: '#2ECC71', borderWidth: 2, opacity: 1 };
  return { borderColor: '#E74C3C', borderWidth: 2, opacity: 0.7 };
}

export function calculateHandFanAngle(
  index: number,
  total: number,
  maxAngle = 12
): number {
  if (total <= 1) return 0;
  const step = (maxAngle * 2) / (total - 1);
  return -maxAngle + step * index;
}

export function calculateHandOffset(
  index: number,
  total: number,
  maxOffset = 8
): number {
  if (total <= 1) return 0;
  const mid = (total - 1) / 2;
  if (mid === 0) return 0;
  const dist = Math.abs(index - mid);
  return dist * (maxOffset / mid);
}
