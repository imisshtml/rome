import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useMultiplayer } from '../network/MultiplayerProvider';
import LandingScreen from './LandingScreen';
import LobbyScreen from './LobbyScreen';
import PostGameScreen from './PostGameScreen';
import GameTable from '../components/GameTable';
import DebugPanel from '../components/DebugPanel';

export const AppShell: React.FC = () => {
  const { phase } = useMultiplayer();

  if (phase === 'landing') {
    return <LandingScreen />;
  }

  if (phase === 'lobby') {
    return <LobbyScreen />;
  }

  if (phase === 'postgame') {
    return <PostGameScreen />;
  }

  return (
    <View style={styles.game}>
      <GameTable />
      <DebugPanel />
    </View>
  );
};

const styles = StyleSheet.create({
  game: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 0 : 44,
  },
});

export default AppShell;
