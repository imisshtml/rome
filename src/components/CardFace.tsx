import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  Platform,
  ViewStyle,
} from 'react-native';
import { CardDefinition } from '../types/cardTypes';
import {
  costIcon,
  valorIcon,
  victoryIcon,
  cardBack as cardBackImage,
  getCardImage,
} from '../assets/images';
import { getCardStatDisplay } from '../utils/cardDisplayUtils';

interface CardFaceProps {
  definition: CardDefinition;
  faceUp: boolean;
  width: number;
  height: number;
  /** Multiplier on stat badge size (e.g. zoom previews). */
  badgeScale?: number;
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
    statPaddingBottom: Math.round(size * 0.13),
    costStatPaddingBottom: Math.round(size * 0.065),
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

export const CardFace: React.FC<CardFaceProps> = ({
  definition,
  faceUp,
  width,
  height,
  badgeScale = 1,
  style,
}) => {
  const layout = useMemo(() => badgeLayout(width, badgeScale), [width, badgeScale]);
  const stats = getCardStatDisplay(definition);
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
});

export default CardFace;
