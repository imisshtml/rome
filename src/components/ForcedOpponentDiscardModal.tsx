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
  opponentCandidates?: PlayerState[];
  visible: boolean;
  onChoose: (card: CardInstance) => void;
  onChooseOpponent?: (playerId: string) => void;
}

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * 1.4);

export const ForcedOpponentDiscardModal: React.FC<ForcedOpponentDiscardModalProps> = ({
  pending,
  targetPlayer,
  opponentCandidates = [],
  visible,
  onChoose,
  onChooseOpponent,
}) => {
  if (!pending) return null;

  const choosingOpponent = pending.phase === 'choose_opponent';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>
            {choosingOpponent
              ? 'Choose Opponent'
              : pending.destroyToPile
                ? 'Destroy from Hand'
                : 'Forced Discard'}
          </Text>
          {choosingOpponent ? (
            <>
              <Text style={styles.body}>
                {pending.destroyToPile
                  ? 'Choose an opponent whose hand you will inspect'
                  : 'Look at an opponent\u2019s hand and force them to discard 1 card'}
                {pending.sourceCardName ? ` (${pending.sourceCardName})` : ''}
              </Text>
              <View style={styles.opponentList}>
                {opponentCandidates.map((opponent) => (
                  <Pressable
                    key={opponent.id}
                    style={styles.opponentBtn}
                    onPress={() => onChooseOpponent?.(opponent.id)}
                  >
                    <Text style={styles.opponentBtnText}>
                      {opponent.name} ({opponent.hand.length} in hand)
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : targetPlayer ? (
            <>
              <Text style={styles.subtitle}>{targetPlayer.name}&apos;s hand</Text>
              <Text style={styles.body}>
                Choose {pending.remainingForTarget} card
                {pending.remainingForTarget === 1 ? '' : 's'} to{' '}
                {pending.destroyToPile ? 'destroy' : 'discard'}
                {pending.sourceCardName ? ` (${pending.sourceCardName})` : ''}
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
                      definition={
                        card.definition ?? getCardDefinition(card.definitionId)
                      }
                      faceUp
                      width={CARD_W}
                      height={CARD_H}
                      chosenFaction={card.chosenFaction}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </>
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
});

export default ForcedOpponentDiscardModal;
