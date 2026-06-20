import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { buyIcon } from '../assets/images';
import { CARD_PORTRAIT_RATIO } from '../utils/cardDisplayUtils';
import Card from './Card';

interface GalleryCardProps {
  card: CardInstance;
  /** Portrait card height in px (2.5×3.5 aspect). */
  height?: number;
  /** @deprecated use height */
  size?: number;
  disabled?: boolean;
  /** Card was bought — show overlay and buy icon until gallery refill. */
  purchased?: boolean;
  onPress?: (card: CardInstance) => void;
  onLongPress?: (card: CardInstance) => void;
}

export const GalleryCard: React.FC<GalleryCardProps> = ({
  card,
  height: heightProp,
  size,
  disabled,
  purchased = false,
  onPress,
  onLongPress,
}) => {
  const cardH = heightProp ?? size ?? 80;
  const cardW = cardH / CARD_PORTRAIT_RATIO;
  const isDisabled = disabled || purchased;

  return (
    <View style={[styles.wrap, { width: cardW, height: cardH }]}>
      <Card
        card={card}
        width={cardW}
        height={cardH}
        sizeMode="full"
        disabled={isDisabled}
        onPress={onPress}
        onLongPress={onLongPress}
        hoverPreview={!purchased}
      />
      {purchased ? (
        <>
          <View style={styles.purchasedOverlay} pointerEvents="none" />
          <View style={styles.buyIconWrap} pointerEvents="none">
            <Image source={buyIcon} style={styles.buyIcon} resizeMode="contain" />
          </View>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  purchasedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    zIndex: 1,
  },
  buyIconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  buyIcon: {
    width: '60%',
    height: '60%',
  },
});

export default GalleryCard;
