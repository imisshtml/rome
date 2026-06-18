import { CardDefinition } from '../types/cardTypes';

/** Standard poker card: 2.5" wide × 3.5" tall. */
export const CARD_PORTRAIT_RATIO = 3.5 / 2.5;
/** Landscape arena cards: 3.5" wide × 2.5" tall (width / height). */
export const CARD_LANDSCAPE_RATIO = 3.5 / 2.5;

/** @deprecated use CARD_PORTRAIT_RATIO */
export const CARD_ASPECT = CARD_PORTRAIT_RATIO;

export function portraitCardHeight(width: number): number {
  return Math.round(width * CARD_PORTRAIT_RATIO);
}

export function landscapeCardWidth(height: number): number {
  return Math.round(height * CARD_LANDSCAPE_RATIO);
}

export function isLandscapeCard(definition: CardDefinition): boolean {
  return definition.faction === 'Arena' || definition.valorRequired != null;
}

export function getEnlargedPreviewSize(
  containerWidth: number,
  definition: CardDefinition,
  maxPreviewW?: number
): { width: number; height: number } {
  const landscape = isLandscapeCard(definition);
  const defaultMax = landscape ? 248 : 192;
  const previewW = Math.min(containerWidth - 8, maxPreviewW ?? defaultMax);
  const previewH = landscape
    ? Math.round(previewW / CARD_LANDSCAPE_RATIO)
    : portraitCardHeight(previewW);
  return { width: previewW, height: previewH };
}

export interface CardStatDisplay {
  cost: number | null;
  victory: number | null;
  valor: number | null;
}

export function getCardStatDisplay(definition: CardDefinition): CardStatDisplay {
  if (
    definition.type === 'CrowdDisfavor' ||
    definition.faction === 'CrowdDisfavor'
  ) {
    return {
      cost: null,
      victory: definition.victoryPoints,
      valor: null,
    };
  }

  if (definition.faction === 'Arena' || definition.valorRequired != null) {
    return {
      cost: null,
      victory: definition.rewardVp ?? 0,
      valor: definition.valorRequired ?? 0,
    };
  }

  if (
    definition.type === 'Epic' ||
    definition.type === 'Gladiator' ||
    definition.type === 'Action' ||
    definition.type === 'Basic'
  ) {
    return {
      cost: definition.cost,
      victory: definition.victoryPoints,
      valor: definition.valor,
    };
  }

  return {
    cost: definition.cost > 0 ? definition.cost : null,
    victory: definition.victoryPoints !== 0 ? definition.victoryPoints : null,
    valor: definition.valor > 0 ? definition.valor : null,
  };
}
