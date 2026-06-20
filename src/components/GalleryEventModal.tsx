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

interface GalleryEventModalProps {
  event: CardInstance | null;
  visible: boolean;
  pendingDiscardPlayerIds: string[];
  localPlayerId: string;
  localHand: CardInstance[];
  onResolve: () => void;
  onDiscardCard: (card: CardInstance) => void;
}

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * 1.4);

export const GalleryEventModal: React.FC<GalleryEventModalProps> = ({
  event,
  visible,
  pendingDiscardPlayerIds,
  localPlayerId,
  localHand,
  onResolve,
  onDiscardCard,
}) => {
  if (!event) return null;

  const definition = event.definition ?? getCardDefinition(event.definitionId);
  const mustDiscard = pendingDiscardPlayerIds.includes(localPlayerId);
  const waitingOnDiscards = pendingDiscardPlayerIds.length > 0;
  const canContinue = !waitingOnDiscards;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={canContinue ? onResolve : undefined}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Gallery Event</Text>
          <Text style={styles.subtitle}>{definition.name}</Text>
          <View style={styles.cardWrap}>
            <CardFace
              definition={definition}
              faceUp
              width={CARD_W}
              height={CARD_H}
            />
          </View>
          {definition.text ? (
            <Text style={styles.effectText}>{definition.text}</Text>
          ) : null}

          {mustDiscard ? (
            <>
              <Text style={styles.prompt}>Choose a card to discard</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.handRow}
              >
                {localHand.map((card) => (
                  <Pressable
                    key={card.instanceId}
                    onPress={() => onDiscardCard(card)}
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
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : waitingOnDiscards ? (
            <Text style={styles.hint}>
              Waiting for {pendingDiscardPlayerIds.length} player
              {pendingDiscardPlayerIds.length === 1 ? '' : 's'} to discard…
            </Text>
          ) : (
            <Text style={styles.hint}>Effect resolved for all players.</Text>
          )}

          {canContinue ? (
            <Pressable style={styles.continueBtn} onPress={onResolve}>
              <Text style={styles.continueText}>Continue</Text>
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
    borderColor: 'rgba(41,128,185,0.45)',
    alignItems: 'center',
  },
  title: {
    color: '#2980B9',
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  subtitle: {
    color: '#f1c40f',
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  cardWrap: {
    marginBottom: 14,
  },
  effectText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 10,
  },
  prompt: {
    color: '#e74c3c',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
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
  },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 16,
  },
  continueBtn: {
    borderWidth: 2,
    borderColor: '#2980B9',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(41,128,185,0.15)',
  },
  continueText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});

export default GalleryEventModal;
