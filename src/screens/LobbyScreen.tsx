import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useMultiplayer } from '../network/MultiplayerProvider';
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/GameEngine';
import { homeBackground } from '../assets/images';
import { FullBleedBackground } from '../components/FullBleedBackground';
import RulesModal from '../components/RulesModal';

export const LobbyScreen: React.FC = () => {
  const {
    lobby,
    session,
    joinCode,
    loading,
    error,
    updateMaxPlayers,
    startGame,
    leaveToLanding,
  } = useMultiplayer();

  const maxPlayers = lobby?.maxPlayers ?? 6;
  const humans = (lobby?.players ?? []).filter((p) => !p.is_ai);

  const seats = Array.from({ length: maxPlayers }, (_, i) => {
    const seatIndex = i + 1;
    const human = humans.find((p) => p.seat_index === seatIndex);
    if (human) {
      return {
        seatIndex,
        label: human.display_name,
        sub: human.is_host ? 'Host' : 'Player',
        kind: 'human' as const,
      };
    }
    return {
      seatIndex,
      label: `AI ${seatIndex}`,
      sub: 'Waiting',
      kind: 'ai' as const,
    };
  });

  const canStart = session?.isHost && humans.length >= 1;
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <FullBleedBackground source={homeBackground} style={styles.root}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.topRow}>
          <Pressable style={styles.backBtn} onPress={leaveToLanding}>
            <Text style={styles.backText}>← Leave</Text>
          </Pressable>
          <Pressable style={styles.rulesBtn} onPress={() => setRulesOpen(true)}>
            <Text style={styles.rulesBtnText}>Rules</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Game Lobby</Text>
        <Text style={styles.subtitle}>Share this code with other players</Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Join Code</Text>
          <Text style={styles.code}>{joinCode || lobby?.joinCode || '——'}</Text>
        </View>

        {session?.isHost ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Table size</Text>
            <View style={styles.stepperRow}>
              <Pressable
                style={styles.stepBtn}
                disabled={loading || maxPlayers <= MIN_PLAYERS}
                onPress={() => updateMaxPlayers(maxPlayers - 1)}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepValue}>{maxPlayers}</Text>
              <Pressable
                style={styles.stepBtn}
                disabled={loading || maxPlayers >= MAX_PLAYERS}
                onPress={() => updateMaxPlayers(maxPlayers + 1)}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>
              Unfilled seats become AI when the game starts.
            </Text>
          </View>
        ) : (
          <Text style={styles.waitHint}>Waiting for host to start…</Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seats</Text>
          {seats.map((seat) => (
            <View
              key={seat.seatIndex}
              style={[
                styles.seatRow,
                seat.kind === 'ai' && styles.seatRowAi,
              ]}
            >
              <Text style={styles.seatIndex}>{seat.seatIndex}</Text>
              <View style={styles.seatInfo}>
                <Text style={styles.seatName}>{seat.label}</Text>
                <Text style={styles.seatSub}>{seat.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {session?.isHost ? (
          <Pressable
            style={[styles.startBtn, (!canStart || loading) && styles.btnDisabled]}
            disabled={!canStart || loading}
            onPress={() => startGame()}
          >
            {loading ? (
              <ActivityIndicator color="#1a1a28" />
            ) : (
              <Text style={styles.startBtnText}>Start Game</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
      <RulesModal visible={rulesOpen} onClose={() => setRulesOpen(false)} />
    </FullBleedBackground>
  );
};

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#0f0f1a',
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    padding: 14,
    paddingTop: 12,
    paddingBottom: 16,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  backBtn: {
    marginBottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rulesBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  rulesBtnText: {
    color: 'rgba(241,196,15,0.85)',
    fontSize: 12,
    fontWeight: '700',
  },
  backText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  title: {
    color: '#F1C40F',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  codeBox: {
    backgroundColor: 'rgba(10,10,18,0.82)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    marginBottom: 10,
  },
  codeLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  code: {
    color: '#F1C40F',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 4,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    color: '#F1C40F',
    fontSize: 18,
    fontWeight: '700',
  },
  stepValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 6,
  },
  waitHint: {
    color: 'rgba(241,196,15,0.65)',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 11,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,18,0.72)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  seatRowAi: {
    borderStyle: 'dashed',
    opacity: 0.75,
  },
  seatIndex: {
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '800',
    fontSize: 11,
    width: 20,
  },
  seatInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  seatName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    flexShrink: 1,
  },
  seatSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
  },
  error: {
    color: '#E74C3C',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 6,
  },
  startBtn: {
    backgroundColor: '#27AE60',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  startBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});

export default LobbyScreen;
