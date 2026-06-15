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
  coinsInPlay: number;
  valorInPlay: number;
  victoryPoints: number;
  phase: GamePhase;
  isLocalTurn: boolean;
  onEndPhase: () => void;
}

const PHASE_BUTTON_LABELS: Record<GamePhase, string> = {
  DRAW: 'End Draw',
  MAIN: 'End Main',
  ARENA: 'End Arena',
  BUY: 'End Buys',
  END: 'End Turn',
};

export const BoardSidebarRight: React.FC<BoardSidebarRightProps> = ({
  width,
  coinsInPlay,
  valorInPlay,
  victoryPoints,
  phase,
  isLocalTurn,
  onEndPhase,
}) => {
  const buttonLabel = PHASE_BUTTON_LABELS[phase];
  const iconSize = iconSizeForSidebar(width);
  const buttonSize = phaseButtonSize(width);

  return (
    <View style={[styles.sidebar, { width }]}>
      <View style={styles.bottomBlock}>
        <Text style={styles.phaseNote}>{PHASE_LABELS[phase]}</Text>

        <View style={styles.statsRow}>
          <StatBadge icon={costIcon} value={coinsInPlay} size={iconSize} gapAfter />
          <StatBadge icon={valorIcon} value={valorInPlay} size={iconSize} gapAfter />
          <StatBadge icon={victoryIcon} value={victoryPoints} size={iconSize} />
        </View>

        <Pressable
          onPress={onEndPhase}
          disabled={!isLocalTurn}
          style={({ pressed }) => [
            styles.buttonWrap,
            !isLocalTurn && styles.buttonDisabled,
            pressed && isLocalTurn && styles.buttonPressed,
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
