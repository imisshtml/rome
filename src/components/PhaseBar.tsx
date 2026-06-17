import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GamePhase, PHASE_LABELS } from '../types/gameTypes';

interface PhaseBarProps {
  currentPhase: GamePhase;
}

const PHASES: GamePhase[] = ['PREGAME', 'MAIN', 'CLEANUP'];

export const PhaseBar: React.FC<PhaseBarProps> = ({ currentPhase }) => {
  return (
    <View style={styles.container}>
      {PHASES.map((phase) => (
        <View
          key={phase}
          style={[
            styles.phaseChip,
            phase === currentPhase && styles.phaseChipActive,
          ]}
        >
          <Text
            style={[
              styles.phaseText,
              phase === currentPhase && styles.phaseTextActive,
            ]}
          >
            {PHASE_LABELS[phase]}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  phaseChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  phaseChipActive: {
    backgroundColor: 'rgba(241,196,15,0.2)',
  },
  phaseText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  phaseTextActive: {
    color: '#F1C40F',
  },
});

export default PhaseBar;
