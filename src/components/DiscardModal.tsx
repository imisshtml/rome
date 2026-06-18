import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { PlayerState } from '../types/gameTypes';
import { CardInstance, FACTION_COLORS } from '../types/cardTypes';
import { CARD_PORTRAIT_RATIO } from '../utils/cardDisplayUtils';

interface DiscardModalProps {
  player: PlayerState | null;
  visible: boolean;
  onClose: () => void;
  onCardPress?: (card: CardInstance) => void;
}

export const DiscardModal: React.FC<DiscardModalProps> = ({
  player,
  visible,
  onClose,
  onCardPress,
}) => {
  const { width: screenW } = useWindowDimensions();
  if (!player) return null;

  const cardW = Math.min(90, (screenW - 80) / 4);
  const cardH = cardW * CARD_PORTRAIT_RATIO;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.panel, { maxWidth: Math.min(500, screenW - 32) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{player.name} — Discard Pile</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {player.discard.length === 0 ? (
            <Text style={styles.emptyText}>No cards in discard</Text>
          ) : (
            <ScrollView
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
            >
              {player.discard.map((card) => {
                const bg = FACTION_COLORS[card.definition.faction] ?? '#555';
                return (
                  <Pressable
                    key={card.instanceId}
                    onPress={() => onCardPress?.(card)}
                    style={[
                      styles.miniCard,
                      { width: cardW, height: cardH, backgroundColor: bg },
                    ]}
                  >
                    <Text style={styles.miniCost}>{card.definition.cost}</Text>
                    <Text style={styles.miniName} numberOfLines={2}>
                      {card.definition.name}
                    </Text>
                    <Text style={styles.miniValor}>⚔{card.definition.valor}</Text>
                  </Pressable>
                );
              })}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    maxHeight: '70%',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  closeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    padding: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  miniCard: {
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'space-between',
  },
  miniCost: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.3)',
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    lineHeight: 18,
    overflow: 'hidden',
  },
  miniName: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  miniValor: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'right',
  },
});

export default DiscardModal;
