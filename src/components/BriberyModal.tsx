import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { PendingBriberyPick, PlayerState } from '../types/gameTypes';
import { CardInstance } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { CardFace } from './CardFace';

interface BriberyModalProps {
  pending: PendingBriberyPick | null;
  visible: boolean;
  opponentCandidates: PlayerState[];
  revealedCard: CardInstance | null;
  onChooseOpponent: (playerId: string) => void;
  onPlay: () => void;
  onSkip: () => void;
}

const CARD_W = 128;
const CARD_H = Math.round(CARD_W * 1.4);

export const BriberyModal: React.FC<BriberyModalProps> = ({
  pending,
  visible,
  opponentCandidates,
  revealedCard,
  onChooseOpponent,
  onPlay,
  onSkip,
}) => {
  if (!pending) return null;

  const choosingOpponent = pending.phase === 'choose_opponent';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Bribery</Text>

          {choosingOpponent ? (
            <>
              <Text style={styles.body}>
                Choose an opponent. A random card from their hand will be revealed
                and you may play it (destroyed at end of turn).
              </Text>
              <View style={styles.opponentList}>
                {opponentCandidates.map((opponent) => (
                  <Pressable
                    key={opponent.id}
                    style={styles.opponentBtn}
                    onPress={() => onChooseOpponent(opponent.id)}
                  >
                    <Text style={styles.opponentBtnText}>
                      {opponent.name} ({opponent.hand.length} in hand)
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.body}>
                Revealed from opponent&apos;s hand. Play it this turn (destroyed at
                end of turn) or decline.
              </Text>
              {revealedCard ? (
                <View style={styles.cardWrap}>
                  <CardFace
                    definition={
                      revealedCard.definition ??
                      getCardDefinition(revealedCard.definitionId)
                    }
                    faceUp
                    width={CARD_W}
                    height={CARD_H}
                    chosenFaction={revealedCard.chosenFaction}
                  />
                </View>
              ) : null}
              <View style={styles.actionRow}>
                <Pressable style={[styles.actionBtn, styles.playBtn]} onPress={onPlay}>
                  <Text style={styles.actionBtnText}>Play it</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.skipBtn]} onPress={onSkip}>
                  <Text style={styles.actionBtnText}>Decline</Text>
                </Pressable>
              </View>
            </>
          )}
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
  body: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  opponentList: {
    width: '100%',
    gap: 8,
  },
  opponentBtn: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  opponentBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  cardWrap: {
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  playBtn: {
    backgroundColor: 'rgba(46,204,113,0.18)',
    borderColor: 'rgba(46,204,113,0.6)',
  },
  skipBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});

export default BriberyModal;
