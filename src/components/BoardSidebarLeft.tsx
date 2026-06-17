import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import CardStack from './CardStack';

interface BoardSidebarLeftProps {
  width: number;
  stackW: number;
  stackH: number;
  stackGap: number;
  flavorDeck: CardInstance[];
  disfavorDeck: CardInstance[];
  playerDeck: CardInstance[];
  playerDiscard: CardInstance[];
  onDiscardPress?: () => void;
}

const STACKS = [
  { key: 'events', label: 'Events', color: '#6B3FA0', icon: '🛡', useCardBack: true, cardBackOverlay: false },
  { key: 'favor', label: 'Favors', color: '#3D8B5A', icon: '🌿', useCardBack: true, cardBackOverlay: false },
  { key: 'disfavor', label: 'Disfavor', color: '#C45C7A', icon: '👎', useCardBack: false, showTopCardFace: true, showCount: false, cardBackOverlay: false },
  { key: 'deck', label: 'Deck', color: '#8B6914', icon: '📚', useCardBack: true, cardBackOverlay: false },
  { key: 'discard', label: 'Discard', color: '#3A3A48', icon: '🗑', useCardBack: true, cardBackOverlay: true },
] as const;

export const BoardSidebarLeft: React.FC<BoardSidebarLeftProps> = ({
  width,
  stackW,
  stackH,
  stackGap,
  flavorDeck,
  disfavorDeck,
  playerDeck,
  playerDiscard,
  onDiscardPress,
}) => {
  const cardsByKey: Record<string, CardInstance[]> = {
    events: [],
    favor: flavorDeck,
    disfavor: disfavorDeck,
    deck: playerDeck,
    discard: playerDiscard,
  };

  return (
    <View style={[styles.sidebar, { width, gap: stackGap }]}>
      {STACKS.map((stack) => (
        <CardStack
          key={stack.key}
          cards={cardsByKey[stack.key]}
          label={stack.label}
          color={stack.color}
          icon={stack.icon}
          width={stackW}
          height={stackH}
          sidebarStack
          useCardBack={stack.useCardBack}
          showTopCardFace={'showTopCardFace' in stack ? stack.showTopCardFace : false}
          showCount={'showCount' in stack ? stack.showCount : true}
          cardBackOverlay={stack.cardBackOverlay}
          onPress={stack.key === 'discard' ? onDiscardPress : undefined}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: 'rgba(60,60,70,0.55)',
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
});

export default BoardSidebarLeft;
