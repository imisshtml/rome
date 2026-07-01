import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { clearSavedGameSession } from '../utils/playerStorage';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render crashes so the app shows a recoverable screen instead of a
 * blank white page. "Back to Menu" clears the saved session so auto-resume
 * won't immediately reload the same broken game and re-crash.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info?.componentStack);
  }

  private handleReset = () => {
    clearSavedGameSession();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Something broke</Text>
          <Text style={styles.subtitle}>
            The game hit an error while rendering. You can return to the menu and
            start fresh.
          </Text>
          <Text style={styles.errName}>{error.name}: {error.message}</Text>
          {error.stack ? (
            <Text style={styles.stack}>{error.stack}</Text>
          ) : null}
          <Pressable style={styles.btn} onPress={this.handleReset}>
            <Text style={styles.btnText}>Back to Menu</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  scroll: {
    padding: 24,
    gap: 12,
  },
  title: {
    color: '#F1C40F',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 8,
  },
  errName: {
    color: '#E74C3C',
    fontSize: 13,
    fontWeight: '700',
  },
  stack: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  btn: {
    marginTop: 16,
    backgroundColor: '#D4AF37',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {
    color: '#1a1a28',
    fontWeight: '800',
    fontSize: 15,
  },
});

export default AppErrorBoundary;
