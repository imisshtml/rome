import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Window size minus safe-area insets — use for fixed-height board layouts. */
export function useSafeViewportSize(): { width: number; height: number } {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return {
    width: Math.max(0, width - insets.left - insets.right),
    height: Math.max(0, height - insets.top - insets.bottom),
  };
}
