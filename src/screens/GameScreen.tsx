import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as JotaiProvider } from 'jotai';
import { MultiplayerProvider } from '../network/MultiplayerProvider';
import AppShell from './AppShell';

export const GameScreen: React.FC = () => {
  return (
    <JotaiProvider>
      <GestureHandlerRootView style={styles.root}>
        <MultiplayerProvider>
          <View style={styles.container}>
            <AppShell />
          </View>
        </MultiplayerProvider>
      </GestureHandlerRootView>
    </JotaiProvider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  container: {
    flex: 1,
  },
});

export default GameScreen;
