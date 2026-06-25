import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Image } from 'react-native';
import { PendingGainBandingBonusPick } from '../types/gameTypes';
import { BandingFaction } from '../types/gameTypes';
import { BANDING_BONUS_LABEL, BANDING_FACTIONS } from '../utils/bandingUtils';
import { BANDING_FACTION_ICONS } from '../utils/factionIconAssets';

interface GainBandingBonusPickModalProps {
  pending: PendingGainBandingBonusPick | null;
  visible: boolean;
  onChoose: (faction: BandingFaction) => void;
}

export const GainBandingBonusPickModal: React.FC<GainBandingBonusPickModalProps> = ({
  pending,
  visible,
  onChoose,
}) => {
  if (!pending) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Choose Faction Bonus</Text>
          <Text style={styles.subtitle}>{pending.sourceCardName ?? 'Preparation'}</Text>
          <Text style={styles.body}>Gain a Faction Bonus of your choice.</Text>
          <View style={styles.options}>
            {BANDING_FACTIONS.map((faction) => (
              <Pressable
                key={faction}
                style={styles.optionBtn}
                onPress={() => onChoose(faction)}
              >
                <Image
                  source={BANDING_FACTION_ICONS[faction]}
                  style={styles.icon}
                  resizeMode="contain"
                />
                <View style={styles.optionTextWrap}>
                  <Text style={styles.factionLabel}>{faction}</Text>
                  <Text style={styles.bonusText}>{BANDING_BONUS_LABEL[faction]}</Text>
                </View>
              </Pressable>
            ))}
          </View>
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
    fontSize: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  subtitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  options: {
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  icon: {
    width: 28,
    height: 28,
  },
  optionTextWrap: {
    flex: 1,
    gap: 2,
  },
  factionLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  bonusText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
});

export default GainBandingBonusPickModal;
