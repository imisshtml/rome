import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameState } from '../store/useGameStore';
import { useMultiplayer } from '../network/MultiplayerProvider';
import { buildPostGameSummary } from '../game/postGame';
import type { PostGameCardRow } from '../game/postGame';
import { useSafeViewportSize } from '../utils/safeViewport';

function formatVp(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return '0';
}

const CardRow: React.FC<{ row: PostGameCardRow }> = ({ row }) => (
  <View style={styles.cardRow}>
    <Text style={styles.cardName} numberOfLines={1}>
      {row.name}
      {row.count > 1 ? ` ×${row.count}` : ''}
    </Text>
    <Text
      style={[
        styles.cardVp,
        row.vpTotal > 0 && styles.cardVpPositive,
        row.vpTotal < 0 && styles.cardVpNegative,
      ]}
    >
      {formatVp(row.vpTotal)}
    </Text>
  </View>
);

export const PostGameScreen: React.FC = () => {
  const state = useGameState();
  const { leaveToLanding } = useMultiplayer();
  const summary = useMemo(() => buildPostGameSummary(state), [state]);
  const insets = useSafeAreaInsets();
  // Bind to an explicit viewport height. On web the flex:1 ancestor chain
  // collapses to content height, which leaves the ScrollView unbounded and
  // therefore unscrollable — so we size it like the board layout does.
  const { height: viewportH } = useSafeViewportSize();

  const winner = summary.players.find((p) => p.id === summary.winnerId);

  return (
    <View
      style={[
        styles.root,
        {
          height: viewportH,
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 'auto',
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator
      >
        <Text style={styles.title}>Game Over</Text>
        {winner ? (
          <Text style={styles.winnerLine}>
            {winner.name} wins with {winner.totalVp} VP
          </Text>
        ) : (
          <Text style={styles.winnerLine}>Final standings</Text>
        )}
        <Text style={styles.hint}>
          Game ended when the arena or epic supply was exhausted. Highest VP wins.
        </Text>

        {summary.players.map((player) => {
          const isWinner = player.id === summary.winnerId;
          const vpCards = player.cardRows.filter((r) => r.vpTotal !== 0);
          const zeroVpCards = player.cardRows.filter((r) => r.vpTotal === 0);

          return (
            <View
              key={player.id}
              style={[styles.playerBlock, isWinner && styles.playerBlockWinner]}
            >
              <View style={styles.playerHeader}>
                <View style={styles.playerTitleRow}>
                  <Text style={styles.rank}>#{player.rank}</Text>
                  <Text style={styles.playerName}>
                    {player.name}
                    {player.isAI ? ' (AI)' : ''}
                  </Text>
                </View>
                <Text style={styles.totalVp}>{player.totalVp} VP</Text>
              </View>

              <View style={styles.scoreBreakdown}>
                {player.bonusVp !== 0 ? (
                  <View style={styles.cardRow}>
                    <Text style={styles.cardName}>Arena victories</Text>
                    <Text style={[styles.cardVp, styles.cardVpPositive]}>
                      {formatVp(player.bonusVp)}
                    </Text>
                  </View>
                ) : null}
                {player.deckVp !== 0 ? (
                  <View style={styles.cardRow}>
                    <Text style={styles.cardName}>VP cards in deck</Text>
                    <Text
                      style={[
                        styles.cardVp,
                        player.deckVp > 0 && styles.cardVpPositive,
                        player.deckVp < 0 && styles.cardVpNegative,
                      ]}
                    >
                      {formatVp(player.deckVp)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.sectionLabel}>
                Deck ({player.deckCardCount} cards)
              </Text>

              {vpCards.length > 0 ? (
                <>
                  <Text style={styles.subLabel}>Scoring cards</Text>
                  {vpCards.map((row) => (
                    <CardRow key={row.definitionId} row={row} />
                  ))}
                </>
              ) : null}

              {zeroVpCards.length > 0 ? (
                <>
                  <Text style={styles.subLabel}>Other cards</Text>
                  {zeroVpCards.map((row) => (
                    <CardRow key={row.definitionId} row={row} />
                  ))}
                </>
              ) : null}
            </View>
          );
        })}

        <Pressable style={styles.leaveBtn} onPress={leaveToLanding}>
          <Text style={styles.leaveBtnText}>Back to Menu</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  scrollView: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scroll: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 40,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  title: {
    color: '#F1C40F',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
  },
  winnerLine: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  hint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  playerBlock: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    marginBottom: 12,
  },
  playerBlockWinner: {
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  playerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  rank: {
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '800',
    fontSize: 14,
    width: 28,
  },
  playerName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    flex: 1,
  },
  totalVp: {
    color: '#F1C40F',
    fontWeight: '800',
    fontSize: 18,
  },
  scoreBreakdown: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  subLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 4,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  cardName: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    flex: 1,
  },
  cardVp: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  cardVpPositive: {
    color: '#2ECC71',
  },
  cardVpNegative: {
    color: '#E74C3C',
  },
  leaveBtn: {
    backgroundColor: '#D4AF37',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  leaveBtnText: {
    color: '#1a1a28',
    fontWeight: '800',
    fontSize: 15,
  },
});

export default PostGameScreen;
