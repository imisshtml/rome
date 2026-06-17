import React from 'react';
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
  /** Anchor art to top (gallery squares, short cards) */
  anchorArtTop?: boolean;
  style?: ViewStyle;
}

function badgeSizeFor(width: number): number {
  return Math.max(16, Math.round(width * 0.24));
}

function fontSizeFor(badgeSize: number): number {
  return Math.max(9, Math.round(badgeSize * 0.42));
}

const StatBadge: React.FC<{
  icon: number;
  value: number;
  size: number;
  style?: ViewStyle;
}> = ({ icon, value, size, style }) => (
  <ImageBackground
    source={icon}
    style={[styles.statBadge, { width: size, height: size }, style]}
    imageStyle={styles.statBadgeImage}
    resizeMode="contain"
  >
    <Text style={[styles.statValue, { fontSize: fontSizeFor(size) }]}>{value}</Text>
  </ImageBackground>
);

export const CardFace: React.FC<CardFaceProps> = ({
  definition,
  faceUp,
  width,
  height,
  anchorArtTop = false,
  style,
}) => {
  const badgeSize = badgeSizeFor(width);
  const stats = getCardStatDisplay(definition);
  const cardImage = faceUp ? getCardImage(definition.image) : null;
  const imageSource = faceUp ? cardImage : cardBackImage;

  const webTopAnchor =
    Platform.OS === 'web' && anchorArtTop
      ? ({ objectFit: 'cover', objectPosition: 'top center' } as const)
      : undefined;

  return (
    <View style={[styles.shell, { width, height }, style]}>
      {imageSource ? (
        anchorArtTop && Platform.OS !== 'web' ? (
          <View style={styles.artClip}>
            <Image
              source={imageSource}
              style={{ width, height: height * 1.45 }}
              resizeMode="cover"
            />
          </View>
        ) : (
          <Image
            source={imageSource}
            style={[
              styles.artFill,
              webTopAnchor,
              anchorArtTop && Platform.OS === 'web' ? styles.artTopWeb : null,
            ]}
            resizeMode={anchorArtTop ? 'cover' : 'cover'}
          />
        )
      ) : (
        <View style={[styles.fallbackArt, { backgroundColor: '#333' }]} />
      )}

      {faceUp ? (
        <View style={styles.overlayLayer} pointerEvents="none">
          {stats.cost != null ? (
            <StatBadge
              icon={costIcon}
              value={stats.cost}
              size={badgeSize}
              style={styles.costPos}
            />
          ) : null}
          {stats.victory != null ? (
            <StatBadge
              icon={victoryIcon}
              value={stats.victory}
              size={badgeSize}
              style={styles.victoryPos}
            />
          ) : null}
          {stats.valor != null ? (
            <StatBadge
              icon={valorIcon}
              value={stats.valor}
              size={badgeSize}
              style={styles.valorPos}
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
  artClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  artFill: {
    width: '100%',
    height: '100%',
  },
  artTopWeb: {
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
  costPos: {
    top: 2,
    left: 2,
  },
  victoryPos: {
    top: 2,
    right: 2,
  },
  valorPos: {
    bottom: 2,
    right: 2,
  },
});

export default CardFace;
