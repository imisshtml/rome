import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { PendingArenaLoss } from '../types/gameTypes';
import { CardInstance } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { CardFace } from './CardFace';
import { getFighterStrength } from '../utils/arenaLossUtils';

interface ArenaLossModalProps {
  pending: PendingArenaLoss | null;
  arenaName?: string;
  visible: boolean;
  onChooseDisfavor: () => void;
  onChooseDestroyStrongest: () => void;
  onDestroyFighter: (card: CardInstance) => void;
}

const CARD_W = 108;
const CARD_H = Math.round(CARD_W * 1.4);

function FighterCardButton({
  card,
  onPress,
  highlight,
}: {
  card: CardInstance;
  onPress: () => void;
  highlight?: boolean;
}) {
  const def = card.definition ?? getCardDefinition(card.definitionId);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.cardBtn, highlight && styles.cardBtnHighlight]}
    >
      <CardFace
        definition={def}
        faceUp
        width={CARD_W}
        height={CARD_H}
        chosenFaction={card.chosenFaction}
      />
      <Text style={styles.cardMeta}>
        Valor {def.valor ?? 0} · Cost {def.cost ?? 0}
      </Text>
    </Pressable>
  );
}

export const ArenaLossModal: React.FC<ArenaLossModalProps> = ({
  pending,
  arenaName,
  visible,
  onChooseDisfavor,
  onChooseDestroyStrongest,
  onDestroyFighter,
}) => {
  const primusPreview = useMemo(() => {
    if (!pending?.primusCandidates?.length) return null;
    if (pending.primusCandidates.length === 1) return pending.primusCandidates[0];
    return null;
  }, [pending]);

  if (!pending || !visible) return null;

  const disfavorCount = pending.loss.disfavorCount ?? 1;
  const pickPool =
    pending.phase === 'primus_fighter_pick'
      ? pending.primusCandidates ?? []
      : pending.committedFighters;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.kicker}>Arena Defeat</Text>
          <Text style={styles.title}>{arenaName ?? 'Arena Challenge'}</Text>

          {pending.phase === 'primus_choice' && (
            <>
              <Text style={styles.body}>
                Choose your penalty: take {disfavorCount} Disfavor, or destroy your
                strongest fighter (Valor + Cost).
              </Text>

              {primusPreview && (
                <View style={styles.previewBlock}>
                  <Text style={styles.previewLabel}>Strongest fighter</Text>
                  <FighterCardButton
                    card={primusPreview}
                    onPress={onChooseDestroyStrongest}
                    highlight
                  />
                </View>
              )}

              <View style={styles.choiceRow}>
                <Pressable style={styles.choiceBtn} onPress={onChooseDisfavor}>
                  <Text style={styles.choiceBtnTitle}>Take {disfavorCount} Disfavor</Text>
                  <Text style={styles.choiceBtnSub}>Added to your discard pile</Text>
                </Pressable>

                <Pressable
                  style={[styles.choiceBtn, styles.choiceBtnDanger]}
                  onPress={onChooseDestroyStrongest}
                >
                  <Text style={styles.choiceBtnTitle}>Destroy fighter</Text>
                  <Text style={styles.choiceBtnSub}>
                    {primusPreview
                      ? primusPreview.definition.name
                      : 'Choose your strongest'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {(pending.phase === 'destroy_fighter_pick' ||
            pending.phase === 'primus_fighter_pick') && (
            <>
              <Text style={styles.body}>
                {pending.phase === 'primus_fighter_pick'
                  ? 'Tied for strongest — choose which fighter is destroyed.'
                  : 'Choose a fighter you committed to this battle to destroy.'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardRow}
              >
                {pickPool.map((card) => (
                  <FighterCardButton
                    key={card.instanceId}
                    card={card}
                    onPress={() => onDestroyFighter(card)}
                    highlight={
                      pending.phase === 'primus_fighter_pick' &&
                      getFighterStrength(card) ===
                        Math.max(...pickPool.map(getFighterStrength))
                    }
                  />
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  kicker: {
    color: '#e74c3c',
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  previewBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  previewLabel: {
    color: '#f1c40f',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  choiceRow: {
    gap: 10,
  },
  choiceBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  choiceBtnDanger: {
    borderColor: 'rgba(231,76,60,0.55)',
    backgroundColor: 'rgba(231,76,60,0.12)',
  },
  choiceBtnTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 4,
  },
  choiceBtnSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },
  cardRow: {
    gap: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    flexGrow: 1,
  },
  cardBtn: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 4,
  },
  cardBtnHighlight: {
    borderColor: '#e74c3c',
  },
  cardMeta: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    marginTop: 4,
  },
});

export default ArenaLossModal;
