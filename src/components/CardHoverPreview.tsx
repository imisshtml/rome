import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { getEnlargedPreviewSize } from '../utils/cardDisplayUtils';
import CardFace from './CardFace';

/** Stat badges on hover preview — smaller than board cards at the same ratio. */
const ZOOM_BADGE_SCALE = 0.78;

interface CardHoverPreviewProps {
  card: CardInstance | null;
  width: number;
}

/** Enlarged card preview docked in the right sidebar on hover. */
export const CardHoverPreview: React.FC<CardHoverPreviewProps> = ({ card, width }) => {
  if (!card) {
    return <View style={[styles.placeholder, { width }]} />;
  }

  const definition = card.definition ?? getCardDefinition(card.definitionId);
  const { width: previewW, height: previewH } = getEnlargedPreviewSize(width, definition);

  return (
    <View style={[styles.panel, { width }]}>
      <CardFace
        definition={definition}
        faceUp={card.faceUp}
        width={previewW}
        height={previewH}
        badgeScale={ZOOM_BADGE_SCALE}
        chosenFaction={card.chosenFaction}
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
