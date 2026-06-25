import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { PlayerState } from '../types/gameTypes';
import { CardInstance } from '../types/cardTypes';
import { Card } from './Card';
import CardPreviewModal from './CardPreviewModal';

interface AnyDiscardDestroyModalProps {
  visible: boolean;
  sourceCardName?: string;
  players: PlayerState[];
  onDestroyCard: (targetPlayerId: string, card: CardInstance) => void;
}

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * 1.4);

export const AnyDiscardDestroyModal: React.FC<AnyDiscardDestroyModalProps> = ({
  visible,
  sourceCardName,
  players,
  onDestroyCard,
}) => {
  const [previewCard, setPreviewCard] = useState<CardInstance | null>(null);
  const piles = players.flatMap((p) =>
    p.discard.map((card) => ({ player: p, card }))
  );

  return (
    <>
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <Text style={styles.title}>Destroy from Discard</Text>
            <Text style={styles.prompt}>
              Choose a card to destroy
              {sourceCardName ? ` (${sourceCardName})` : ''}
            </Text>
            {piles.length === 0 ? (
              <Text style={styles.empty}>No cards in any discard pile.</Text>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator
              >
                {piles.map(({ player, card }) => (
                  <View key={card.instanceId} style={styles.cardWrap}>
                    <Card
                      card={card}
                      width={CARD_W}
                      height={CARD_H}
                      hoverPreview
                      onPress={() => onDestroyCard(player.id, card)}
                      onLongPress={() => setPreviewCard(card)}
                    />
                    <Text style={styles.owner}>{player.name}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
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
  },
  title: {
    color: '#E74C3C',
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
    textAlign: 'center',
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
    textAlign: 'center',
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
  },
  cardWrap: {
    alignItems: 'center',
  },
  owner: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    marginTop: 4,
    fontWeight: '700',
  },
});

export default AnyDiscardDestroyModal;
