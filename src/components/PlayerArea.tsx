import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { PlayerState } from '../types/gameTypes';
import { getPlayerTotalVp } from '../game/postGame';

interface PlayerAreaProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  isLocalPlayer?: boolean;
  style?: ViewStyle;
  onPress?: () => void;
}

export const PlayerArea: React.FC<PlayerAreaProps> = ({
  player,
  isCurrentTurn,
  isLocalPlayer = false,
  style,
  onPress,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        isCurrentTurn && styles.activeTurn,
        isLocalPlayer && styles.localPlayer,
        pressed && onPress && styles.pressed,
        style,
      ]}
    >
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {player.name}
        </Text>
        {isCurrentTurn && <Text style={styles.turnIndicator}>⚔</Text>}
      </View>

      <View style={styles.statsRow}>
        <StatBadge value={getPlayerTotalVp(player)} label="VP" color="#FFD700" />
        <StatBadge value={player.hand.length} label="Hand" />
        <StatBadge value={player.deck.length} label="Deck" />
        <StatBadge value={player.discard.length} label="Disc" />
      </View>
    </Pressable>
  );
};

const StatBadge: React.FC<{
  value: number;
  label: string;
  color?: string;
}> = ({ value, label, color }) => (
  <View style={styles.statItem}>
    <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 110,
  },
  activeTurn: {
    borderColor: 'rgba(241,196,15,0.6)',
    backgroundColor: 'rgba(241,196,15,0.08)',
  },
  localPlayer: {
    borderColor: 'rgba(52,152,219,0.5)',
    backgroundColor: 'rgba(52,152,219,0.06)',
  },
  pressed: {
    opacity: 0.8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 6,
  },
  name: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  turnIndicator: {
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 2,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 28,
  },
  statValue: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 7,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default PlayerArea;
