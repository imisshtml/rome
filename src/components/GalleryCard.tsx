import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { CARD_PORTRAIT_RATIO } from '../utils/cardDisplayUtils';
import Card from './Card';

interface GalleryCardProps {
  card: CardInstance;
  size: number;
  disabled?: boolean;
  onPress?: (card: CardInstance) => void;
  onLongPress?: (card: CardInstance) => void;
}

/** Gallery slot is square; portrait card fits height with correct 2.5×3.5 aspect. */
export const GalleryCard: React.FC<GalleryCardProps> = ({
  card,
  size,
  disabled,
  onPress,
  onLongPress,
}) => {
  const cardH = size;
  const cardW = Math.round(cardH / CARD_PORTRAIT_RATIO);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GalleryCard;
