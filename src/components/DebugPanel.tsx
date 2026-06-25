import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  useWindowDimensions,
} from 'react-native';
import {
  useGameState,
  useDebugVisible,
  useResetGame,
  useArenaValor,
  useMultiplayerMeta,
  useLocalPlayerKey,
  useDispatchAction,
} from '../store/useGameStore';
import { useMultiplayer } from '../network/MultiplayerProvider';
import { useTutorialOptional } from '../context/TutorialContext';
import { resetTutorialCompleted } from '../tutorial/tutorialStorage';
import { PHASE_LABELS } from '../types/gameTypes';
import { getPlayerTotalVp } from '../game/postGame';
import { copyToClipboard } from '../utils/copyToClipboard';
import BuildLabel from './BuildLabel';

export const DebugPanel: React.FC<{ inOpponentsBar?: boolean }> = ({
  inOpponentsBar = false,
}) => {
  const state = useGameState();
  const [visible, setVisible] = useDebugVisible();
  const resetGame = useResetGame();
  const arenaValor = useArenaValor();
  const mpMeta = useMultiplayerMeta();
  const localPlayerKey = useLocalPlayerKey();
  const dispatch = useDispatchAction();
  const { joinCode, isOnline, startGame, session } = useMultiplayer();
  const tutorial = useTutorialOptional();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const currentPlayer = state.players.find(
    (p) => p.id === state.turnPlayerId
  );

  const displayJoinCode = joinCode || mpMeta.joinCode || '—';
  const panelW = Math.min(360, screenW - 32);
  const panelMaxH = Math.min(560, screenH * 0.88);

  const handleCopyCode = async () => {
    if (displayJoinCode === '—') return;
    await copyToClipboard(displayJoinCode);
  };

  return (
    <>
      <View style={inOpponentsBar ? styles.opponentsAnchor : styles.wrapper}>
        <Pressable
          style={styles.toggleBtn}
          onPress={() => setVisible(!visible)}
        >
          <Text style={styles.toggleText}>{visible ? '✕' : '⚙'}</Text>
        </Pressable>
      </View>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.panel, { width: panelW, maxHeight: panelMaxH }]}>
            <View style={styles.headerRow}>
              <Text style={styles.header}>Debug</Text>
              <Pressable onPress={() => setVisible(false)} hitSlop={12}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <Pressable style={styles.codeHero} onPress={handleCopyCode}>
              <Text style={styles.codeHeroLabel}>Game / Join Code</Text>
              <Text style={styles.codeHeroValue} selectable>
                {displayJoinCode}
              </Text>
              {displayJoinCode !== '—' ? (
                <Text style={styles.codeHeroHint}>Tap to copy</Text>
              ) : null}
            </Pressable>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <View style={styles.section}>
                <Row label="Online" value={isOnline ? 'Yes' : 'Local'} />
                <Row label="You" value={localPlayerKey} />
                <Row label="Game" value={state.status ?? 'active'} />
                {mpMeta.error ? (
                  <Text style={styles.errorText}>{mpMeta.error}</Text>
                ) : null}
                {session?.isHost &&
                session.gameId !== 'local' &&
                state.status === 'lobby' ? (
                  <Pressable style={styles.startBtn} onPress={() => startGame()}>
                    <Text style={styles.startBtnText}>Start Game</Text>
                  </Pressable>
                ) : null}
                {state.status === 'active' ? (
                  <Pressable
                    style={styles.endBtn}
                    onPress={() =>
                      dispatch({
                        type: 'END_GAME',
                        playerId: localPlayerKey,
                        timestamp: Date.now(),
                      })
                    }
                  >
                    <Text style={styles.endBtnText}>End Game (scores)</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.divider} />

              <View style={styles.section}>
                <Row label="Turn" value={`${state.turnNumber}`} />
                <Row label="Phase" value={PHASE_LABELS[state.phase]} highlight />
                <Row label="Current" value={currentPlayer?.name ?? 'N/A'} />
                <Row label="Arena Valor" value={`${arenaValor} ⚔`} />
                <Row
                  label="Cards in Play"
                  value={`${currentPlayer?.playArea.length ?? 0}`}
                />
                <Row
                  label="Commit Zone"
                  value={`${state.arenaCommitZone.length} cards`}
                />
              </View>

              <View style={styles.divider} />
              <Text style={styles.subHeader}>Players</Text>
              {state.players.map((p) => (
                <View key={p.id} style={styles.playerBlock}>
                  <Text style={styles.playerName}>
                    {p.name} {p.id === state.turnPlayerId ? '⚔' : ''}
                  </Text>
                  <View style={styles.playerStats}>
                    <MiniStat label="VP" value={getPlayerTotalVp(p)} />
                    <MiniStat label="H" value={p.hand.length} />
                    <MiniStat label="D" value={p.deck.length} />
                    <MiniStat label="X" value={p.discard.length} />
                    <MiniStat label="P" value={p.playArea.length} />
                  </View>
                </View>
              ))}

              <View style={styles.divider} />
              <Text style={styles.subHeader}>Zones</Text>
              <Row label="Gallery row" value={`${state.galleryCards.length}`} />
              <Row
                label="Gallery deck"
                value={`${state.gallerySupply?.length ?? 0}`}
              />
              <Row
                label="Recruit"
                value={
                  state.recruitCard
                    ? `${state.recruitCard.definition.name} (+${state.recruitDeck?.length ?? 0})`
                    : 'Empty'
                }
              />
              <Row
                label="Arena"
                value={state.arenaCard?.definition.name ?? 'None'}
              />
              <Row label="Arena Deck" value={`${state.arenaDeck.length}`} />
              <Row label="Epic" value={`${state.epicCards.length}`} />
              <Row label="Favor" value={`${state.flavorDeck.length}`} />
              <Row label="Disfavor" value={`${state.disfavorDeck.length}`} />

              <View style={styles.divider} />
              <Text style={styles.subHeader}>
                Log ({state.actionLog.length})
              </Text>
              {state.actionLog.slice(-8).map((a, i) => (
                <Text key={i} style={styles.logEntry}>
                  {a.type} → {a.playerId}
                </Text>
              ))}

              {tutorial ? (
                <Pressable
                  style={styles.resetBtn}
                  onPress={() => {
                    resetTutorialCompleted();
                    tutorial.startTutorial();
                  }}
                >
                  <Text style={styles.resetText}>Replay Tutorial</Text>
                </Pressable>
              ) : null}

              <Pressable style={styles.resetBtn} onPress={() => resetGame()}>
                <Text style={styles.resetText}>Reset Game</Text>
              </Pressable>

              <BuildLabel style={styles.buildLabel} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const Row: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>
      {value}
    </Text>
  </View>
);

const MiniStat: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <Text style={styles.miniStat}>
    {label}:{value}
  </Text>
);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 44,
    right: 8,
    zIndex: 9999,
  },
  opponentsAnchor: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 10000,
  },
  toggleBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  toggleText: {
    color: '#fff',
    fontSize: 14,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    backgroundColor: 'rgba(10,10,20,0.96)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  header: {
    color: '#F1C40F',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  closeText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 18,
    fontWeight: '700',
  },
  codeHero: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  codeHeroLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  codeHeroValue: {
    color: '#F1C40F',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 4,
  },
  codeHeroHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    marginTop: 4,
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  subHeader: {
    color: '#3498DB',
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 4,
  },
  section: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  rowLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
  rowValue: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
  },
  rowValueHighlight: {
    color: '#F1C40F',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
  playerBlock: {
    marginBottom: 4,
  },
  playerName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  playerStats: {
    flexDirection: 'row',
    gap: 6,
  },
  miniStat: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
  },
  logEntry: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    marginBottom: 1,
    fontFamily: 'monospace',
  },
  resetBtn: {
    backgroundColor: '#C0392B',
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  resetText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 10,
    marginTop: 4,
  },
  startBtn: {
    backgroundColor: '#27AE60',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  endBtn: {
    backgroundColor: '#8E44AD',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  endBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  buildLabel: {
    marginTop: 12,
    marginBottom: 4,
  },
});

export default DebugPanel;
