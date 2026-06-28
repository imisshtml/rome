import React from 'react';
import { View, ScrollView, StyleSheet, Pressable, Text } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { BandingFaction } from '../types/gameTypes';
import { calculateHandFanAngle } from '../utils/dragHelpers';
import { CARD_PORTRAIT_RATIO } from '../utils/cardDisplayUtils';
import Card from './Card';
import BandingKeyChart from './BandingKeyChart';
import TutorialTarget from './TutorialTarget';

interface PlayerHandProps {
  cards: CardInstance[];
  cardWidth?: number;
  cardHeight?: number;
  onCardPress?: (card: CardInstance) => void;
  onLongPress?: (card: CardInstance) => void;
  onDragStart?: (card: CardInstance) => void;
  onDragEnd?: (card: CardInstance, x: number, y: number) => void;
  onDragUpdate?: (x: number, y: number) => void;
  canPlayAllCharity?: boolean;
  onPlayAllCharity?: () => void;
  playArea?: CardInstance[];
  turnPlayedCards?: CardInstance[];
  claimedBandingFactions?: BandingFaction[];
  showBandingKey?: boolean;
  /** Applied only to the card row — faction key / charity btn stay fixed. */
  cardsContainerStyle?: AnimatedStyle<ViewStyle>;
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
  canPlayAllCharity = false,
  onPlayAllCharity,
  playArea = [],
  turnPlayedCards = [],
  claimedBandingFactions = [],
  showBandingKey = false,
  cardsContainerStyle,
  compact = false,
}) => {
  const cardWidth = cardWidthProp ?? (compact ? 72 : 95);
  const cardHeight = cardHeightProp ?? cardWidth * CARD_PORTRAIT_RATIO;
  const overlap = cards.length > 6 ? 0.32 : 0.22;

  return (
    <View style={styles.handHost}>
      <Animated.View style={[styles.cardsWrap, cardsContainerStyle]}>
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
      </Animated.View>

      {showBandingKey ? (
        <TutorialTarget targetKey="tutorial_faction_key" style={styles.bandingOverlay}>
          <View style={styles.bandingInner} pointerEvents="none">
            <BandingKeyChart
              playArea={playArea}
              turnPlayedCards={turnPlayedCards}
              claimedFactions={claimedBandingFactions}
            />
          </View>
        </TutorialTarget>
      ) : null}

      {canPlayAllCharity && onPlayAllCharity ? (
        <Pressable
          style={({ pressed }) => [
            styles.playAllCharityBtn,
            pressed && styles.playAllCharityBtnPressed,
          ]}
          onPress={onPlayAllCharity}
        >
          <Text style={styles.playAllCharityText}>Play All Coins</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  handHost: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
    minWidth: 0,
    overflow: 'visible',
  },
  cardsWrap: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  container: {
    flex: 1,
    overflow: 'visible',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 6,
    paddingBottom: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
    overflow: 'visible',
  },
  cardSlot: {
    marginRight: 2,
  },
  bandingOverlay: {
    position: 'absolute',
    left: 2,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 20,
  },
  bandingInner: {
    flex: 1,
    justifyContent: 'center',
  },
  playAllCharityBtn: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(15, 241, 64, 0.55)',
    backgroundColor: 'rgba(35, 35, 35, 0.75)',
    zIndex: 20,
    height: 45,
  },
  playAllCharityBtnPressed: {
    opacity: 0.75,
    backgroundColor: 'rgba(241,196,15,0.22)',
  },
  playAllCharityText: {
    color: '#f1c40f',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 13,
  },
});

export default PlayerHand;
