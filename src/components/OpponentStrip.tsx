import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PlayerState } from '../types/gameTypes';

interface OpponentStripProps {
  opponents: PlayerState[];
  turnPlayerId: string;
  onPressOpponent: (player: PlayerState) => void;
}

export const OpponentStrip: React.FC<OpponentStripProps> = ({
  opponents,
  turnPlayerId,
  onPressOpponent,
}) => {
  return (
    <View style={styles.row}>
      {opponents.map((opp) => {
        const isTurn = opp.id === turnPlayerId;
        return (
          <Pressable
            key={opp.id}
            onPress={() => onPressOpponent(opp)}
            style={[styles.chip, isTurn && styles.chipActive]}
          >
            <Text style={styles.name} numberOfLines={1}>
              {opp.name}
              {isTurn ? ' ⚔' : ''}
            </Text>
            <Text style={styles.stats}>
              {opp.victoryPoints}VP · H{opp.hand.length} · D{opp.deck.length}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.25)',
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 100,
  },
  chipActive: {
    borderColor: 'rgba(241,196,15,0.6)',
    backgroundColor: 'rgba(241,196,15,0.08)',
  },
  name: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
  },
  stats: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    marginTop: 1,
  },
});

export default OpponentStrip;
