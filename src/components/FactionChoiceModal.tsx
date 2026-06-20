import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Image } from 'react-native';
import { CardInstance, Faction } from '../types/cardTypes';
import { SPY_FACTION_CHOICES, type BandingFactionChoice } from '../utils/cardFactionUtils';
import { BANDING_FACTION_ICONS } from '../utils/factionIconAssets';

interface FactionChoiceModalProps {
  card: CardInstance | null;
  visible: boolean;
  onChoose: (faction: Faction) => void;
  onCancel: () => void;
}

export const FactionChoiceModal: React.FC<FactionChoiceModalProps> = ({
  card,
  visible,
  onChoose,
  onCancel,
}) => {
  if (!card) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Choose Faction</Text>
          <Text style={styles.body}>
            {card.definition.name} counts as your chosen faction until it leaves play.
          </Text>
          <View style={styles.options}>
            {SPY_FACTION_CHOICES.map((faction) => (
              <Pressable
                key={faction}
                style={({ pressed }) => [
                  styles.factionBtn,
                  pressed && styles.factionBtnPressed,
                ]}
                onPress={() => onChoose(faction)}
              >
                <Image
                  source={BANDING_FACTION_ICONS[faction as BandingFactionChoice]}
                  style={styles.factionIcon}
                  resizeMode="contain"
                />
                <Text style={styles.factionLabel}>{faction}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
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
  options: {
    gap: 10,
  },
  factionBtn: {
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
  factionBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  factionIcon: {
    width: 28,
    height: 28,
  },
  factionLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default FactionChoiceModal;
