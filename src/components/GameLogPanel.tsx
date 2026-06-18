import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { GameAction, PlayerState } from '../types/gameTypes';

function formatLogLine(action: GameAction, playerName: string): string {
  switch (action.type) {
    case 'PLAY_CARD':
      return `${playerName} played a card`;
    case 'DRAW_CARD':
      return `${playerName} drew ${action.payload?.count ?? 1} card(s)`;
    case 'ATTEMPT_ARENA':
      return `${playerName} attempted the arena`;
    case 'BUY_CARD':
      return `${playerName} bought a card`;
    case 'DISCARD_CARD':
      return `${playerName} discarded a card`;
    case 'END_PHASE':
      return `${playerName} ended their turn`;
    case 'MOVE_CARD':
      return `${playerName} moved a card`;
    case 'START_GAME':
      return 'Game started';
    case 'PLAYER_READY':
      return `${playerName} is ready to start`;
    case 'END_GAME':
      return `${playerName} ended the game`;
    default:
      return `${playerName}: ${action.type}`;
  }
}

interface GameLogPanelProps {
  actions: GameAction[];
  players: PlayerState[];
}

export const GameLogPanel: React.FC<GameLogPanelProps> = ({ actions, players }) => {
  const scrollRef = useRef<ScrollView>(null);
  const nameById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p.name])),
    [players]
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [actions.length]);

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Game Log</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        {actions.length === 0 ? (
          <Text style={styles.empty}>No actions yet.</Text>
        ) : (
          actions.map((action, index) => (
            <Text
              key={`${action.timestamp}-${index}`}
              style={styles.line}
              numberOfLines={2}
            >
              {formatLogLine(action, nameById[action.playerId] ?? action.playerId)}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.3)',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  title: {
    color: 'rgba(241,196,15,0.85)',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 6,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingBottom: 4,
    gap: 4,
  },
  line: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    lineHeight: 13,
  },
  empty: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default GameLogPanel;
