import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { formatBuildLabel } from '../utils/buildDisplay';

export const BuildLabel: React.FC<{ style?: StyleProp<TextStyle> }> = ({ style }) => (
  <Text style={[styles.text, style]}>{formatBuildLabel()}</Text>
);

const styles = StyleSheet.create({
  text: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});

export default BuildLabel;
