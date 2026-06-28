import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import type { ArenaWagerResult } from '../utils/arenaWagerUtils';
import { FAVOR_DISPLAY_MS } from '../game/FavorResolver';
import { CardFace } from './CardFace';
import { getCardDefinition } from '../game/CardDefinitions';

interface ArenaWagerResultModalProps {
  result: ArenaWagerResult | null;
  visible: boolean;
  onDismiss: () => void;
}

const CARD_W = 88;
const CARD_H = Math.round(CARD_W * 1.4);

export const ArenaWagerResultModal: React.FC<ArenaWagerResultModalProps> = ({
  result,
  visible,
  onDismiss,
}) => {
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (!visible || !result) {
      setCanDismiss(false);
      return;
    }
    setCanDismiss(false);
    const timer = setTimeout(() => setCanDismiss(true), FAVOR_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [visible, result?.beneficiaryId, result?.entries.length]);

  if (!result) return null;

  const winnerSet = new Set(result.winnerIds);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Arena Wager</Text>
          <Text style={styles.subtitle}>
            Highest valor + cost + VP wins
          </Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.entries}
            showsVerticalScrollIndicator={false}
          >
            {result.entries.map((entry) => {
              const isWinner = winnerSet.has(entry.playerId);
              const def =
                entry.card.definition ??
                getCardDefinition(entry.card.definitionId);
              return (
                <View
                  key={`${entry.playerId}-${entry.card.instanceId}`}
                  style={[styles.entry, isWinner && styles.entryWinner]}
                >
                  <View style={styles.entryHeader}>
                    <Text style={styles.playerName}>{entry.playerName}</Text>
                    {entry.randomPick ? (
                      <Text style={styles.randomTag}>Random</Text>
                    ) : (
                      <Text style={styles.randomTag}>Your pick</Text>
                    )}
                  </View>
                  <CardFace
                    definition={def}
                    faceUp
                    width={CARD_W}
                    height={CARD_H}
                    chosenFaction={entry.card.chosenFaction}
                  />
                  <Text style={styles.score}>
                    {entry.score} total ({def.valor ?? 0}V + {def.cost ?? 0}c +{' '}
                    {def.victoryPoints ?? 0}VP)
                  </Text>
                  {isWinner ? (
                    <Text style={styles.outcomeWin}>
                      Winner — +{result.gratiaPerWinner} Gratia
                    </Text>
                  ) : (
                    <Text style={styles.outcomeLoss}>+1 Disfavor</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {!canDismiss ? (
            <Text style={styles.hint}>Revealing wagers…</Text>
          ) : (
            <Pressable style={styles.continueBtn} onPress={onDismiss}>
              <Text style={styles.continueText}>Continue</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(230,126,34,0.5)',
    alignItems: 'center',
  },
  title: {
    color: '#E67E22',
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  scroll: {
    width: '100%',
    maxHeight: 420,
  },
  entries: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  entry: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.04)',
    width: CARD_W + 24,
  },
  entryWinner: {
    borderColor: '#f1c40f',
    backgroundColor: 'rgba(241,196,15,0.08)',
  },
  entryHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  playerName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  randomTag: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  score: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  outcomeWin: {
    color: '#2ecc71',
    fontWeight: '700',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  outcomeLoss: {
    color: '#e74c3c',
    fontWeight: '700',
    fontSize: 11,
    marginTop: 4,
  },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 8,
  },
  continueBtn: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#E67E22',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(230,126,34,0.15)',
  },
  continueText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});

export default ArenaWagerResultModal;
