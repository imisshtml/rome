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
  /** Taller gallery row during MAIN so cards can render at 2× pregame size. */
  galleryInPlay: 0.45,
  handZone: 0.21,
  sidebarWidth: 0.15,
  zoneGap: 0.008,
} as const;

const GALLERY_IN_PLAY_SCALE = 2;
/** Slightly smaller deck stacks in the left sidebar. */
const SIDEBAR_STACK_SCALE = 0.84;
/** Full-height supply stacks (Market, Epics, Favors, Disfavor, Gratia). */
const FULL_SIDEBAR_STACK_COUNT = 5;
/** Supply pile size vs layout unit — shrunk to fit Gratia row. */
const SUPPLY_STACK_SCALE = 0.66;
/** Player deck + discard row — slightly larger after supply shrink. */
const PLAYER_STACK_SCALE = 0.46;

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
  playerStackW: number;
  playerStackH: number;
  playerStackGap: number;
  stackGap: number;
  mainContentH: number;
}

export function computeBoardLayout(
  width: number,
  height: number,
  inPlay = false
): BoardLayoutMetrics {
  const boardW = width;
  const boardH = height;

  const opponentsBarH = Math.round(boardH * BOARD_RATIOS.opponentsBar);
  const galleryH = Math.round(
    boardH *
      (inPlay ? BOARD_RATIOS.galleryInPlay : BOARD_RATIOS.gallery)
  );
  const handZoneH = Math.round(boardH * BOARD_RATIOS.handZone);
  const mainContentH = boardH - opponentsBarH;
  const bodyH = mainContentH - galleryH;
  const playFieldH = Math.max(80, bodyH - handZoneH);

  const sidebarW = Math.round(boardW * BOARD_RATIOS.sidebarWidth);
  const centerW = boardW - sidebarW * 2;

  const galleryInnerH = galleryH - 16;
  const galleryRowH = galleryInnerH * 0.46;
  const pregameGalleryCardSize = Math.min(
    Math.floor((centerW - 48) / 7.2),
    Math.floor(galleryRowH * 0.92)
  );
  const galleryCardSize = inPlay
    ? Math.min(
        pregameGalleryCardSize * GALLERY_IN_PLAY_SCALE,
        Math.floor((centerW - 48) / 3.5),
        Math.floor(galleryRowH * 0.98)
      )
    : pregameGalleryCardSize;
  const galleryCardGap = Math.max(4, Math.floor(galleryCardSize * 0.08));

  /** Landscape arena — height matches portrait epic/gallery card height. */
  const arenaCardH = Math.min(
    Math.floor(galleryRowH * 0.98),
    galleryCardSize
  );
  const arenaCardW = landscapeCardWidth(arenaCardH);

  const handCardH = Math.floor(handZoneH * 0.82);
  const handCardW = Math.floor(handCardH / CARD_PORTRAIT_RATIO);

  const playCardW = Math.floor(handCardW * 0.52);
  const playCardH = portraitCardHeight(playCardW);

  const sidebarRowCount = FULL_SIDEBAR_STACK_COUNT + 1;
  const stackGap = Math.max(2, Math.round(mainContentH * 0.004));
  const playerStackGap = Math.max(2, stackGap);
  const sidebarInnerH = mainContentH - 16;
  const stackWeight =
    FULL_SIDEBAR_STACK_COUNT * SUPPLY_STACK_SCALE + PLAYER_STACK_SCALE;
  const maxStackW = Math.floor(sidebarW * 0.88 * SIDEBAR_STACK_SCALE);
  const maxPlayerStackW = Math.floor((sidebarW - 8 - playerStackGap) / 2);

  const unitH = Math.floor(
    (sidebarInnerH - (sidebarRowCount - 1) * stackGap) / stackWeight
  );
  let stackH = Math.floor(unitH * SUPPLY_STACK_SCALE);
  let stackW = Math.floor(stackH / CARD_PORTRAIT_RATIO);
  stackH = portraitCardHeight(stackW);
  if (stackW > maxStackW) {
    stackW = maxStackW;
    stackH = portraitCardHeight(stackW);
  }

  let playerStackH = Math.floor(unitH * PLAYER_STACK_SCALE);
  let playerStackW = Math.floor(playerStackH / CARD_PORTRAIT_RATIO);
  playerStackH = portraitCardHeight(playerStackW);
  if (playerStackW > maxPlayerStackW) {
    playerStackW = maxPlayerStackW;
    playerStackH = portraitCardHeight(playerStackW);
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
    playerStackW,
    playerStackH,
    playerStackGap,
    stackGap,
    mainContentH,
  };
}

export function useBoardLayout(inPlay = false): BoardLayoutMetrics {
  const { width, height } = useSafeViewportSize();
  return computeBoardLayout(width, height, inPlay);
}
