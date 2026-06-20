import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

export type GallerySectionHeaderSize = 'default' | 'compact' | 'expanded' | 'wide';

/** Bottom-row column flex weights (Recruits / Arena / Epics). */
export const GALLERY_BOTTOM_COLUMN_FLEX = {
  recruit: 0.82,
  arena: 1.1,
  epics: 1.45,
} as const;

const LINE_FLEX: Record<Exclude<GallerySectionHeaderSize, 'compact'>, number> = {
  default: 1,
  expanded: 1.18,
  wide: 1.38,
};

interface GallerySectionHeaderProps {
  label: string;
  size?: GallerySectionHeaderSize;
  style?: ViewStyle;
}

export const GallerySectionHeader: React.FC<GallerySectionHeaderProps> = ({
  label,
  size = 'default',
  style,
}) => {
  if (size === 'compact') {
    return (
      <View style={[styles.compactWrap, style]}>
        <View style={styles.compactRow}>
          <View style={styles.compactLine} />
          <Text style={[styles.label, styles.compactLabel]}>{label}</Text>
          <View style={styles.compactLine} />
        </View>
      </View>
    );
  }

  const lineFlex = LINE_FLEX[size];

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.line, { flex: lineFlex }]} />
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.line, { flex: lineFlex }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  compactWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.4)',
  },
  compactLine: {
    width: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.4)',
  },
  label: {
    color: 'rgba(212,175,55,0.7)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
  },
  compactLabel: {
    paddingHorizontal: 6,
    letterSpacing: 1.1,
  },
});

export default GallerySectionHeader;
