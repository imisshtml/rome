import { useWindowDimensions } from 'react-native';

export type LayoutTier = 'desktop' | 'standard' | 'compact';

export function getLayoutTier(width: number, height: number): LayoutTier {
  const isCompactHeight = height < 750;
  const isTabletLandscape = width >= 600 && width > height && height < 850;
  if (isCompactHeight || isTabletLandscape) return 'compact';
  if (width >= 900) return 'desktop';
  return 'standard';
}

export interface ZoneMetrics {
  tier: LayoutTier;
  arenaCardW: number;
  arenaCardH: number;
  galleryCardW: number;
  galleryCardH: number;
  playCardW: number;
  playCardH: number;
  stackW: number;
  stackH: number;
  epicCardW: number;
  epicCardH: number;
  sectionGap: number;
  contentPadding: number;
  compactPhaseBar: boolean;
  compactOpponents: boolean;
  epicHorizontal: boolean;
  galleryHorizontalScroll: boolean;
  hideLocalPlayerInfo: boolean;
  arenaBossCompact: boolean;
  playAreaMinHeight: number;
  arenaCommitMinWidth: number;
  arenaCommitMinHeight: number;
}

export function getZoneMetrics(tier: LayoutTier, width: number): ZoneMetrics {
  const isMobile = width < 600;

  if (tier === 'compact') {
    const galleryCardW = 68;
    const playCardW = 58;
    const stackW = isMobile ? 48 : 52;
    return {
      tier,
      arenaCardW: 88,
      arenaCardH: 88 * 1.35,
      galleryCardW,
      galleryCardH: galleryCardW * 1.35,
      playCardW,
      playCardH: playCardW * 1.35,
      stackW,
      stackH: stackW * 1.25,
      epicCardW: 62,
      epicCardH: 62 * 1.2,
      sectionGap: 6,
      contentPadding: 6,
      compactPhaseBar: true,
      compactOpponents: true,
      epicHorizontal: true,
      galleryHorizontalScroll: true,
      hideLocalPlayerInfo: true,
      arenaBossCompact: true,
      playAreaMinHeight: 72,
      arenaCommitMinWidth: 180,
      arenaCommitMinHeight: 72,
    };
  }

  if (tier === 'desktop') {
    const galleryCardW = Math.round(110 * 1.1);
    const playCardW = 90;
    const stackW = 78;
    return {
      tier,
      arenaCardW: 142,
      arenaCardH: 142 * 1.4,
      galleryCardW,
      galleryCardH: galleryCardW * 1.4,
      playCardW,
      playCardH: playCardW * 1.4,
      stackW,
      stackH: stackW * 1.38,
      epicCardW: 85,
      epicCardH: 85 * 1.25,
      sectionGap: 12,
      contentPadding: 10,
      compactPhaseBar: false,
      compactOpponents: false,
      epicHorizontal: false,
      galleryHorizontalScroll: false,
      hideLocalPlayerInfo: false,
      arenaBossCompact: false,
      playAreaMinHeight: 108,
      arenaCommitMinWidth: 300,
      arenaCommitMinHeight: 115,
    };
  }

  // standard (tablet portrait, medium screens)
  const galleryCardW = Math.round(95 * 1.1);
  const playCardW = 72;
  const stackW = isMobile ? 58 : 68;
  return {
    tier,
    arenaCardW: 120,
    arenaCardH: 120 * 1.4,
    galleryCardW,
    galleryCardH: galleryCardW * 1.4,
    playCardW,
    playCardH: playCardW * 1.4,
    stackW,
    stackH: stackW * 1.38,
    epicCardW: 65,
    epicCardH: 65 * 1.25,
    sectionGap: 10,
    contentPadding: 8,
    compactPhaseBar: false,
    compactOpponents: false,
    epicHorizontal: false,
    galleryHorizontalScroll: false,
    hideLocalPlayerInfo: false,
    arenaBossCompact: false,
    playAreaMinHeight: 100,
    arenaCommitMinWidth: 260,
    arenaCommitMinHeight: 100,
  };
}

export function useLayoutMetrics(): ZoneMetrics {
  const { width, height } = useWindowDimensions();
  const tier = getLayoutTier(width, height);
  return getZoneMetrics(tier, width);
}
