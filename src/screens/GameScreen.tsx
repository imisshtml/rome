import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { Provider as JotaiProvider } from 'jotai';
import { MultiplayerProvider } from '../network/MultiplayerProvider';
import { TutorialProvider } from '../context/TutorialContext';
import AppShell from './AppShell';
import { WebAppUpdateBanner } from '../components/WebAppUpdateBanner';

export const GameScreen: React.FC = () => {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
      <JotaiProvider>
        <GestureHandlerRootView style={styles.root}>
          <MultiplayerProvider>
            <TutorialProvider>
              <View style={styles.container}>
                <WebAppUpdateBanner />
                <AppShell />
              </View>
            </TutorialProvider>
          </MultiplayerProvider>
        </GestureHandlerRootView>
      </JotaiProvider>
    </SafeAreaProvider>
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
