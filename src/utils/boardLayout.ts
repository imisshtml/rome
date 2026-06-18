import { useSafeViewportSize } from './safeViewport';
import {
  CARD_PORTRAIT_RATIO,
  landscapeCardWidth,
  portraitCardHeight,
} from './cardDisplayUtils';

/** Fixed height ratios from zones.png — only playField flexes vertically. */
export const BOARD_RATIOS = {
  opponentsBar: 0.07,
  gallery: 0.26,
  handZone: 0.22,
  sidebarWidth: 0.15,
  zoneGap: 0.008,
} as const;

export interface BoardLayoutMetrics {
  boardW: number;
  boardH: number;
  opponentsBarH: number;
  galleryH: number;
  handZoneH: number;
  sidebarW: number;
  centerW: number;
  bodyH: number;
  playFieldH: number;
  galleryCardSize: number;
  galleryCardGap: number;
  arenaCardW: number;
  arenaCardH: number;
  handCardW: number;
  handCardH: number;
  playCardW: number;
  playCardH: number;
  stackW: number;
  stackH: number;
  stackGap: number;
  mainContentH: number;
}

export function computeBoardLayout(width: number, height: number): BoardLayoutMetrics {
  const boardW = width;
  const boardH = height;

  const opponentsBarH = Math.round(boardH * BOARD_RATIOS.opponentsBar);
  const galleryH = Math.round(boardH * BOARD_RATIOS.gallery);
  const handZoneH = Math.round(boardH * BOARD_RATIOS.handZone);
  const mainContentH = boardH - opponentsBarH;
  const bodyH = mainContentH - galleryH;
  const playFieldH = Math.max(80, bodyH - handZoneH);

  const sidebarW = Math.round(boardW * BOARD_RATIOS.sidebarWidth);
  const centerW = boardW - sidebarW * 2;

  const galleryInnerH = galleryH - 16;
  const galleryRowH = galleryInnerH * 0.46;
  const galleryCardSize = Math.min(
    Math.floor((centerW - 48) / 7.2),
    Math.floor(galleryRowH * 0.92)
  );
  const galleryCardGap = Math.max(4, Math.floor(galleryCardSize * 0.08));

  const arenaCardH = Math.floor(galleryRowH * 0.88);
  const arenaCardW = landscapeCardWidth(arenaCardH);

  const handCardH = Math.floor(handZoneH * 0.82);
  const handCardW = Math.floor(handCardH / CARD_PORTRAIT_RATIO);

  const playCardW = Math.floor(handCardW * 0.52);
  const playCardH = portraitCardHeight(playCardW);

  const stackCount = 5;
  const stackGap = Math.max(4, Math.round(mainContentH * 0.012));
  const sidebarInnerH = mainContentH - 16;
  let stackW = Math.floor(sidebarW * 0.88);
  let stackH = Math.floor(stackW * CARD_PORTRAIT_RATIO);
  const stacksTotalH = stackCount * stackH + (stackCount - 1) * stackGap;
  if (stacksTotalH > sidebarInnerH) {
    stackH = Math.floor((sidebarInnerH - (stackCount - 1) * stackGap) / stackCount);
    stackW = Math.floor(stackH / CARD_PORTRAIT_RATIO);
    stackH = portraitCardHeight(stackW);
  }

  return {
    boardW,
    boardH,
    opponentsBarH,
    galleryH,
    handZoneH,
    sidebarW,
    centerW,
    bodyH,
    playFieldH,
    galleryCardSize,
    galleryCardGap,
    arenaCardW,
    arenaCardH,
    handCardW,
    handCardH,
    playCardW,
    playCardH,
    stackW,
    stackH,
    stackGap,
    mainContentH,
  };
}

export function useBoardLayout(): BoardLayoutMetrics {
  const { width, height } = useSafeViewportSize();
  return computeBoardLayout(width, height);
}
