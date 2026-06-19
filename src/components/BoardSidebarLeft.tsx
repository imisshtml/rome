import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, LayoutRectangle } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { CROWD_DISFAVOR } from '../game/CardDefinitions';
import CardStack from './CardStack';

const DISFAVOR_SUPPLY_FACE: CardInstance = {
  instanceId: 'disfavor_supply_face',
  definitionId: CROWD_DISFAVOR.id,
  definition: CROWD_DISFAVOR,
  location: 'DISFAVOR_DECK',
  ownerId: 'market',
  faceUp: true,
};

interface BoardSidebarLeftProps {
  width: number;
  stackW: number;
  stackH: number;
  stackGap: number;
  galleryDeck: CardInstance[];
  flavorDeck: CardInstance[];
  disfavorDeck: CardInstance[];
  playerDeck: CardInstance[];
  playerDiscard: CardInstance[];
  onDiscardPress?: () => void;
  onDiscardLayout?: (layout: LayoutRectangle) => void;
}

const STACKS = [
  { key: 'gallery', label: 'Gallery', color: '#6B3FA0', icon: '🛡', useCardBack: true, cardBackOverlay: false },
  { key: 'favor', label: 'Favors', color: '#3D8B5A', icon: '🌿', useCardBack: true, cardBackOverlay: false },
  { key: 'disfavor', label: 'Disfavor', color: '#2C3E50', useCardBack: false, showCount: false, cardBackOverlay: false },
  { key: 'deck', label: 'Deck', color: '#8B6914', icon: '📚', useCardBack: true, cardBackOverlay: false },
  { key: 'discard', label: 'Discard', color: '#3A3A48', icon: '🗑', useCardBack: true, cardBackOverlay: false },
] as const;

export const BoardSidebarLeft: React.FC<BoardSidebarLeftProps> = ({
  width,
  stackW,
  stackH,
  stackGap,
  galleryDeck,
  flavorDeck,
  disfavorDeck,
  playerDeck,
  playerDiscard,
  onDiscardPress,
  onDiscardLayout,
}) => {
  const discardRef = useRef<View>(null);

  const reportDiscardLayout = useCallback(() => {
    discardRef.current?.measureInWindow((x, y, width, height) => {
      onDiscardLayout?.({ x, y, width, height });
    });
  }, [onDiscardLayout]);

  useEffect(() => {
    reportDiscardLayout();
  }, [stackW, stackH, playerDiscard.length, reportDiscardLayout]);

  const cardsByKey: Record<string, CardInstance[]> = useMemo(
    () => ({
      gallery: galleryDeck,
      favor: flavorDeck,
      disfavor:
        disfavorDeck.length > 0 ? disfavorDeck : [DISFAVOR_SUPPLY_FACE],
      deck: playerDeck,
      discard: playerDiscard,
    }),
    [galleryDeck, flavorDeck, disfavorDeck, playerDeck, playerDiscard]
  );

  return (
    <View style={[styles.sidebar, { width, gap: stackGap }]}>
      {STACKS.map((stack) => {
        const cards = cardsByKey[stack.key];
        const hasDiscardCards = stack.key === 'discard' && playerDiscard.length > 0;

        const stackEl = (
          <CardStack
            key={stack.key}
            cards={cards}
            label={stack.key === 'disfavor' ? '' : stack.label}
            color={stack.color}
            width={stackW}
            height={stackH}
            sidebarStack
            useCardBack={
              stack.key === 'discard'
                ? !hasDiscardCards
                : stack.useCardBack
            }
            showTopCardFace={
              stack.key === 'disfavor' ||
              (stack.key === 'discard' && hasDiscardCards)
            }
            showCount={'showCount' in stack ? stack.showCount : true}
            cardBackOverlay={
              stack.key === 'discard'
                ? !hasDiscardCards
                : stack.cardBackOverlay
            }
            onPress={stack.key === 'discard' ? onDiscardPress : undefined}
          />
        );

        if (stack.key !== 'discard') {
          return stackEl;
        }

        return (
          <View
            key={stack.key}
            ref={discardRef}
            onLayout={reportDiscardLayout}
          >
            {stackEl}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRightWidth: 1,
    borderRightColor: 'rgba(212,175,55,0.3)',
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
    overflow: 'hidden',
  },
});

export default BoardSidebarLeft;
