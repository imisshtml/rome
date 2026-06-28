import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { PendingDeckLookPick, PlayerState } from '../types/gameTypes';
import { CardInstance } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { CardFace } from './CardFace';

interface DeckLookModalProps {
  pending: PendingDeckLookPick | null;
  players: PlayerState[];
  visible: boolean;
  onChoosePlayer: (playerId: string) => void;
  onKeepTop: (card: CardInstance) => void;
}

const CARD_W = 88;
const CARD_H = Math.round(CARD_W * 1.4);

export const DeckLookModal: React.FC<DeckLookModalProps> = ({
  pending,
  players,
  visible,
  onChoosePlayer,
  onKeepTop,
}) => {
  if (!pending) return null;

  const targetPlayer =
    pending.phase === 'keep_top' && pending.targetPlayerId
      ? players.find((p) => p.id === pending.targetPlayerId)
      : null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Deck Look</Text>
          <Text style={styles.subtitle}>{pending.sourceCardName ?? 'Card'}</Text>

          {pending.phase === 'choose_deck' ? (
            <>
              <Text style={styles.body}>
                Choose a player whose deck to look at (top {pending.lookCount} cards).
              </Text>
              <View style={styles.playerList}>
                {players.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.playerBtn}
                    onPress={() => onChoosePlayer(p.id)}
                  >
                    <Text style={styles.playerBtnText}>{p.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.body}>
                {targetPlayer?.name ?? 'Player'}&apos;s deck — tap the card to
                keep on top; the other goes to the bottom.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
              >
                {(pending.viewedCards ?? []).map((card) => (
                  <Pressable
                    key={card.instanceId}
                    onPress={() => onKeepTop(card)}
                    style={styles.cardBtn}
                  >
                    <CardFace
                      definition={
                        card.definition ?? getCardDefinition(card.definitionId)
                      }
                      faceUp
                      width={CARD_W}
                      height={CARD_H}
                    />
                  </Pressable>
                ))}
              </ScrollView>
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
    maxWidth: 400,
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
    fontSize: 16,
    marginBottom: 8,
  },
  body: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  playerList: {
    width: '100%',
    gap: 8,
  },
  playerBtn: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  playerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  row: {
    gap: 8,
    paddingVertical: 4,
  },
  cardBtn: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});

export default DeckLookModal;
