import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, LayoutRectangle } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { CROWD_DISFAVOR, GRATIA_SUPPLY } from '../game/CardDefinitions';
import CardStack from './CardStack';
import GratiaSupplyCard from './GratiaSupplyCard';
import TutorialTarget from './TutorialTarget';

const DISFAVOR_SUPPLY_FACE: CardInstance = {
  instanceId: 'disfavor_supply_face',
  definitionId: CROWD_DISFAVOR.id,
  definition: CROWD_DISFAVOR,
  location: 'DISFAVOR_DECK',
  ownerId: 'market',
  faceUp: true,
};

const GRATIA_SUPPLY_FACE: CardInstance = {
  instanceId: 'gratia_supply_face',
  definitionId: GRATIA_SUPPLY.id,
  definition: GRATIA_SUPPLY,
  location: 'ARENA',
  ownerId: 'market',
  faceUp: true,
};

interface BoardSidebarLeftProps {
  width: number;
  stackW: number;
  stackH: number;
  playerStackW: number;
  playerStackH: number;
  playerStackGap: number;
  stackGap: number;
  galleryDeck: CardInstance[];
  epicDeck: CardInstance[];
  flavorDeck: CardInstance[];
  disfavorDeck: CardInstance[];
  playerDeck: CardInstance[];
  playerDiscard: CardInstance[];
  onDiscardPress?: () => void;
  onDiscardLayout?: (layout: LayoutRectangle) => void;
  onSupplyPreview?: (card: CardInstance) => void;
}

const SUPPLY_STACKS = [
  { key: 'gallery', label: 'Market', color: '#6B3FA0', useCardBack: true, cardBackOverlay: false },
  { key: 'epics', label: 'Epics', color: '#8B5A2B', useCardBack: true, cardBackOverlay: false },
  { key: 'favor', label: 'Favors', color: '#3D8B5A', useCardBack: true, cardBackOverlay: false },
  {
    key: 'disfavor',
    label: 'Disfavor',
    color: '#2C3E50',
    useCardBack: false,
    showCount: false,
    cardBackOverlay: false,
  },
] as const;

const PLAYER_STACKS = [
  { key: 'discard', label: 'Discard', color: '#3A3A48', useCardBack: true, cardBackOverlay: false },
  { key: 'deck', label: 'Deck', color: '#8B6914', useCardBack: true, cardBackOverlay: false },
] as const;

export const BoardSidebarLeft: React.FC<BoardSidebarLeftProps> = ({
  width,
  stackW,
  stackH,
  playerStackW,
  playerStackH,
  playerStackGap,
  stackGap,
  galleryDeck,
  epicDeck,
  flavorDeck,
  disfavorDeck,
  playerDeck,
  playerDiscard,
  onDiscardPress,
  onDiscardLayout,
  onSupplyPreview,
}) => {
  const discardRef = useRef<View>(null);

  const reportDiscardLayout = useCallback(() => {
    discardRef.current?.measureInWindow((x, y, width, height) => {
      onDiscardLayout?.({ x, y, width, height });
    });
  }, [onDiscardLayout]);

  useEffect(() => {
    reportDiscardLayout();
  }, [playerStackW, playerStackH, playerDiscard.length, reportDiscardLayout]);

  const cardsByKey: Record<string, CardInstance[]> = useMemo(
    () => ({
      gallery: galleryDeck,
      epics: epicDeck,
      favor: flavorDeck,
      disfavor: disfavorDeck.length > 0 ? disfavorDeck : [DISFAVOR_SUPPLY_FACE],
      deck: playerDeck,
      discard: playerDiscard,
    }),
    [galleryDeck, epicDeck, flavorDeck, disfavorDeck, playerDeck, playerDiscard]
  );

  const renderSupplyStack = (stack: (typeof SUPPLY_STACKS)[number]) => {
    const cards = cardsByKey[stack.key];
    const stackEl = (
      <CardStack
        key={stack.key}
        cards={cards}
        label={stack.key === 'disfavor' ? '' : stack.label}
        color={stack.color}
        width={stackW}
        height={stackH}
        sidebarStack
        useCardBack={stack.useCardBack}
        showTopCardFace={stack.key === 'disfavor'}
        showCount={'showCount' in stack ? stack.showCount : true}
        cardBackOverlay={stack.cardBackOverlay}
        hoverPreview={stack.key === 'disfavor'}
        onPreview={stack.key === 'disfavor' ? onSupplyPreview : undefined}
      />
    );
    if (stack.key === 'favor') {
      return (
        <TutorialTarget key={stack.key} targetKey="tutorial_favors">
          {stackEl}
        </TutorialTarget>
      );
    }
    return <React.Fragment key={stack.key}>{stackEl}</React.Fragment>;
  };

  const renderPlayerStack = (stack: (typeof PLAYER_STACKS)[number]) => {
    const cards = cardsByKey[stack.key];
    const hasDiscardCards = stack.key === 'discard' && playerDiscard.length > 0;

    const stackEl = (
      <CardStack
        key={stack.key}
        cards={cards}
        label={stack.label}
        color={stack.color}
        width={playerStackW}
        height={playerStackH}
        sidebarStack
        useCardBack={
          stack.key === 'discard' ? !hasDiscardCards : stack.useCardBack
        }
        showTopCardFace={stack.key === 'discard' && hasDiscardCards}
        cardBackOverlay={
          stack.key === 'discard' ? !hasDiscardCards : stack.cardBackOverlay
        }
        onPress={stack.key === 'discard' ? onDiscardPress : undefined}
      />
    );

    if (stack.key !== 'discard') {
      return stackEl;
    }

    return (
      <View key={stack.key} ref={discardRef} onLayout={reportDiscardLayout}>
        {stackEl}
      </View>
    );
  };

  return (
    <View style={[styles.sidebar, { width, gap: stackGap }]}>
      {SUPPLY_STACKS.map(renderSupplyStack)}
      <GratiaSupplyCard
        width={stackW}
        height={stackH}
        previewCard={GRATIA_SUPPLY_FACE}
        hoverPreview
        onPreview={onSupplyPreview}
      />
      <TutorialTarget targetKey="tutorial_deck_discard">
        <View style={[styles.playerRow, { gap: playerStackGap }]}>
          {PLAYER_STACKS.map(renderPlayerStack)}
        </View>
      </TutorialTarget>
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
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});

export default BoardSidebarLeft;
