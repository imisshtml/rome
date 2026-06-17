import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import CardFace from './CardFace';

interface CardHoverPreviewProps {
  card: CardInstance | null;
  width: number;
}

/** Enlarged card preview docked in the right sidebar on hover. */
export const CardHoverPreview: React.FC<CardHoverPreviewProps> = ({ card, width }) => {
  if (!card) {
    return <View style={[styles.placeholder, { width }]} />;
  }

  const previewW = Math.min(width - 8, 160);
  const previewH = Math.round(previewW * 1.45);

  return (
    <View style={[styles.panel, { width }]}>
      <CardFace
        definition={card.definition}
        faceUp={card.faceUp}
        width={previewW}
        height={previewH}
        anchorArtTop={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
    zIndex: 50,
  },
  placeholder: {
    minHeight: 8,
  },
});

export default CardHoverPreview;
