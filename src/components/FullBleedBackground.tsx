import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  Platform,
  ImageSourcePropType,
  StyleProp,
  ViewStyle,
  ImageStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  /** Semi-transparent tint over the background image. */
  overlayColor?: string;
  children?: React.ReactNode;
};

const webFixedFill = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100dvh',
  objectFit: 'cover',
  objectPosition: 'center',
} as unknown as ImageStyle;

const webFixedOverlay = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100dvh',
} as unknown as ViewStyle;

/**
 * Full-viewport background image. Background bleeds edge-to-edge; children
 * are inset for safe areas so controls stay tappable on iPad/notch devices.
 */
export function FullBleedBackground({
  source,
  style,
  overlayColor,
  children,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, style]}>
      <Image source={source} style={styles.image} resizeMode="cover" />
      {overlayColor ? (
        <View
          style={[styles.overlay, { backgroundColor: overlayColor }]}
          pointerEvents="none"
        />
      ) : null}
      {children ? (
        <View
          style={[
            styles.foreground,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ minHeight: '100dvh' as unknown as ViewStyle['minHeight'] })
      : null),
  },
  image: Platform.OS === 'web' ? webFixedFill : StyleSheet.absoluteFillObject,
  overlay: Platform.OS === 'web' ? webFixedOverlay : StyleSheet.absoluteFillObject,
  foreground: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    zIndex: 2,
  },
});
