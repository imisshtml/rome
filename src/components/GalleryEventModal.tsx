import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CardInstance } from '../types/cardTypes';
import { GalleryEventPlayerOutcome } from '../types/gameTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import {
  eventHandChoiceDestroys,
  GALLERY_EVENT_DISPLAY_MS,
} from '../game/EventResolver';
import { CardFace } from './CardFace';
import CardPreviewModal from './CardPreviewModal';

interface GalleryEventModalProps {
  event: CardInstance | null;
  visible: boolean;
  pendingDiscardPlayerIds: string[];
  pendingOptionalPlayerIds?: string[];
  localPlayerId: string;
  localHand: CardInstance[];
  onResolve: () => void;
  onDiscardCard: (card: CardInstance) => void;
  onSkipOptional?: () => void;
  eventOutcomes?: GalleryEventPlayerOutcome[];
}

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * 1.4);

function EventTimerRing({
  active,
  durationMs,
}: {
  active: boolean;
  durationMs: number;
}) {
  const progress = useSharedValue(1);

  useEffect(() => {
    if (!active) {
      progress.value = 1;
      return;
    }
    progress.value = 1;
    progress.value = withTiming(0, {
      duration: durationMs,
      easing: Easing.linear,
    });
  }, [active, durationMs, progress]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  const arcStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.65,
  }));

  return (
    <View style={styles.timerWrap}>
      <View style={styles.timerTrack} />
      <Animated.View style={[styles.timerArc, arcStyle]} />
      <Animated.View style={[styles.timerSweep, sweepStyle]}>
        <View style={styles.timerSweepCap} />
      </Animated.View>
    </View>
  );
}

export const GalleryEventModal: React.FC<GalleryEventModalProps> = ({
  event,
  visible,
  pendingDiscardPlayerIds,
  pendingOptionalPlayerIds = [],
  localPlayerId,
  localHand,
  onResolve,
  onDiscardCard,
  onSkipOptional,
  eventOutcomes = [],
}) => {
  const [continueReady, setContinueReady] = useState(false);
  const [eventZoomOpen, setEventZoomOpen] = useState(false);

  useEffect(() => {
    if (!visible || !event) {
      setContinueReady(false);
      setEventZoomOpen(false);
      return;
    }

    const mustRespond =
      pendingDiscardPlayerIds.includes(localPlayerId) ||
      pendingOptionalPlayerIds.includes(localPlayerId);

    if (mustRespond) {
      setContinueReady(false);
      return;
    }

    setContinueReady(false);
    const timer = setTimeout(
      () => setContinueReady(true),
      GALLERY_EVENT_DISPLAY_MS
    );
    return () => clearTimeout(timer);
  }, [
    visible,
    event?.instanceId,
    localPlayerId,
    pendingDiscardPlayerIds,
    pendingOptionalPlayerIds,
  ]);

  if (!event) return null;

  const definition = event.definition ?? getCardDefinition(event.definitionId);
  const mustRequiredDiscard = pendingDiscardPlayerIds.includes(localPlayerId);
  const mustOptionalDiscard = pendingOptionalPlayerIds.includes(localPlayerId);
  const waitingOnDiscards =
    pendingDiscardPlayerIds.length > 0 || pendingOptionalPlayerIds.length > 0;
  const canContinue = !waitingOnDiscards && continueReady;
  const destroys = eventHandChoiceDestroys(event);
  const optionalCoinReward =
    typeof event.definition?.effectLegacy?.optional_discard_for_coins ===
    'number'
      ? event.definition.effectLegacy.optional_discard_for_coins
      : 2;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={canContinue ? onResolve : undefined}
      >
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <Text style={styles.title}>Gallery Event</Text>
            <Text style={styles.subtitle}>{definition.name}</Text>
            <Pressable
              style={styles.cardWrap}
              onPress={() => setEventZoomOpen(true)}
              accessibilityLabel="Zoom event card"
            >
              <CardFace
                definition={definition}
                faceUp
                width={CARD_W}
                height={CARD_H}
              />
              <Text style={styles.zoomHint}>Tap to zoom</Text>
            </Pressable>
            {definition.text ? (
              <Text style={styles.effectText}>{definition.text}</Text>
            ) : null}

            {mustRequiredDiscard ? (
              <>
                <Text style={styles.prompt}>
                  {destroys
                    ? 'Choose a card to destroy from your hand'
                    : 'Choose a card to discard'}
                </Text>
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
            ) : mustOptionalDiscard ? (
              <>
                <Text style={styles.prompt}>
                  Optionally discard a card to gain {optionalCoinReward} Coin
                  {optionalCoinReward === 1 ? '' : 's'} on your next turn
                </Text>
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
                {onSkipOptional ? (
                  <Pressable style={styles.skipBtn} onPress={onSkipOptional}>
                    <Text style={styles.skipBtnText}>Skip</Text>
                  </Pressable>
                ) : null}
              </>
            ) : waitingOnDiscards ? (
              <Text style={styles.hint}>
                Waiting for{' '}
                {pendingDiscardPlayerIds.length + pendingOptionalPlayerIds.length}{' '}
                player
                {pendingDiscardPlayerIds.length +
                  pendingOptionalPlayerIds.length ===
                1
                  ? ''
                  : 's'}{' '}
                to respond…
              </Text>
            ) : eventOutcomes.length > 0 ? (
              <View style={styles.outcomeList}>
                {eventOutcomes.map((outcome) => (
                  <Text key={outcome.cardInstanceId} style={styles.outcomeLine}>
                    {outcome.playerName}: {outcome.cardName} ({outcome.cost}c) +{' '}
                    {outcome.gratiaCount} Gratia
                  </Text>
                ))}
              </View>
            ) : !continueReady ? (
              <View style={styles.reviewRow}>
                <EventTimerRing
                  active={visible && !waitingOnDiscards}
                  durationMs={GALLERY_EVENT_DISPLAY_MS}
                />
                <Text style={styles.hint}>Review the event…</Text>
              </View>
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

      <CardPreviewModal
        card={event}
        visible={eventZoomOpen}
        onClose={() => setEventZoomOpen(false)}
      />
    </>
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
    marginBottom: 8,
    alignItems: 'center',
  },
  zoomHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 6,
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
  skipBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  skipBtnText: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    fontSize: 13,
  },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 16,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  timerWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerTrack: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'rgba(41,128,185,0.25)',
  },
  timerArc: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#2980B9',
  },
  timerSweep: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
  },
  timerSweepCap: {
    width: 28,
    height: 14,
    backgroundColor: '#1a1a2e',
  },
  outcomeList: {
    width: '100%',
    gap: 6,
    marginBottom: 16,
  },
  outcomeLine: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
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
