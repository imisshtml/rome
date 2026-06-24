import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { createPortal } from 'react-dom';
import { CardInstance } from '../types/cardTypes';
import { getCardDefinition, isGratiaSupplyDefinition } from '../game/CardDefinitions';
import { getHoverPreviewSize } from '../utils/cardDisplayUtils';
import { computeAdjacentHoverPreviewPosition } from '../utils/hoverPreviewLayout';
import { useHoverPreview } from '../store/useGameStore';
import CardFace from './CardFace';
import GratiaSupplyCard from './GratiaSupplyCard';

/** Stat badges on hover preview — match click modal badge scale. */
const ZOOM_BADGE_SCALE = 0.78;

function HoverPreviewContent({
  card,
  previewW,
  previewH,
}: {
  card: CardInstance;
  previewW: number;
  previewH: number;
}) {
  if (isGratiaSupplyDefinition(card)) {
    return <GratiaSupplyCard width={previewW} height={previewH} />;
  }

  const definition = card.definition ?? getCardDefinition(card.definitionId);
  return (
    <CardFace
      definition={definition}
      faceUp={card.faceUp}
      width={previewW}
      height={previewH}
      badgeScale={ZOOM_BADGE_SCALE}
      chosenFaction={card.chosenFaction}
    />
  );
}

/** Floating enlarged card preview adjacent to the hovered card (web only). */
export const CardHoverPreviewOverlay: React.FC = () => {
  const [hoverPreview] = useHoverPreview();
  const { width: viewportW, height: viewportH } = useWindowDimensions();

  if (Platform.OS !== 'web' || !hoverPreview || typeof document === 'undefined') {
    return null;
  }

  const { card, anchor } = hoverPreview;
  const definition = card.definition ?? getCardDefinition(card.definitionId);
  const { width: previewW, height: previewH } = getHoverPreviewSize(
    viewportW,
    viewportH,
    definition,
    anchor
  );
  const { left, top } = computeAdjacentHoverPreviewPosition(
    anchor,
    previewW,
    previewH,
    viewportW,
    viewportH
  );

  return createPortal(
    <View style={styles.portalWrap} pointerEvents="none">
      <View
        style={[
          styles.previewShell,
          {
            left,
            top,
            width: previewW,
            height: previewH,
          },
        ]}
      >
        <HoverPreviewContent card={card} previewW={previewW} previewH={previewH} />
      </View>
    </View>,
    document.body
  );
};

const styles = StyleSheet.create({
  portalWrap: {
    position: 'fixed' as unknown as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2147483645,
    pointerEvents: 'none',
  },
  previewShell: {
    position: 'absolute',
    zIndex: 2147483646,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 12,
  },
});

/** @deprecated Sidebar dock — use CardHoverPreviewOverlay at GameTable root. */
export const CardHoverPreview: React.FC<{
  card: CardInstance | null;
  width: number;
}> = () => null;

export default CardHoverPreviewOverlay;
