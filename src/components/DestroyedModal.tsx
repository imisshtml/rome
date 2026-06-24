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
import { CardInstance } from '../types/cardTypes';
import { CARD_PORTRAIT_RATIO } from '../utils/cardDisplayUtils';
import Card from './Card';

interface DestroyedModalProps {
  cards: CardInstance[];
  visible: boolean;
  onClose: () => void;
  onCardPress?: (card: CardInstance) => void;
}

export const DestroyedModal: React.FC<DestroyedModalProps> = ({
  cards,
  visible,
  onClose,
  onCardPress,
}) => {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(100, (screenW - 80) / 3.5);
  const cardH = cardW * CARD_PORTRAIT_RATIO;
  const topFirst = [...cards].reverse();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.panel, { maxWidth: Math.min(560, screenW - 32) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Destroyed Cards</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {cards.length === 0 ? (
            <Text style={styles.emptyText}>Nothing in destroyed pile</Text>
          ) : (
            <ScrollView
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
            >
              {topFirst.map((card) => (
                <Card
                  key={card.instanceId}
                  card={card}
                  width={cardW}
                  height={cardH}
                  sizeMode="full"
                  hoverPreview={false}
                  onPress={() => onCardPress?.(card)}
                  onLongPress={() => onCardPress?.(card)}
                />
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
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 8,
  },
});

export default DestroyedModal;
