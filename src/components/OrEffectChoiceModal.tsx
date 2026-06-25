import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';

interface OrEffectChoiceModalProps {
  visible: boolean;
  cardName: string;
  baseGainCoins: number;
  branchLabels: string[];
  onChoose: (branchIndex: number) => void;
}

export const OrEffectChoiceModal: React.FC<OrEffectChoiceModalProps> = ({
  visible,
  cardName,
  baseGainCoins,
  branchLabels,
  onChoose,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.title}>Choose One</Text>
        <Text style={styles.subtitle}>{cardName}</Text>
        {baseGainCoins > 0 ? (
          <Pressable style={styles.optionBtn} onPress={() => onChoose(0)}>
            <Text style={styles.optionText}>
              +{baseGainCoins} Coin{baseGainCoins === 1 ? '' : 's'}
            </Text>
          </Pressable>
        ) : null}
        {branchLabels.map((label, i) => (
          <Pressable
            key={i}
            style={styles.optionBtn}
            onPress={() => onChoose(baseGainCoins > 0 ? i + 1 : i)}
          >
            <Text style={styles.optionText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.4)',
    gap: 10,
  },
  title: {
    color: '#F1C40F',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
  },
  optionBtn: {
    backgroundColor: 'rgba(241,196,15,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.35)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default OrEffectChoiceModal;
