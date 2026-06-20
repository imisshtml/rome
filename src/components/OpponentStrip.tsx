import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ImageBackground,
} from 'react-native';
import { PlayerState } from '../types/gameTypes';
import { getPlayerTotalVp } from '../game/postGame';
import { getValorInPlay } from '../utils/combatStatsUtils';
import { costIcon, valorIcon, victoryIcon, cardBack } from '../assets/images';
import { CARD_PORTRAIT_RATIO } from '../utils/cardDisplayUtils';

interface OpponentStripProps {
  opponents: PlayerState[];
  turnPlayerId: string;
  turnCoins: number;
  turnValor: number;
  barHeight: number;
  onPressOpponent: (player: PlayerState) => void;
}

function playAreaValor(player: PlayerState, turnValorBonus = 0): number {
  return getValorInPlay(player, turnValorBonus);
}

const CHIP_V_PAD = 2;
const NAME_LINE_H = 10;

function layoutMetrics(barHeight: number) {
  const innerH = Math.max(28, barHeight - CHIP_V_PAD * 2 - 4);
  const iconSize = Math.max(14, innerH - NAME_LINE_H - 1);
  const handH = Math.max(14, Math.floor(iconSize * 0.9));
  const handW = Math.floor(handH / CARD_PORTRAIT_RATIO);
  return { iconSize, handW, handH };
}

const StatBadge: React.FC<{
  icon: number;
  value: number;
  size: number;
}> = ({ icon, value, size }) => (
  <ImageBackground
    source={icon}
    style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}
    imageStyle={styles.statBadgeImage}
    resizeMode="contain"
  >
    <Text style={[styles.statValue, { fontSize: Math.max(8, Math.round(size * 0.38)) }]}>
      {value}
    </Text>
  </ImageBackground>
);

const OpponentChip: React.FC<{
  opponent: PlayerState;
  isTurn: boolean;
  turnCoins: number;
  turnValor: number;
  barHeight: number;
  onPress: () => void;
}> = ({ opponent, isTurn, turnCoins, turnValor, barHeight, onPress }) => {
  const { iconSize, handW, handH } = layoutMetrics(barHeight);
  const valorTotal = isTurn ? playAreaValor(opponent, turnValor) : playAreaValor(opponent);
  const coinsTotal = isTurn ? turnCoins : 0;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, isTurn && styles.chipActive]}
    >
      <View style={styles.chipBody}>
        <Text style={styles.name} numberOfLines={1}>
          {opponent.name}
          {isTurn ? ' ⚔' : ''}
        </Text>

        <View style={styles.headerStats}>
          <View style={styles.statRow}>
            <StatBadge icon={costIcon} value={coinsTotal} size={iconSize} />
            <StatBadge icon={valorIcon} value={valorTotal} size={iconSize} />
          </View>
          <StatBadge icon={victoryIcon} value={getPlayerTotalVp(opponent)} size={iconSize} />

          <View style={[styles.handBackWrap, { width: handW, height: handH }]}>
            <Image source={cardBack} style={styles.handBackImage} resizeMode="cover" />
            <View style={styles.handCountBadge}>
              <Text
                style={[
                  styles.handCountText,
                  { fontSize: Math.max(8, Math.round(iconSize * 0.38)) },
                ]}
              >
                {opponent.hand.length}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export const OpponentStrip: React.FC<OpponentStripProps> = ({
  opponents,
  turnPlayerId,
  turnCoins,
  turnValor,
  barHeight,
  onPressOpponent,
}) => {
  return (
    <View style={[styles.row, { height: barHeight }]}>
      {opponents.map((opp) => (
        <OpponentChip
          key={opp.id}
          opponent={opp}
          isTurn={opp.id === turnPlayerId}
          turnCoins={turnCoins}
          turnValor={turnValor}
          barHeight={barHeight}
          onPress={() => onPressOpponent(opp)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: CHIP_V_PAD,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    minWidth: 100,
    flexShrink: 0,
    maxHeight: '100%',
  },
  chipActive: {
    borderColor: 'rgba(241,196,15,0.75)',
    backgroundColor: 'transparent',
  },
  chipBody: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1,
    flexShrink: 0,
  },
  name: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 9,
    lineHeight: NAME_LINE_H,
    textAlign: 'left',
    alignSelf: 'flex-start',
    maxWidth: 120,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  statBadgeImage: {
    width: '100%',
    height: '100%',
  },
  statValue: {
    color: '#F1C40F',
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    paddingBottom: 2,
  },
  handBackWrap: {
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  handBackImage: {
    width: '100%',
    height: '100%',
  },
  handCountBadge: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  handCountText: {
    color: '#fff',
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default OpponentStrip;
