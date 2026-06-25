import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { Card } from './Card';
import CardPreviewModal from './CardPreviewModal';

interface CardDestroyPickModalProps {
  visible: boolean;
  sourceCardName?: string;
  remaining: number;
  fromZones: ('hand' | 'discard' | 'play_area')[];
  optional?: boolean;
  localHand: CardInstance[];
  localDiscard: CardInstance[];
  localPlayArea: CardInstance[];
  onDestroyCard: (
    card: CardInstance,
    sourceZone: 'hand' | 'discard' | 'play_area'
  ) => void;
  onSkip?: () => void;
}

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * 1.4);

export const CardDestroyPickModal: React.FC<CardDestroyPickModalProps> = ({
  visible,
  sourceCardName,
  remaining,
  fromZones,
  optional,
  localHand,
  localDiscard,
  localPlayArea,
  onDestroyCard,
  onSkip,
}) => {
  const [previewCard, setPreviewCard] = useState<CardInstance | null>(null);

  const destroyCards: {
    card: CardInstance;
    zone: 'hand' | 'discard' | 'play_area';
  }[] = [];

  if (fromZones.includes('hand')) {
    destroyCards.push(...localHand.map((card) => ({ card, zone: 'hand' as const })));
  }
  if (fromZones.includes('discard')) {
    destroyCards.push(
      ...localDiscard.map((card) => ({ card, zone: 'discard' as const }))
    );
  }
  if (fromZones.includes('play_area')) {
    destroyCards.push(
      ...localPlayArea.map((card) => ({ card, zone: 'play_area' as const }))
    );
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <Text style={styles.title}>Destroy a Card</Text>
            <Text style={styles.prompt}>
              Choose {remaining} card{remaining === 1 ? '' : 's'} to destroy
              {sourceCardName ? ` (${sourceCardName})` : ''}
            </Text>
            {destroyCards.length === 0 ? (
              <Text style={styles.empty}>No valid cards available.</Text>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator
              >
                {destroyCards.map(({ card, zone }) => (
                  <View key={card.instanceId} style={styles.cardWrap}>
                    <Card
                      card={card}
                      width={CARD_W}
                      height={CARD_H}
                      hoverPreview
                      onPress={() => onDestroyCard(card, zone)}
                      onLongPress={() => setPreviewCard(card)}
                    />
                    {zone !== 'hand' ? (
                      <Text style={styles.zoneTag}>
                        {zone === 'discard' ? 'Discard' : 'In play'}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}
            {optional && onSkip ? (
              <Pressable style={styles.skipBtn} onPress={onSkip}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <CardPreviewModal
        card={previewCard}
        visible={previewCard != null}
        onClose={() => setPreviewCard(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 760,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.45)',
    alignItems: 'center',
  },
  title: {
    color: '#E74C3C',
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  prompt: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  empty: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginBottom: 12,
  },
  scroll: {
    width: '100%',
    maxHeight: 520,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cardWrap: {
    alignItems: 'center',
    gap: 4,
  },
  zoneTag: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  skipBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  skipText: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default CardDestroyPickModal;
