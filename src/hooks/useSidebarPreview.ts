import { RefObject, useCallback } from 'react';
import { Platform, View } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { useHoverPreview } from '../store/useGameStore';

export function useSidebarPreview(
  card: CardInstance | null,
  anchorRef: RefObject<View | null>,
  options?: {
    enabled?: boolean;
    onPreview?: (card: CardInstance) => void;
  }
) {
  const [, setHoverPreview] = useHoverPreview();
  const enabled = options?.enabled ?? !!card;

  const showPreview = useCallback(() => {
    if (!enabled || !card?.faceUp) return;
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setHoverPreview({ card, anchor: { x, y, width, height } });
    });
  }, [anchorRef, card, enabled, setHoverPreview]);

  const hidePreview = useCallback(() => {
    setHoverPreview(null);
  }, [setHoverPreview]);

  const handlePress = useCallback(() => {
    if (card && options?.onPreview) {
      options.onPreview(card);
    }
  }, [card, options?.onPreview]);

  const hoverProps =
    Platform.OS === 'web' && enabled
      ? {
          onMouseEnter: showPreview,
          onMouseLeave: hidePreview,
        }
      : {};

  return { hoverProps, handlePress, showPreview, hidePreview };
}
