import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { PendingDeckTopRevealPick } from '../types/gameTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { CardFace } from './CardFace';
import { getCurrentDeckTopRevealPick } from '../utils/deckTopRevealUtils';

interface DeckTopRevealModalProps {
  pending: PendingDeckTopRevealPick | null;
  visible: boolean;
  onResolve: (choice: 'destroy' | 'return') => void;
}

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * 1.4);

export const DeckTopRevealModal: React.FC<DeckTopRevealModalProps> = ({
  pending,
  visible,
  onResolve,
}) => {
  if (!pending) return null;
  const current = getCurrentDeckTopRevealPick(pending);
  if (!current) return null;

  const definition =
    current.card.definition ?? getCardDefinition(current.card.definitionId);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Executioner</Text>
          <Text style={styles.subtitle}>{pending.sourceCardName ?? 'Card'}</Text>
          <Text style={styles.body}>
            {current.targetPlayerName}&apos;s deck top ({pending.currentIndex + 1}/
            {pending.picks.length})
          </Text>
          <CardFace
            definition={definition}
            faceUp
            width={CARD_W}
            height={CARD_H}
          />
          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, styles.returnBtn]}
              onPress={() => onResolve('return')}
            >
              <Text style={styles.actionText}>Return to top</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.destroyBtn]}
              onPress={() => onResolve('destroy')}
            >
              <Text style={styles.actionText}>Destroy</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: '#f1c40f',
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  body: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  returnBtn: {
    borderColor: 'rgba(52,152,219,0.45)',
    backgroundColor: 'rgba(52,152,219,0.12)',
  },
  destroyBtn: {
    borderColor: 'rgba(192,57,43,0.55)',
    backgroundColor: 'rgba(192,57,43,0.15)',
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default DeckTopRevealModal;
