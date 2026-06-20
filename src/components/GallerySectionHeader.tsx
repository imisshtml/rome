import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface GallerySectionHeaderProps {
  label: string;
  style?: ViewStyle;
}

export const GallerySectionHeader: React.FC<GallerySectionHeaderProps> = ({
  label,
  style,
}) => (
  <View style={[styles.row, style]}>
    <View style={styles.line} />
    <Text style={styles.label}>{label}</Text>
    <View style={styles.line} />
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  line: {
    flex: 1,
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
});

export default GallerySectionHeader;
