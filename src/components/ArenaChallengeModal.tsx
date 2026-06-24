import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import {
  ArenaChallengeResult,
  ArenaResponseType,
  PlayerState,
} from '../types/gameTypes';
import { CardInstance } from '../types/cardTypes';
import { ARENA_MAX_COMMIT } from '../game/GameEngine';
import { ARENA_MIN_COMMIT } from '../utils/arenaUtils';
import { CARD_PORTRAIT_RATIO } from '../utils/cardDisplayUtils';
import Card from './Card';

export type ArenaModalStep = 'prompt' | 'select' | 'respond' | 'waiting' | 'result';

interface ArenaChallengeModalProps {
  visible: boolean;
  step: ArenaModalStep;
  onClose: () => void;
  onDecline: () => void;
  onEnterArena: () => void;
  onConfirmFighters: (cardInstanceIds: string[]) => void;
  onRespond: (responseType: ArenaResponseType, cardInstanceId?: string) => void;
  arenaCard: CardInstance | null;
  requiredValor: number;
  rewardVp: number;
  playArea: CardInstance[];
  hand: CardInstance[];
  committedCards: CardInstance[];
  pendingResponders: string[];
  players: PlayerState[];
  localPlayerId: string;
  challengerId: string;
  totalValor: number;
  lastResult: ArenaChallengeResult | null;
  mandatory?: boolean;
  maxCommit?: number;
}

export const ArenaChallengeModal: React.FC<ArenaChallengeModalProps> = ({
  visible,
  step,
  onClose,
  onDecline,
  onEnterArena,
  onConfirmFighters,
  onRespond,
  arenaCard,
  requiredValor,
  rewardVp,
  playArea,
  hand,
  committedCards,
  pendingResponders,
  players,
  localPlayerId,
  challengerId,
  totalValor,
  lastResult,
  mandatory = false,
  maxCommit = ARENA_MAX_COMMIT,
}) => {
  const { width: screenW } = useWindowDimensions();
  const cardW = Math.min(92, (screenW - 96) / 4);
  const cardH = cardW * CARD_PORTRAIT_RATIO;
  const arenaW = Math.min(160, screenW * 0.38);
  const arenaH = arenaW * 0.72;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [responseMode, setResponseMode] = useState<'support' | 'hinder' | null>(null);
  const [selectedResponseCardId, setSelectedResponseCardId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedIds([]);
      setResponseMode(null);
      setSelectedResponseCardId(null);
    }
  }, [visible, step]);

  const challengerName = useMemo(
    () => players.find((p) => p.id === challengerId)?.name ?? 'Challenger',
    [players, challengerId]
  );

  const toggleFighter = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxCommit) return prev;
      return [...prev, id];
    });
  };

  const handleConfirmResponse = () => {
    if (!responseMode || !selectedResponseCardId) return;
    onRespond(responseMode, selectedResponseCardId);
  };

  const renderPrompt = () => (
    <>
      <Text style={styles.heading}>Arena Challenge</Text>
      {arenaCard ? (
        <View style={styles.arenaRow}>
          <Card card={arenaCard} width={arenaW} height={arenaH} sizeMode="landscape" />
        </View>
      ) : null}
      <Text style={styles.body}>
        {mandatory
          ? `You must enter the Arena this turn. Choose ${ARENA_MIN_COMMIT} to ${maxCommit} fighters from your play area. Declining adds Crowd Disfavor.`
          : `Enter the Arena to fight this challenge with up to ${maxCommit} cards from your play area. Other players may Support or Hinder you.`}
      </Text>
      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={onEnterArena}>
          <Text style={styles.primaryBtnText}>Enter Arena</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onDecline}>
          <Text style={styles.secondaryBtnText}>
            {mandatory ? 'Decline (+1 Disfavor)' : 'Decline'}
          </Text>
        </Pressable>
      </View>
    </>
  );

  const renderSelect = () => (
    <>
      <Text style={styles.heading}>Select Fighters</Text>
      <Text style={styles.body}>
        Choose {ARENA_MIN_COMMIT} to {maxCommit} cards from your play area (
        {selectedIds.length}/{maxCommit} selected).
      </Text>
      {playArea.length === 0 ? (
        <Text style={styles.empty}>Play cards to your play area first.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.cardGrid} showsVerticalScrollIndicator={false}>
          {playArea.map((card) => {
            const selected = selectedIds.includes(card.instanceId);
            return (
              <Pressable key={card.instanceId} onPress={() => toggleFighter(card.instanceId)}>
                <View style={[styles.cardWrap, selected && styles.cardSelected]}>
                  <Card card={card} width={cardW} height={cardH} sizeMode="full" />
                  {selected ? <Text style={styles.selectedBadge}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <View style={styles.actions}>
        <Pressable
          style={[
            styles.primaryBtn,
            selectedIds.length < ARENA_MIN_COMMIT && styles.btnDisabled,
          ]}
          disabled={selectedIds.length < ARENA_MIN_COMMIT}
          onPress={() => onConfirmFighters(selectedIds)}
        >
          <Text style={styles.primaryBtnText}>Commit Fighters</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onClose}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </>
  );

  const renderRespond = () => (
    <>
      <Text style={styles.heading}>{challengerName} enters the Arena</Text>
      <Text style={styles.body}>
        Support adds a card&apos;s Valor from your hand. Hinder subtracts a card&apos;s Valor. The
        chosen card is discarded either way.
      </Text>
      {!responseMode ? (
        <View style={styles.actions}>
          <Pressable style={styles.supportBtn} onPress={() => setResponseMode('support')}>
            <Text style={styles.primaryBtnText}>Support</Text>
          </Pressable>
          <Pressable style={styles.hinderBtn} onPress={() => setResponseMode('hinder')}>
            <Text style={styles.primaryBtnText}>Hinder</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => onRespond('pass')}>
            <Text style={styles.secondaryBtnText}>Pass</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.subheading}>
            Select 1 card to {responseMode === 'support' ? 'support' : 'hinder'}
          </Text>
          {hand.length === 0 ? (
            <Text style={styles.empty}>No cards in hand.</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.cardGrid} showsVerticalScrollIndicator={false}>
              {hand.map((card) => {
                const selected = selectedResponseCardId === card.instanceId;
                return (
                  <Pressable
                    key={card.instanceId}
                    onPress={() => setSelectedResponseCardId(card.instanceId)}
                  >
                    <View style={[styles.cardWrap, selected && styles.cardSelected]}>
                      <Card card={card} width={cardW} height={cardH} sizeMode="full" />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryBtn, !selectedResponseCardId && styles.btnDisabled]}
              disabled={!selectedResponseCardId}
              onPress={handleConfirmResponse}
            >
              <Text style={styles.primaryBtnText}>Confirm</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => setResponseMode(null)}>
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
          </View>
        </>
      )}
    </>
  );

  const renderWaiting = () => (
    <>
      <Text style={styles.heading}>Arena Challenge</Text>
      <Text style={styles.body}>
        {challengerName} committed {committedCards.length} fighter
        {committedCards.length === 1 ? '' : 's'}. Waiting for other players to respond…
      </Text>
      <View style={styles.cardGrid}>
        {committedCards.map((card) => (
          <Card key={card.instanceId} card={card} width={cardW} height={cardH} sizeMode="full" />
        ))}
      </View>
      {pendingResponders.length > 0 ? (
        <Text style={styles.metaLine}>
          Waiting on:{' '}
          {pendingResponders
            .map((id) => players.find((p) => p.id === id)?.name ?? id)
            .join(', ')}
        </Text>
      ) : null}
      <Text style={styles.metaLine}>Current total: {totalValor} / {requiredValor} Valor</Text>
    </>
  );

  const renderResult = () => {
    if (!lastResult) return null;
    const won = lastResult.success;
    return (
      <>
        <Text style={styles.heading}>{won ? 'Victory!' : 'Defeat'}</Text>
        <Text style={styles.body}>
          {challengerName} scored {lastResult.totalValor} Valor against {lastResult.requiredValor}{' '}
          required.
        </Text>
        <Text style={[styles.resultLine, won ? styles.win : styles.loss]}>
          {won
            ? `+${lastResult.valorGain} Valor, +${lastResult.rewardVp} Victory Points`
            : 'Crowd Disfavor added to discard'}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={onClose}>
          <Text style={styles.primaryBtnText}>Continue</Text>
        </Pressable>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { maxWidth: Math.min(620, screenW - 32) }]}>
          <View style={styles.header}>
            {step !== 'respond' && step !== 'waiting' && false ? (
              <Pressable onPress={onClose}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          {step === 'prompt' && renderPrompt()}
          {step === 'select' && renderSelect()}
          {step === 'respond' && renderRespond()}
          {step === 'waiting' && renderWaiting()}
          {step === 'result' && renderResult()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 16,
    maxHeight: '85%',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#f1c40f',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  closeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  heading: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  subheading: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  arenaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 12,
  },
  arenaMeta: {
    gap: 4,
  },
  metaLine: {
    color: 'rgba(241,196,15,0.9)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    gap: 8,
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: '#C0392B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  supportBtn: {
    backgroundColor: '#27ae60',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  hinderBtn: {
    backgroundColor: '#8e44ad',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryBtnText: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cardWrap: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#f1c40f',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 6,
    color: '#f1c40f',
    fontWeight: '900',
    fontSize: 16,
  },
  empty: {
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
  },
  resultLine: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginVertical: 12,
  },
  win: {
    color: '#2ecc71',
  },
  loss: {
    color: '#e74c3c',
  },
});

export default ArenaChallengeModal;
