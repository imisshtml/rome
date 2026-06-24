import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CardInstance } from '../types/cardTypes';
import { gratiaImage, victoryIcon } from '../assets/images';
import { useSidebarPreview } from '../hooks/useSidebarPreview';

interface GratiaSupplyCardProps {
  width: number;
  height: number;
  previewCard?: CardInstance;
  hoverPreview?: boolean;
  onPreview?: (card: CardInstance) => void;
}

const BADGE_REF_WIDTH = 192;
const BADGE_SIZE_RATIO = 0.16;

function fontSizeFor(badgeSize: number): number {
  return Math.max(9, Math.round(badgeSize * 0.42));
}

function badgeLayout(width: number) {
  const scale = width / BADGE_REF_WIDTH;
  const size = Math.round(width * BADGE_SIZE_RATIO);
  return {
    size,
    victory: { top: -1 * scale, right: -1 * scale },
    statPaddingBottom: Math.round(size * 0.13),
  };
}

const webContainStyle =
  Platform.OS === 'web'
    ? ({ objectFit: 'contain', objectPosition: 'center' } as const)
    : undefined;

export const GratiaSupplyCard: React.FC<GratiaSupplyCardProps> = ({
  width,
  height,
  previewCard,
  hoverPreview = false,
  onPreview,
}) => {
  const hoverAnchorRef = useRef<View>(null);
  const { hoverProps, handlePress } = useSidebarPreview(previewCard ?? null, hoverAnchorRef, {
    enabled: hoverPreview && !!previewCard,
    onPreview,
  });
  const layout = badgeLayout(width);
  const fontSize = Math.max(6, Math.round(height * 0.02));
  const gradientHeight = height / 3;

  return (
    <Pressable
      ref={hoverAnchorRef}
      {...hoverProps}
      onPress={onPreview ? handlePress : undefined}
      style={({ pressed }) => [pressed && onPreview && styles.pressed]}
    >
      <View style={[styles.shell, { width, height }]}>
      <Image
        source={gratiaImage}
        style={[styles.artFill, webContainStyle]}
        resizeMode="contain"
      />
      <View style={styles.overlayLayer} pointerEvents="none">
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
          style={[styles.bottomGradient, { height: gradientHeight }]}
        />
        <Text
          style={[
            styles.effectText,
            {
              fontSize,
              lineHeight: Math.round(fontSize * 1.28),
              bottom: Math.max(4, Math.round(height * 0.028)),
              left: Math.max(4, Math.round(height * 0.028)),
              right: Math.max(4, Math.round(height * 0.028)),
            },
          ]}
          numberOfLines={2}
        >
          +1 Coin
        </Text>
        <ImageBackground
          source={victoryIcon}
          style={[
            styles.statBadge,
            { width: layout.size, height: layout.size },
            layout.victory,
          ]}
          imageStyle={styles.statBadgeImage}
          resizeMode="contain"
        >
          <Text
            style={[
              styles.statValue,
              {
                fontSize: fontSizeFor(layout.size),
                paddingBottom: layout.statPaddingBottom,
              },
            ]}
          >
            1
          </Text>
        </ImageBackground>
      </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.88,
  },
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
});

export default GratiaSupplyCard;
