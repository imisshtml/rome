import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { GamePhase, PHASE_LABELS } from '../types/gameTypes';

interface PhaseBarProps {
  currentPhase: GamePhase;
  turnNumber: number;
  currentPlayerName: string;
  onEndPhase: () => void;
  compact?: boolean;
}

const PHASES: GamePhase[] = ['DRAW', 'MAIN', 'ARENA', 'BUY', 'END'];

export const PhaseBar: React.FC<PhaseBarProps> = ({
  currentPhase,
  turnNumber,
  currentPlayerName,
  onEndPhase,
  compact = false,
}) => {
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.compactTurn}>T{turnNumber}</Text>
        <View style={styles.compactPhaseBadge}>
          <Text style={styles.compactPhaseText}>
            {PHASE_LABELS[currentPhase]}
          </Text>
        </View>
        <Text style={styles.compactPlayer} numberOfLines={1}>
          {currentPlayerName}
        </Text>
        <Pressable style={styles.nextBtnCompact} onPress={onEndPhase}>
          <Text style={styles.nextBtnText}>Next →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.infoRow}>
        <Text style={styles.turnText}>Turn {turnNumber}</Text>
        <Text style={styles.playerText}>{currentPlayerName}</Text>
      </View>
      <View style={styles.phasesRow}>
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
        <Pressable style={styles.nextBtn} onPress={onEndPhase}>
          <Text style={styles.nextBtnText}>Next →</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  compactTurn: {
    color: '#F1C40F',
    fontWeight: '800',
    fontSize: 11,
  },
  compactPhaseBadge: {
    backgroundColor: '#F1C40F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  compactPhaseText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 10,
  },
  compactPlayer: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    fontSize: 11,
    textAlign: 'right',
  },
  nextBtnCompact: {
    backgroundColor: 'rgba(46,204,113,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  turnText: {
    color: '#F1C40F',
    fontWeight: '700',
    fontSize: 12,
  },
  playerText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  phasesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phaseChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  phaseChipActive: {
    backgroundColor: '#F1C40F',
  },
  phaseText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
  },
  phaseTextActive: {
    color: '#000',
  },
  nextBtn: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(46,204,113,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nextBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
});

export default PhaseBar;
