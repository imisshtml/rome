import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { CardInstance, FACTION_COLORS, Faction } from '../types/cardTypes';
import { SPY_FACTION_CHOICES } from '../utils/cardFactionUtils';

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
                style={[styles.factionBtn, { borderColor: FACTION_COLORS[faction] }]}
                onPress={() => onChoose(faction)}
              >
                <View style={[styles.factionSwatch, { backgroundColor: FACTION_COLORS[faction] }]} />
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
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  factionSwatch: {
    width: 18,
    height: 18,
    borderRadius: 4,
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
