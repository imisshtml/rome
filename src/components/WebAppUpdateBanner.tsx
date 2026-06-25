import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWebAppUpdateAvailable } from '../hooks/useWebAppUpdateAvailable';

export const WebAppUpdateBanner: React.FC = () => {
  const stale = useWebAppUpdateAvailable();
  const insets = useSafeAreaInsets();

  if (Platform.OS !== 'web' || !stale) return null;

  return (
    <View
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 10) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar} accessibilityRole="alert">
        <Text style={styles.message} numberOfLines={2}>
          A new version is live — refresh to get the latest rules and fixes.
        </Text>
        <Pressable
          onPress={() => {
            if (typeof window !== 'undefined') window.location.reload();
          }}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityLabel="Refresh to load the new version"
        >
          <Text style={styles.buttonLabel}>Refresh</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 100000,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    maxWidth: 720,
    width: '100%',
    backgroundColor: 'rgba(8, 8, 16, 0.97)',
    borderColor: '#F1C40F',
    borderWidth: 2,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  message: {
    flex: 1,
    flexBasis: 200,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#F1C40F',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonLabel: {
    color: '#1a1a28',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default WebAppUpdateBanner;
