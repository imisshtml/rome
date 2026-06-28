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

/** Extra hover zoom for landscape arena cards vs other cards. */
export const ARENA_HOVER_PREVIEW_SCALE = 1.25;

export function getClickPreviewMaxWidth(viewportWidth: number): number {
  return Math.min(336, viewportWidth * 0.84);
}

export function getClickPreviewSize(
  viewportWidth: number,
  definition: CardDefinition,
  viewportHeight?: number
): { width: number; height: number } {
  const maxW = getClickPreviewMaxWidth(viewportWidth);
  let { width, height } = getEnlargedPreviewSize(viewportWidth, definition, maxW);

  if (viewportHeight != null) {
    const margin = 16;
    const maxH = viewportHeight - margin * 2;
    if (height > maxH) {
      const landscape = isLandscapeCard(definition);
      height = maxH;
      width = landscape
        ? Math.round(height * CARD_LANDSCAPE_RATIO)
        : Math.round(height / CARD_PORTRAIT_RATIO);
    }
  }

  return { width, height };
}

/** Hover zoom — same target size as click modal, with a floor vs the source card. */
export function getHoverPreviewSize(
  viewportWidth: number,
  viewportHeight: number,
  definition: CardDefinition,
  anchor?: { width: number; height: number }
): { width: number; height: number } {
  const landscape = isLandscapeCard(definition);
  const margin = 16;
  const maxW = viewportWidth - margin * 2;
  const maxH = viewportHeight - margin * 2;

  let { width, height } = getClickPreviewSize(
    viewportWidth,
    definition,
    viewportHeight
  );

  if (landscape) {
    width = Math.round(width * ARENA_HOVER_PREVIEW_SCALE);
    height = Math.round(height * ARENA_HOVER_PREVIEW_SCALE);
    if (width > maxW) {
      width = maxW;
      height = Math.round(width / CARD_LANDSCAPE_RATIO);
    }
    if (height > maxH) {
      height = maxH;
      width = Math.round(height * CARD_LANDSCAPE_RATIO);
    }
  }

  if (!anchor) return { width, height };

  const anchorLong = landscape
    ? anchor.width
    : Math.max(anchor.width, anchor.height);
  const previewLong = landscape ? width : height;
  const minLong = Math.round(anchorLong * 1.35);

  if (previewLong >= minLong) return { width, height };

  const clickMaxW = getClickPreviewMaxWidth(viewportWidth);

  if (landscape) {
    width = Math.min(Math.max(width, minLong), maxW);
    height = Math.round(width / CARD_LANDSCAPE_RATIO);
    if (height > maxH) {
      height = maxH;
      width = Math.round(height * CARD_LANDSCAPE_RATIO);
    }
  } else {
    height = Math.min(
      Math.max(height, minLong),
      Math.round(clickMaxW * CARD_PORTRAIT_RATIO),
      maxH
    );
    width = Math.round(height / CARD_PORTRAIT_RATIO);
  }

  return { width, height };
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

export function getCardStatDisplay(
  definition: CardDefinition,
  options?: { costOverride?: number | null }
): CardStatDisplay {
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
    const baseCost = definition.cost;
    const cost =
      options?.costOverride != null && options.costOverride !== baseCost
        ? options.costOverride
        : baseCost;
    return {
      cost,
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
