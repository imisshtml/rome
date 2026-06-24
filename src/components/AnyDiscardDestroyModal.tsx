import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { PlayerState } from '../types/gameTypes';
import { CardInstance } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { CardFace } from './CardFace';

interface AnyDiscardDestroyModalProps {
  visible: boolean;
  sourceCardName?: string;
  players: PlayerState[];
  onDestroyCard: (targetPlayerId: string, card: CardInstance) => void;
}

const CARD_W = 80;
const CARD_H = Math.round(CARD_W * 1.4);

export const AnyDiscardDestroyModal: React.FC<AnyDiscardDestroyModalProps> = ({
  visible,
  sourceCardName,
  players,
  onDestroyCard,
}) => {
  const piles = players.flatMap((p) =>
    p.discard.map((card) => ({ player: p, card }))
  );

  return (
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
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.row}
            >
              {piles.map(({ player, card }) => (
                <Pressable
                  key={card.instanceId}
                  onPress={() => onDestroyCard(player.id, card)}
                  style={styles.cardBtn}
                >
                  <CardFace
                    definition={
                      card.definition ?? getCardDefinition(card.definitionId)
                    }
                    faceUp={card.faceUp}
                    width={CARD_W}
                    height={CARD_H}
                  />
                  <Text style={styles.owner}>{player.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
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
  row: {
    gap: 8,
    paddingVertical: 4,
  },
  cardBtn: {
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
