import React, { useEffect, useState } from 'react';
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
import {
  FAVOR_DISPLAY_MS,
  favorIsOptional,
  PendingFavorDestroyPick,
} from '../game/FavorResolver';
import { CardFace } from './CardFace';

interface FavorRevealModalProps {
  favor: CardInstance | null;
  beneficiaryId: string;
  beneficiaryName: string;
  visible: boolean;
  localPlayerId: string;
  localHand: CardInstance[];
  localDiscard: CardInstance[];
  localPlayArea: CardInstance[];
  pendingDestroyPick: PendingFavorDestroyPick | null;
  onResolve: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onDestroyCard: (card: CardInstance, sourceZone: 'hand' | 'discard' | 'play_area') => void;
}

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * 1.4);

export const FavorRevealModal: React.FC<FavorRevealModalProps> = ({
  favor,
  beneficiaryId,
  beneficiaryName,
  visible,
  localPlayerId,
  localHand,
  localDiscard,
  localPlayArea,
  pendingDestroyPick,
  onResolve,
  onAccept,
  onDecline,
  onDestroyCard,
}) => {
  const [continueReady, setContinueReady] = useState(false);

  useEffect(() => {
    if (!visible || !favor) {
      setContinueReady(false);
      return;
    }

    if (favorIsOptional(favor) || pendingDestroyPick) {
      setContinueReady(false);
      return;
    }

    setContinueReady(false);
    const timer = setTimeout(() => setContinueReady(true), FAVOR_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [visible, favor?.instanceId, pendingDestroyPick]);

  if (!favor) return null;

  const definition = favor.definition ?? getCardDefinition(favor.definitionId);
  const isBeneficiary = localPlayerId === beneficiaryId;
  const optional = favorIsOptional(favor);
  const mustDestroy =
    pendingDestroyPick != null &&
    pendingDestroyPick.playerId === localPlayerId &&
    pendingDestroyPick.remaining > 0;

  const destroyCards: { card: CardInstance; zone: 'hand' | 'discard' | 'play_area' }[] =
    [];
  if (mustDestroy && pendingDestroyPick) {
    if (pendingDestroyPick.fromZones.includes('hand')) {
      destroyCards.push(...localHand.map((card) => ({ card, zone: 'hand' as const })));
    }
    if (pendingDestroyPick.fromZones.includes('discard')) {
      destroyCards.push(
        ...localDiscard.map((card) => ({ card, zone: 'discard' as const }))
      );
    }
    if (pendingDestroyPick.fromZones.includes('play_area')) {
      destroyCards.push(
        ...localPlayArea.map((card) => ({ card, zone: 'play_area' as const }))
      );
    }
  }

  const showOptionalChoice = optional && isBeneficiary && !pendingDestroyPick;
  const canContinue = !optional && !mustDestroy && continueReady;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={canContinue ? onResolve : undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Imperial Favor</Text>
          <Text style={styles.subtitle}>{definition.name}</Text>
          <Text style={styles.beneficiary}>
            Drawn by {beneficiaryName}
          </Text>
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

          {mustDestroy ? (
            <>
              <Text style={styles.prompt}>
                Choose a card to destroy
                {pendingDestroyPick?.sourceCardName
                  ? ` (${pendingDestroyPick.sourceCardName})`
                  : ''}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.handRow}
              >
                {destroyCards.map(({ card, zone }) => (
                  <Pressable
                    key={card.instanceId}
                    onPress={() => onDestroyCard(card, zone)}
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
                    {zone !== 'hand' ? (
                      <Text style={styles.zoneTag}>
                        {zone === 'discard' ? 'Discard' : 'In play'}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : showOptionalChoice ? (
            <>
              <Text style={styles.prompt}>Use this Favor?</Text>
              <View style={styles.choiceRow}>
                <Pressable style={styles.acceptBtn} onPress={onAccept}>
                  <Text style={styles.acceptText}>Accept</Text>
                </Pressable>
                <Pressable style={styles.declineBtn} onPress={onDecline}>
                  <Text style={styles.declineText}>Decline</Text>
                </Pressable>
              </View>
            </>
          ) : optional && !isBeneficiary ? (
            <Text style={styles.hint}>
              Waiting for {beneficiaryName} to decide…
            </Text>
          ) : mustDestroy && !isBeneficiary ? (
            <Text style={styles.hint}>
              Waiting for {beneficiaryName} to choose a card…
            </Text>
          ) : !continueReady ? (
            <Text style={styles.hint}>Review the Favor…</Text>
          ) : (
            <Text style={styles.hint}>Resolving effect…</Text>
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
    color: '#f1c40f',
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 4,
  },
  beneficiary: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
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
    alignItems: 'center',
  },
  zoneTag: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 8,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  acceptBtn: {
    backgroundColor: '#27AE60',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  acceptText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  declineBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  declineText: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    fontSize: 14,
  },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 16,
  },
  continueBtn: {
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

export default FavorRevealModal;
