import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import Card from './Card';

interface GalleryCardProps {
  card: CardInstance;
  size: number;
  disabled?: boolean;
  onPress?: (card: CardInstance) => void;
  onLongPress?: (card: CardInstance) => void;
}

/** Square gallery card — hover preview shown in right sidebar. */
export const GalleryCard: React.FC<GalleryCardProps> = ({
  card,
  size,
  disabled,
  onPress,
  onLongPress,
}) => (
  <View style={[styles.wrap, { width: size, height: size }]}>
    <Card
      card={card}
      width={size}
      height={size}
      sizeMode="square"
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      hoverPreview
    />
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
});

export default GalleryCard;
