import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
} from 'react-native';
import { GamePhase, PHASE_LABELS } from '../types/gameTypes';
import { costIcon, valorIcon, victoryIcon, turnButtonBg } from '../assets/images';

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
  onPlayerReady: () => void;
}

const PHASE_BUTTON_LABELS: Record<GamePhase, string> = {
  PREGAME: 'Ready',
  MAIN: 'End Turn',
  CLEANUP: 'Clean Up',
};

export const BoardSidebarRight: React.FC<BoardSidebarRightProps> = ({
  width,
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
  onPlayerReady,
}) => {
  const buttonLabel = isPregame
    ? isLocalReady
      ? 'Waiting…'
      : 'Ready'
    : PHASE_BUTTON_LABELS[phase];
  const iconSize = iconSizeForSidebar(width);
  const buttonSize = phaseButtonSize(width);
  const canPressReady = isPregame && !isLocalReady;
  const canPressEndTurn = !isPregame && isLocalTurn && phase === 'MAIN';

  return (
    <View style={[styles.sidebar, { width }]}>
      <View style={styles.bottomBlock}>
        <Text style={styles.phaseNote}>
          {isPregame
            ? `Ready ${readyCount}/${totalPlayers}`
            : PHASE_LABELS[phase]}
        </Text>

        {!isPregame ? (
          <View style={styles.statsRow}>
            <StatBadge icon={costIcon} value={coinsInPlay} size={iconSize} gapAfter />
            <StatBadge icon={valorIcon} value={valorInPlay} size={iconSize} gapAfter />
            <StatBadge icon={victoryIcon} value={victoryPoints} size={iconSize} />
          </View>
        ) : null}

        <Pressable
          onPress={isPregame ? onPlayerReady : onEndPhase}
          disabled={isPregame ? !canPressReady : !canPressEndTurn}
          style={({ pressed }) => [
            styles.buttonWrap,
            (isPregame ? !canPressReady : !canPressEndTurn) && styles.buttonDisabled,
            pressed && (canPressReady || canPressEndTurn) && styles.buttonPressed,
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
    backgroundColor: 'rgba(60,60,70,0.55)',
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 50,
  },
  bottomBlock: {
    width: '100%',
    alignItems: 'center',
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
    paddingBottom: 7,
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
