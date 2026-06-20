import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Image } from 'react-native';
import { PendingBandingBonus } from '../types/gameTypes';
import { BANDING_FACTION_ICONS } from '../utils/factionIconAssets';

interface BandingBonusModalProps {
  pending: PendingBandingBonus | null;
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const BandingBonusModal: React.FC<BandingBonusModalProps> = ({
  pending,
  visible,
  onAccept,
  onDecline,
}) => {
  if (!pending) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Banding Bonus</Text>
          <Text style={styles.body}>
            You played 3 {pending.faction} cards this turn.
          </Text>
          <View style={styles.bonusBox}>
            <Image
              source={BANDING_FACTION_ICONS[pending.faction]}
              style={styles.factionIcon}
              resizeMode="contain"
            />
            <View style={styles.bonusTextWrap}>
              <Text style={styles.factionLabel}>{pending.faction}</Text>
              <Text style={styles.bonusText}>{pending.bonusText}</Text>
            </View>
          </View>
          <Pressable style={styles.acceptBtn} onPress={onAccept}>
            <Text style={styles.acceptText}>Accept Bonus</Text>
          </Pressable>
          <Pressable style={styles.declineBtn} onPress={onDecline}>
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  title: {
    color: '#f1c40f',
    fontWeight: '800',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  bonusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 14,
  },
  factionIcon: {
    width: 32,
    height: 32,
  },
  bonusTextWrap: {
    flex: 1,
    gap: 2,
  },
  factionLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  bonusText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
  },
  acceptBtn: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.55)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  acceptText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  declineBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  declineText: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default BandingBonusModal;
