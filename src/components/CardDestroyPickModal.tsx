import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { CardFace } from './CardFace';

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

const CARD_W = 88;
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
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.handRow}
            >
              {destroyCards.map(({ card, zone }) => (
                <Pressable
                  key={card.instanceId}
                  onPress={() => onDestroyCard(card, zone)}
                  style={styles.handCardBtn}
                >
                  <CardFace
                    definition={
                      card.definition ?? getCardDefinition(card.definitionId)
                    }
                    faceUp={card.faceUp}
                    width={CARD_W}
                    height={CARD_H}
                    chosenFaction={card.chosenFaction}
                  />
                  {zone !== 'hand' ? (
                    <Text style={styles.zoneTag}>
                      {zone === 'discard' ? 'Discard' : 'In play'}
                    </Text>
                  ) : null}
                </Pressable>
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
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 420,
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
  handRow: {
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  handCardBtn: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  zoneTag: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 8,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  skipBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  skipText: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default CardDestroyPickModal;
