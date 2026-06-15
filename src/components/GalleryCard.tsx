import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import Card from './Card';

interface GalleryCardProps {
  card: CardInstance;
  size: number;
  disabled?: boolean;
  onPress?: (card: CardInstance) => void;
  onLongPress?: (card: CardInstance) => void;
}

/** Square gallery card — hover (web) reveals full portrait preview. */
export const GalleryCard: React.FC<GalleryCardProps> = ({
  card,
  size,
  disabled,
  onPress,
  onLongPress,
}) => {
  const [hovered, setHovered] = useState(false);

  const hoverProps =
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }
      : {};

  const previewW = Math.round(size * 1.35);
  const previewH = Math.round(previewW * 1.4);

  return (
    <View style={[styles.wrap, { width: size, height: size }]} {...hoverProps}>
      <Card
        card={card}
        width={size}
        height={size}
        sizeMode="square"
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
      />
      {hovered && (
        <View style={[styles.preview, { left: size + 6, top: -8 }]}>
          <Card
            card={card}
            width={previewW}
            height={previewH}
            sizeMode="full"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 1,
  },
  preview: {
    position: 'absolute',
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 16,
  },
});

export default GalleryCard;
