import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  Platform,
  ViewStyle,
  ImageStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardDefinition, Faction } from '../types/cardTypes';
import {
  costIcon,
  valorIcon,
  victoryIcon,
  cardBack as cardBackImage,
  getCardImage,
  factionIconLudus,
  factionIconLegion,
  factionIconSenate,
  factionIconEpic,
} from '../assets/images';
import { getCardStatDisplay, isLandscapeCard } from '../utils/cardDisplayUtils';
import {
  getCardDisplayFaction,
  requiresFactionChoiceOnPlay,
  SPY_FACTION_CHOICES,
} from '../utils/cardFactionUtils';
import { BANDING_FACTION_ICONS } from '../utils/factionIconAssets';

const FACTION_ICONS: Partial<Record<Faction, number>> = {
  Ludus: factionIconLudus,
  Legion: factionIconLegion,
  Senate: factionIconSenate,
  Epic: factionIconEpic,
};

interface CardFaceProps {
  definition: CardDefinition;
  faceUp: boolean;
  width: number;
  height: number;
  /** Multiplier on stat badge size (e.g. zoom previews). */
  badgeScale?: number;
  /** Spy morph — overrides definition faction for faction icon. */
  chosenFaction?: Faction | null;
  style?: ViewStyle;
}

/** Corner offsets tuned at sidebar zoom width (~192px); scale with card width. */
const BADGE_REF_WIDTH = 192;
const BADGE_SIZE_RATIO = 0.16;

function fontSizeFor(badgeSize: number): number {
  return Math.max(9, Math.round(badgeSize * 0.42));
}

function badgeLayout(width: number, badgeScale = 1) {
  const scale = width / BADGE_REF_WIDTH;
  const size = Math.round(width * BADGE_SIZE_RATIO * badgeScale);
  return {
    size,
    cost: { top: -1 * scale, left: -1 * scale },
    victory: { top: -1 * scale, right: -1 * scale },
    valor: { bottom: -1 * scale, right: -3 * scale },
    faction: { left: -1 * scale, bottom: -1 * scale },
    statPaddingBottom: Math.round(size * 0.13),
    costStatPaddingBottom: Math.round(size * 0.065),
  };
}

function effectOverlayLayout(
  height: number,
  width: number,
  badgeSize: number,
  hasFactionIcon: boolean,
  hasValorBadge: boolean,
  isLandscape = false
) {
  const scale = width / BADGE_REF_WIDTH;
  const gradientHeight = isLandscape ? height / 2.4 : height / 3;
  const fontSize = isLandscape
    ? Math.max(8, Math.round(width * 0.028))
    : Math.max(6, Math.round(height * 0.02));
  const badgeGap = Math.max(6, Math.round(badgeSize * 0.22));
  const iconReserve = hasFactionIcon ? badgeSize + badgeGap : 8;
  const textPadding = Math.max(4, Math.round(height * 0.028));
  const rightReserve = hasValorBadge
    ? Math.max(textPadding, badgeSize - 3 * scale + badgeGap)
    : textPadding;

  return {
    gradientHeight,
    fontSize,
    lineHeight: Math.round(fontSize * 1.28),
    iconReserve,
    rightReserve,
    textPadding,
  };
}

const StatBadge: React.FC<{
  icon: number;
  value: number;
  size: number;
  position: ViewStyle;
  statPaddingBottom: number;
  costStatPaddingBottom?: number;
}> = ({ icon, value, size, position, statPaddingBottom, costStatPaddingBottom }) => (
  <ImageBackground
    source={icon}
    style={[styles.statBadge, { width: size, height: size }, position]}
    imageStyle={styles.statBadgeImage}
    resizeMode="contain"
  >
    <Text
      style={[
        styles.statValue,
        {
          fontSize: fontSizeFor(size),
          paddingBottom: costStatPaddingBottom ?? statPaddingBottom,
        },
      ]}
    >
      {value}
    </Text>
  </ImageBackground>
);

const webContainStyle =
  Platform.OS === 'web'
    ? ({ objectFit: 'contain', objectPosition: 'center' } as const)
    : undefined;

const FactionIcon: React.FC<{
  faction: Faction;
  size: number;
  position: ImageStyle;
}> = ({ faction, size, position }) => {
  const icon = FACTION_ICONS[faction];
  if (!icon) return null;

  return (
    <Image
      source={icon}
      style={[styles.factionIcon, { width: size, height: size }, position]}
      resizeMode="contain"
    />
  );
};

const SpyFactionIcons: React.FC<{
  size: number;
  position: ImageStyle;
}> = ({ size, position }) => {
  const iconSize = Math.max(10, Math.round(size * 0.68));
  const overlap = Math.round(iconSize * 0.26);

  return (
    <View
      style={[
        styles.spyFactionRow,
        position,
        { height: iconSize, minWidth: iconSize * 2.2 },
      ]}
    >
      {SPY_FACTION_CHOICES.map((faction, index) => (
        <Image
          key={faction}
          source={BANDING_FACTION_ICONS[faction]}
          style={[
            styles.factionIcon,
            {
              width: iconSize,
              height: iconSize,
              marginLeft: index === 0 ? 0 : -overlap,
              zIndex: index + 1,
            },
          ]}
          resizeMode="contain"
        />
      ))}
    </View>
  );
};

export const CardFace: React.FC<CardFaceProps> = ({
  definition,
  faceUp,
  width,
  height,
  badgeScale = 1,
  chosenFaction,
  style,
}) => {
  const layout = useMemo(() => badgeLayout(width, badgeScale), [width, badgeScale]);
  const stats = getCardStatDisplay(definition);
  const displayFaction = useMemo(
    () => getCardDisplayFaction(definition, chosenFaction),
    [definition, chosenFaction]
  );
  const showsSpyFactionPicker =
    requiresFactionChoiceOnPlay(definition) && !chosenFaction && !displayFaction;
  const landscape = isLandscapeCard(definition);
  const effectLayout = useMemo(
    () =>
      effectOverlayLayout(
        height,
        width,
        layout.size,
        displayFaction != null || showsSpyFactionPicker,
        stats.valor != null,
        landscape
      ),
    [height, width, layout.size, displayFaction, showsSpyFactionPicker, stats.valor, landscape]
  );
  const effectText = definition.text?.trim() ?? '';
  const cardImage = faceUp ? getCardImage(definition.image) : null;
  const imageSource = faceUp ? cardImage : cardBackImage;

  return (
    <View style={[styles.shell, { width, height }, style]}>
      {imageSource ? (
        <Image
          source={imageSource}
          style={[styles.artFill, webContainStyle]}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.fallbackArt, { backgroundColor: '#333' }]} />
      )}

      {faceUp ? (
        <View style={styles.overlayLayer} pointerEvents="none">
          <View
            style={[styles.bottomGradient, { height: effectLayout.gradientHeight }]}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
              locations={[0, 0.42, 1]}
              style={StyleSheet.absoluteFill}
            />
            {effectText ? (
              <Text
                style={[
                  styles.effectText,
                  {
                    left: effectLayout.iconReserve,
                    right: effectLayout.rightReserve,
                    bottom: effectLayout.textPadding,
                    fontSize: effectLayout.fontSize,
                    lineHeight: effectLayout.lineHeight,
                  },
                ]}
                numberOfLines={4}
              >
                {effectText}
              </Text>
            ) : null}
          </View>
          {stats.cost != null ? (
            <StatBadge
              icon={costIcon}
              value={stats.cost}
              size={layout.size}
              position={layout.cost}
              statPaddingBottom={layout.statPaddingBottom}
              costStatPaddingBottom={layout.costStatPaddingBottom}
            />
          ) : null}
          {stats.victory != null ? (
            <StatBadge
              icon={victoryIcon}
              value={stats.victory}
              size={layout.size}
              position={layout.victory}
              statPaddingBottom={layout.statPaddingBottom}
            />
          ) : null}
          {stats.valor != null ? (
            <StatBadge
              icon={valorIcon}
              value={stats.valor}
              size={layout.size}
              position={layout.valor}
              statPaddingBottom={layout.statPaddingBottom}
              costStatPaddingBottom={layout.costStatPaddingBottom}
            />
          ) : null}
          {displayFaction ? (
            <FactionIcon
              faction={displayFaction}
              size={layout.size}
              position={layout.faction}
            />
          ) : showsSpyFactionPicker ? (
            <SpyFactionIcons size={layout.size} position={layout.faction} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#12122a',
  },
  artFill: {
    width: '100%',
    height: '100%',
  },
  fallbackArt: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  effectText: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.94)',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statBadge: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
  },
  statBadgeImage: {
    resizeMode: 'contain',
  },
  statValue: {
    color: '#fff',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  factionIcon: {
    position: 'absolute',
  },
  spyFactionRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});

export default CardFace;
