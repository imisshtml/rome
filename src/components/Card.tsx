import React, { useCallback, useEffect } from 'react';
import { ViewStyle, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { CardInstance, FACTION_COLORS } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { useDraggedCard, useHoverPreviewCard } from '../store/useGameStore';
import CardFace from './CardFace';

export type CardSizeMode = 'full' | 'short' | 'square' | 'landscape';

export interface CardProps {
  card: CardInstance;
  width?: number;
  height?: number;
  draggable?: boolean;
  disabled?: boolean;
  onPress?: (card: CardInstance) => void;
  onLongPress?: (card: CardInstance) => void;
  onDragStart?: (card: CardInstance) => void;
  onDragEnd?: (card: CardInstance, x: number, y: number) => void;
  onDragUpdate?: (x: number, y: number) => void;
  style?: ViewStyle;
  /** @deprecated use sizeMode="short" */
  compact?: boolean;
  sizeMode?: CardSizeMode;
  /** Show enlarged preview in right sidebar on web hover */
  hoverPreview?: boolean;
}

const SPRING_CONFIG = { damping: 32, stiffness: 320 };

export const Card: React.FC<CardProps> = ({
  card,
  width = 100,
  height = 140,
  draggable = false,
  disabled = false,
  onPress,
  onLongPress,
  onDragStart,
  onDragEnd,
  onDragUpdate,
  style,
  compact = false,
  sizeMode,
  hoverPreview = true,
}) => {
  const definition =
    card.definition ?? getCardDefinition(card.definitionId);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIdx = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.4);
  const opacityOverride = useSharedValue(1);

  const [draggedCard, setDraggedCard] = useDraggedCard();
  const [, setHoverPreviewCard] = useHoverPreviewCard();
  const isThisDragged = draggedCard?.instanceId === card.instanceId;

  useEffect(() => {
    opacityOverride.value = isThisDragged ? 0 : 1;
  }, [isThisDragged, opacityOverride]);

  const handleDragStart = useCallback(() => {
    setHoverPreviewCard(null);
    setDraggedCard(card);
    onDragStart?.(card);
  }, [card, onDragStart, setDraggedCard, setHoverPreviewCard]);

  const handleDragEnd = useCallback(
    (x: number, y: number) => {
      setDraggedCard(null);
      onDragEnd?.(card, x, y);
    },
    [card, onDragEnd, setDraggedCard]
  );

  const showSidebarPreview = useCallback(() => {
    if (hoverPreview && card.faceUp) {
      setHoverPreviewCard(card);
    }
  }, [card, hoverPreview, setHoverPreviewCard]);

  const hideSidebarPreview = useCallback(() => {
    setHoverPreviewCard(null);
  }, [setHoverPreviewCard]);

  const panGesture = Gesture.Pan()
    .enabled(draggable && !disabled)
    .onStart((e) => {
      if (!onDragUpdate) {
        scale.value = withSpring(1.12, SPRING_CONFIG);
        shadowOpacity.value = withSpring(0.7);
        zIdx.value = 1000;
      }
      runOnJS(handleDragStart)();
      if (onDragUpdate) {
        runOnJS(onDragUpdate)(e.absoluteX, e.absoluteY);
      }
    })
    .onUpdate((e) => {
      if (onDragUpdate) {
        runOnJS(onDragUpdate)(e.absoluteX, e.absoluteY);
      } else {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      const finalX = e.absoluteX;
      const finalY = e.absoluteY;
      translateX.value = withSpring(0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);
      scale.value = withSpring(1, SPRING_CONFIG);
      shadowOpacity.value = withSpring(0.4);
      zIdx.value = 1;
      runOnJS(handleDragEnd)(finalX, finalY);
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (onPress && !disabled) {
      runOnJS(onPress)(card);
    }
  });

  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onEnd(() => {
      if (onLongPress && !disabled) {
        runOnJS(onLongPress)(card);
      }
    });

  const composed = Gesture.Race(
    panGesture,
    Gesture.Exclusive(longPressGesture, tapGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIdx.value,
    shadowOpacity: shadowOpacity.value,
    opacity: opacityOverride.value,
  }));

  const hoverProps =
    Platform.OS === 'web' && hoverPreview
      ? {
          onMouseEnter: showSidebarPreview,
          onMouseLeave: hideSidebarPreview,
        }
      : {};

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        {...hoverProps}
        style={[
          {
            width,
            height,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowRadius: 6,
            elevation: 5,
          },
          animatedStyle,
          disabled && { opacity: 0.45 },
          style,
        ]}
      >
        <CardFace
          definition={definition}
          faceUp={card.faceUp}
          width={width}
          height={height}
          chosenFaction={card.chosenFaction}
          style={
            card.chosenFaction
              ? {
                  borderColor: FACTION_COLORS[card.chosenFaction],
                  borderWidth: 2.5,
                }
              : undefined
          }
        />
      </Animated.View>
    </GestureDetector>
  );
};

export default Card;
