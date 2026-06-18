import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { calculateHandFanAngle } from '../utils/dragHelpers';
import { CARD_PORTRAIT_RATIO } from '../utils/cardDisplayUtils';
import Card from './Card';

interface PlayerHandProps {
  cards: CardInstance[];
  cardWidth?: number;
  cardHeight?: number;
  onCardPress?: (card: CardInstance) => void;
  onLongPress?: (card: CardInstance) => void;
  onDragStart?: (card: CardInstance) => void;
  onDragEnd?: (card: CardInstance, x: number, y: number) => void;
  onDragUpdate?: (x: number, y: number) => void;
  /** @deprecated pass cardWidth/cardHeight from board layout */
  compact?: boolean;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  cardWidth: cardWidthProp,
  cardHeight: cardHeightProp,
  onCardPress,
  onLongPress,
  onDragStart,
  onDragEnd,
  onDragUpdate,
  compact = false,
}) => {
  const cardWidth = cardWidthProp ?? (compact ? 72 : 95);
  const cardHeight = cardHeightProp ?? cardWidth * CARD_PORTRAIT_RATIO;
  const overlap = cards.length > 6 ? 0.32 : 0.22;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.container}
    >
      {cards.map((card, index) => {
        const angle = calculateHandFanAngle(index, cards.length, 8);
        const yOffset = Math.abs(angle) * 0.8;

        return (
          <View
            key={card.instanceId}
            style={[
              styles.cardSlot,
              {
                marginLeft: index === 0 ? 0 : -cardWidth * overlap,
                zIndex: index + 1,
                transform: [
                  { rotate: `${angle}deg` },
                  { translateY: yOffset },
                ],
              },
            ]}
          >
            <Card
              card={card}
              width={cardWidth}
              height={cardHeight}
              sizeMode="full"
              draggable
              onPress={onCardPress}
              onLongPress={onLongPress}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragUpdate={onDragUpdate}
            />
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'visible',
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    alignItems: 'flex-end',
    flexGrow: 1,
    justifyContent: 'center',
    overflow: 'visible',
  },
  cardSlot: {
    marginRight: 2,
  },
});

export default PlayerHand;
