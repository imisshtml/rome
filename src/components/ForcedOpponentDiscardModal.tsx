import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { PendingForcedOpponentDiscards, PlayerState } from '../types/gameTypes';
import { CardInstance } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { CardFace } from './CardFace';

interface ForcedOpponentDiscardModalProps {
  pending: PendingForcedOpponentDiscards | null;
  targetPlayer: PlayerState | null;
  visible: boolean;
  onChoose: (card: CardInstance) => void;
}

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * 1.4);

export const ForcedOpponentDiscardModal: React.FC<ForcedOpponentDiscardModalProps> = ({
  pending,
  targetPlayer,
  visible,
  onChoose,
}) => {
  if (!pending || !targetPlayer) return null;

  const remaining = pending.remainingTargetIds.length;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Force Discard</Text>
          <Text style={styles.subtitle}>
            {pending.sourceCardName ?? 'Manipulator'}
          </Text>
          <Text style={styles.body}>
            Choose a card for {targetPlayer.name} to discard
            {remaining > 0
              ? ` (${remaining + 1} opponent${remaining + 1 === 1 ? '' : 's'} total)`
              : ''}
            .
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.handRow}
          >
            {targetPlayer.hand.map((card) => (
              <Pressable
                key={card.instanceId}
                onPress={() => onChoose(card)}
                style={styles.handCardBtn}
              >
                <CardFace
                  definition={card.definition ?? getCardDefinition(card.definitionId)}
                  faceUp={card.faceUp}
                  width={CARD_W}
                  height={CARD_H}
                  chosenFaction={card.chosenFaction}
                />
              </Pressable>
            ))}
          </ScrollView>
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
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
  },
  title: {
    color: '#f1c40f',
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  subtitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 8,
  },
  body: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  handRow: {
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  handCardBtn: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});

export default ForcedOpponentDiscardModal;
