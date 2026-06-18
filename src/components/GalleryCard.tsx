import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { CARD_PORTRAIT_RATIO } from '../utils/cardDisplayUtils';
import Card from './Card';

interface GalleryCardProps {
  card: CardInstance;
  /** Portrait card height in px (2.5×3.5 aspect). */
  height?: number;
  /** @deprecated use height */
  size?: number;
  disabled?: boolean;
  onPress?: (card: CardInstance) => void;
  onLongPress?: (card: CardInstance) => void;
}

export const GalleryCard: React.FC<GalleryCardProps> = ({
  card,
  height: heightProp,
  size,
  disabled,
  onPress,
  onLongPress,
}) => {
  const cardH = heightProp ?? size ?? 80;
  const cardW = cardH / CARD_PORTRAIT_RATIO;

  return (
    <View style={[styles.wrap, { width: cardW, height: cardH }]}>
      <Card
        card={card}
        width={cardW}
        height={cardH}
        sizeMode="full"
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        hoverPreview
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
});

export default GalleryCard;
