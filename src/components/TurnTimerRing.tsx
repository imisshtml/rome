import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface TurnTimerRingProps {
  /** Wall-clock ms the current turn started (Date.now()). */
  startMs: number;
  /** Total turn budget in ms. */
  durationMs: number;
  /** Outer diameter of the ring. */
  size?: number;
  color?: string;
  /** Show mm:ss remaining in the hole. */
  showLabel?: boolean;
}

/**
 * Dissolving-circle countdown (same visual language as the event timer).
 * Deliberately interval-driven rather than reanimated: a continuous 2-minute
 * per-frame animation on web writes to the DOM ~60x/sec and starves the main
 * thread. A coarse tick keeps it cheap and only re-renders this leaf.
 */
export const TurnTimerRing: React.FC<TurnTimerRingProps> = ({
  startMs,
  durationMs,
  size = 26,
  color = '#F1C40F',
  showLabel = false,
}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [startMs, durationMs]);

  const remaining = Math.max(0, durationMs - Math.max(0, now - startMs));
  const progress = durationMs > 0 ? remaining / durationMs : 0; // 1 -> 0
  const sweepDeg = progress * 360;
  const holeSize = Math.round(size * 0.64);

  const ringStyle =
    Platform.OS === 'web'
      ? ({
          background: `conic-gradient(from -90deg, ${color} 0deg, ${color} ${sweepDeg}deg, transparent ${sweepDeg}deg, transparent 360deg)`,
        } as Record<string, string>)
      : {
          opacity: 0.35 + progress * 0.65,
          transform: [{ rotate: `${-90 + (1 - progress) * 360}deg` }],
          borderTopColor: color,
          borderWidth: 3,
          borderColor: 'transparent',
        };

  const totalSec = Math.ceil(remaining / 1000);
  const label = `${Math.floor(totalSec / 60)}:${(totalSec % 60)
    .toString()
    .padStart(2, '0')}`;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={[
          styles.track,
          { width: size, height: size, borderRadius: size / 2, borderColor: `${color}40` },
        ]}
      />
      <View
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2 },
          ringStyle,
        ]}
      />
      <View
        style={[
          styles.hole,
          { width: holeSize, height: holeSize, borderRadius: holeSize / 2 },
        ]}
      />
      {showLabel ? (
        <Text style={[styles.label, { fontSize: Math.max(7, Math.round(size * 0.3)) }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    borderWidth: 3,
  },
  hole: {
    position: 'absolute',
    backgroundColor: '#1a1a2e',
  },
  label: {
    position: 'absolute',
    color: '#F5E6C8',
    fontWeight: '800',
  },
});

export default TurnTimerRing;
