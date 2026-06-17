import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { useMultiplayer } from '../network/MultiplayerProvider';
import { isSupabaseConfigured } from '../lib/env';
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/GameEngine';
import { homeBackground } from '../assets/images';

export const LandingScreen: React.FC = () => {
  const {
    createGame,
    joinGame,
    startLocalPractice,
    loading,
    error,
  } = useMultiplayer();

  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);

  const name = nickname.trim() || 'Gladiator';
  const canSubmit = !loading && name.length > 0;
  const onlineReady = isSupabaseConfigured();

  return (
    <ImageBackground
      source={homeBackground}
      style={styles.root}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Builders of Rome</Text>
          <Text style={styles.subtitle}>Gladiator Deckbuilder</Text>

          <View style={styles.card}>
          <Text style={styles.label}>Nickname</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Enter your name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={24}
          />

          <Text style={styles.label}>Players (create game)</Text>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setMaxPlayers((n) => Math.max(MIN_PLAYERS, n - 1))}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{maxPlayers}</Text>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setMaxPlayers((n) => Math.min(MAX_PLAYERS, n + 1))}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
            <Text style={styles.stepHint}>empty seats = AI</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!onlineReady ? (
            <Text style={styles.warn}>
              Supabase key missing — online play disabled. Practice still works.
            </Text>
          ) : null}

          <Pressable
            style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
            disabled={!canSubmit || !onlineReady}
            onPress={() => createGame(name, maxPlayers)}
          >
            {loading ? (
              <ActivityIndicator color="#1a1a28" />
            ) : (
              <Text style={styles.primaryBtnText}>Create Game</Text>
            )}
          </Pressable>

          <Text style={styles.label}>Join code</Text>
          <TextInput
            style={styles.input}
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.toUpperCase())}
            placeholder="ABC123"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />

          <Pressable
            style={[styles.secondaryBtn, !canSubmit && styles.btnDisabled]}
            disabled={!canSubmit || !onlineReady || joinCode.trim().length < 4}
            onPress={() => joinGame(joinCode, name)}
          >
            <Text style={styles.secondaryBtnText}>Join Game</Text>
          </Pressable>

          <Pressable
            style={[styles.ghostBtn, !canSubmit && styles.btnDisabled]}
            disabled={!canSubmit}
            onPress={() => startLocalPractice(name)}
          >
            <Text style={styles.ghostBtnText}>Practice vs AI (offline)</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 48 : 64,
  },
  title: {
    color: '#F1C40F',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 28,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  card: {
    backgroundColor: 'rgba(10,10,18,0.82)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    color: '#F1C40F',
    fontSize: 22,
    fontWeight: '700',
  },
  stepValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },
  stepHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    flex: 1,
  },
  error: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: 12,
  },
  warn: {
    color: 'rgba(241,196,15,0.7)',
    fontSize: 11,
    marginTop: 12,
  },
  primaryBtn: {
    backgroundColor: '#D4AF37',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: {
    color: '#1a1a28',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  secondaryBtnText: {
    color: '#F1C40F',
    fontWeight: '800',
    fontSize: 15,
  },
  ghostBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  ghostBtnText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.45,
  },
});

export default LandingScreen;
