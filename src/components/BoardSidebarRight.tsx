import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
} from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { GameAction, GamePhase, PHASE_LABELS, PlayerState } from '../types/gameTypes';
import { costIcon, valorIcon, victoryIcon, turnButtonBg } from '../assets/images';
import CardHoverPreview from './CardHoverPreview';
import GameLogPanel from './GameLogPanel';

const STAT_ICON_GAP = 2;
const SIDEBAR_H_PAD = 4;
const PHASE_BUTTON_HEIGHT = 50;
/** button.png native size 448×132 */
const TURN_BUTTON_ASPECT = 448 / 132;

function iconSizeForSidebar(sidebarWidth: number): number {
  const base = Math.floor((sidebarWidth - SIDEBAR_H_PAD - STAT_ICON_GAP * 2) / 3);
  return Math.floor(base * 1);
}

function phaseButtonSize(sidebarWidth: number): { width: number; height: number } {
  const height = PHASE_BUTTON_HEIGHT;
  const width = Math.min(height * TURN_BUTTON_ASPECT, sidebarWidth - SIDEBAR_H_PAD * 2);
  return { width, height };
}

interface BoardSidebarRightProps {
  width: number;
  actionLog: GameAction[];
  players: PlayerState[];
  hoverPreviewCard: CardInstance | null;
  isPregame: boolean;
  coinsInPlay: number;
  valorInPlay: number;
  victoryPoints: number;
  phase: GamePhase;
  isLocalTurn: boolean;
  isLocalReady: boolean;
  readyCount: number;
  totalPlayers: number;
  onEndPhase: () => void;
  onPlayerReady?: () => void;
  onPreviewLogCard?: (card: CardInstance) => void;
}

const PHASE_BUTTON_LABELS: Record<GamePhase, string> = {
  PREGAME: 'Start Game',
  MAIN: 'End Turn',
  CLEANUP: 'Clean Up',
};

export const BoardSidebarRight: React.FC<BoardSidebarRightProps> = ({
  width,
  actionLog,
  players,
  hoverPreviewCard,
  isPregame,
  coinsInPlay,
  valorInPlay,
  victoryPoints,
  phase,
  isLocalTurn,
  isLocalReady,
  readyCount,
  totalPlayers,
  onEndPhase,
  onPreviewLogCard,
}) => {
  const buttonLabel = PHASE_BUTTON_LABELS[phase];
  const iconSize = iconSizeForSidebar(width);
  const buttonSize = phaseButtonSize(width);
  const canPressEndTurn = !isPregame && isLocalTurn && phase === 'MAIN';

  return (
    <View style={[styles.sidebar, { width }]}>
      <View style={styles.logSection}>
        <GameLogPanel
          actions={actionLog}
          players={players}
          onPreviewCard={onPreviewLogCard}
        />
      </View>

      <View style={styles.lowerSection}>
        <CardHoverPreview card={hoverPreviewCard} width={width} />
        <View style={styles.bottomBlock}>
        <Text style={styles.phaseNote}>
          {isPregame
            ? isLocalReady
              ? `Waiting ${readyCount}/${totalPlayers} ready`
              : ''
            : PHASE_LABELS[phase]}
        </Text>

        {!isPregame ? (
          <View style={styles.statsRow}>
            <StatBadge icon={costIcon} value={coinsInPlay} size={iconSize} gapAfter />
            <StatBadge icon={valorIcon} value={valorInPlay} size={iconSize} gapAfter />
            <StatBadge icon={victoryIcon} value={victoryPoints} size={iconSize} />
          </View>
        ) : null}

        {!isPregame ? (
        <Pressable
          onPress={onEndPhase}
          disabled={!canPressEndTurn}
          style={({ pressed }) => [
            styles.buttonWrap,
            !canPressEndTurn && styles.buttonDisabled,
            pressed && canPressEndTurn && styles.buttonPressed,
          ]}
        >
          <ImageBackground
            source={turnButtonBg}
            style={[styles.buttonBg, buttonSize]}
            imageStyle={styles.buttonBgImage}
            resizeMode="contain"
          >
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </ImageBackground>
        </Pressable>
        ) : null}
        </View>
      </View>
    </View>
  );
};

const StatBadge: React.FC<{
  icon: number;
  value: number;
  size: number;
  gapAfter?: boolean;
}> = ({ icon, value, size, gapAfter = false }) => (
  <ImageBackground
    source={icon}
    style={[
      styles.statBadge,
      {
        width: size,
        height: size,
      },
    ]}
    imageStyle={styles.statBadgeImage}
    resizeMode="contain"
  >
    <Text style={styles.statValue}>{value}</Text>
  </ImageBackground>
);

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: 'transparent',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(212,175,55,0.3)',
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    minHeight: 0,
    overflow: 'hidden',
  },
  logSection: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  lowerSection: {
    flexShrink: 0,
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 6,
  },
  bottomBlock: {
    width: '100%',
    alignItems: 'center',
    //marginTop: 10,
  },
  phaseNote: {
    color: 'rgba(241,196,15,0.85)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBadgeImage: {
    width: '100%',
    height: '100%',
  },
  statValue: {
    color: '#F1C40F',
    fontWeight: '800',
    fontSize: 22,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    paddingBottom: 5,
  },
  buttonWrap: {
    alignItems: 'center',
    width: '100%',
  },
  buttonBg: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  buttonBgImage: {
    borderRadius: 6,
    resizeMode: 'contain',
  },
  buttonText: {
    color: '#F5E6C8',
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

export default BoardSidebarRight;
