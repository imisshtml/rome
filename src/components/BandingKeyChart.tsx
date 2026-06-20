import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { CardInstance, FACTION_COLORS } from '../types/cardTypes';
import { BandingFaction } from '../types/gameTypes';
import {
  BANDING_FACTIONS,
  countBandingFactionInPlayArea,
} from '../utils/bandingUtils';
import { BANDING_FACTION_ICONS } from '../utils/factionIconAssets';

interface BandingKeyChartProps {
  playArea: CardInstance[];
  claimedFactions?: BandingFaction[];
}

const FACTION_SHORT_LABEL: Record<BandingFaction, string> = {
  Ludus: '1 Favor',
  Senate: '+2 Coins',
  Legion: 'Draw 1',
};

function DashRow({
  count,
  claimed,
  activeColor,
}: {
  count: number;
  claimed: boolean;
  activeColor: string;
}) {
  return (
    <View style={styles.dashRow}>
      {[0, 1, 2].map((i) => {
        const filled = i < count;
        return (
          <View
            key={i}
            style={[
              styles.dash,
              filled && styles.dashFilled,
              filled && {
                backgroundColor: claimed ? '#27AE60' : activeColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export const BandingKeyChart: React.FC<BandingKeyChartProps> = ({
  playArea,
  claimedFactions = [],
}) => {
  return (
    <View style={styles.chart}>
      {BANDING_FACTIONS.map((faction) => {
        const count = Math.min(
          3,
          countBandingFactionInPlayArea(playArea, faction)
        );
        const claimed = claimedFactions.includes(faction);
        const color = FACTION_COLORS[faction];

        return (
          <View key={faction} style={styles.factionKey}>
            <Image
              source={BANDING_FACTION_ICONS[faction]}
              style={styles.icon}
              resizeMode="contain"
            />
            <Text style={[styles.effect, { color }]} numberOfLines={1}>
              {FACTION_SHORT_LABEL[faction]}
            </Text>
            <DashRow count={count} claimed={claimed} activeColor={color} />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'column',
    gap: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  factionKey: {
    alignItems: 'center',
    gap: 2,
  },
  icon: {
    width: 25,
    height: 25,
  },
  effect: {
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 10,
  },
  dashRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 1,
  },
  dash: {
    width: 10,
    height: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  dashFilled: {
    opacity: 1,
  },
});

export default BandingKeyChart;
