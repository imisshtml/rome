import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ImageStyle,
} from 'react-native';
import { destroyIcon } from '../assets/images';

interface DestroyedPileButtonProps {
  count: number;
  onPress: () => void;
}

export const DestroyedPileButton: React.FC<DestroyedPileButtonProps> = ({
  count,
  onPress,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Destroyed cards, ${count}`}
    >
      <Image
        source={destroyIcon}
        style={styles.icon as ImageStyle}
        resizeMode="contain"
      />
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 50,
    height: 50,
    zIndex: 20,
  },
  icon: {
    width: 50,
    height: 50,
  },
  pressed: {
    opacity: 0.88,
  },
  countBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#F1C40F',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
  },
});

export default DestroyedPileButton;
