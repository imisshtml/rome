import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  Image,
} from 'react-native';
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
import { getCardImage, cardBack as cardBackImage } from '../assets/images';
import { useDraggedCard } from '../store/useGameStore';

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
}) => {
  const definition =
    card.definition ??
    getCardDefinition(card.definitionId);
  const { faceUp } = card;
  const bgColor = FACTION_COLORS[definition.faction] ?? '#555';
  const cardImage = getCardImage(definition.image);
  const mode: CardSizeMode =
    sizeMode ?? (compact ? 'short' : 'full');
  const isShort = mode === 'short';
  const isSquare = mode === 'square';
  const isLandscape = mode === 'landscape';

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIdx = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.4);
  const opacityOverride = useSharedValue(1);

  const [draggedCard, setDraggedCard] = useDraggedCard();
  const isThisDragged = draggedCard?.instanceId === card.instanceId;

  useEffect(() => {
    opacityOverride.value = isThisDragged ? 0 : 1;
  }, [isThisDragged, opacityOverride]);

  const handleDragStart = useCallback(() => {
    setDraggedCard(card);
    onDragStart?.(card);
  }, [card, onDragStart, setDraggedCard]);

  const handleDragEnd = useCallback(
    (x: number, y: number) => {
      setDraggedCard(null);
      onDragEnd?.(card, x, y);
    },
    [card, onDragEnd, setDraggedCard]
  );

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

  if (!faceUp) {
    return (
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            styles.card,
            styles.cardImageShell,
            { width, height },
            animatedStyle,
            disabled && styles.disabled,
            style,
          ]}
        >
          <Image
            source={cardBackImage}
            style={styles.cardImageFill}
            resizeMode="cover"
          />
        </Animated.View>
      </GestureDetector>
    );
  }

  if (cardImage) {
    return (
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            styles.card,
            styles.cardImageShell,
            { width, height },
            animatedStyle,
            disabled && styles.disabled,
            style,
          ]}
        >
          <Image
            source={cardImage}
            style={styles.cardImageFill}
            resizeMode="cover"
          />
        </Animated.View>
      </GestureDetector>
    );
  }

  if (isShort || isSquare) {
    return (
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            styles.card,
            isSquare && styles.cardSquare,
            { width, height, backgroundColor: bgColor },
            animatedStyle,
            disabled && styles.disabled,
            style,
          ]}
        >
          <View style={styles.compactHeader}>
            <Text style={styles.compactCost}>{definition.cost}</Text>
            <Text style={styles.compactValor}>⚔{definition.valor}</Text>
          </View>
          <View style={styles.compactBody}>
            <Text
              style={[styles.compactTitle, isSquare && styles.squareTitle]}
              numberOfLines={isSquare ? 3 : 2}
            >
              {definition.name}
            </Text>
          </View>
          {definition.victoryPoints !== 0 && (
            <Text style={styles.compactVp}>★{definition.victoryPoints}</Text>
          )}
        </Animated.View>
      </GestureDetector>
    );
  }

  if (isLandscape) {
    return (
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            styles.card,
            styles.cardLandscape,
            { width, height, backgroundColor: bgColor },
            animatedStyle,
            disabled && styles.disabled,
            style,
          ]}
        >
          <View style={styles.landscapeInner}>
            <View style={styles.landscapeMeta}>
              <Text style={styles.landscapeCost}>{definition.cost}</Text>
              <Text style={styles.landscapeName} numberOfLines={1}>
                {definition.name}
              </Text>
              <Text style={styles.landscapeValor}>⚔ {definition.valor}</Text>
            </View>
            <Text style={styles.landscapeFaction}>{definition.faction}</Text>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  }

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          styles.card,
          { width, height, backgroundColor: bgColor },
          animatedStyle,
          disabled && styles.disabled,
          style,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.costBadge}>
            <Text style={styles.costText}>{definition.cost}</Text>
          </View>
          <Text style={styles.valorText}>⚔ {definition.valor}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.nameText} numberOfLines={2}>
            {definition.name}
          </Text>
          <Text style={styles.factionText}>{definition.faction}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.descText} numberOfLines={2}>
            {definition.text}
          </Text>
          {definition.victoryPoints !== 0 && (
            <Text style={styles.vpText}>★ {definition.victoryPoints}</Text>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
    overflow: 'hidden',
  },
  cardImageShell: {
    padding: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#12122a',
  },
  cardImageFill: {
    width: '100%',
    height: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  cardBack: {
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#2a2a4a',
    borderWidth: 2,
  },
  cardBackPattern: {
    width: '80%',
    height: '80%',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3a3a5a',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16213e',
  },
  cardBackText: {
    fontSize: 28,
    color: '#555',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  costBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  costText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  valorText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  factionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 8,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  descText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 8,
    flex: 1,
    lineHeight: 11,
  },
  vpText: {
    color: '#FFD700',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 4,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactCost: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    width: 16,
    height: 16,
    borderRadius: 8,
    textAlign: 'center',
    lineHeight: 16,
    overflow: 'hidden',
  },
  compactValor: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  compactBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTitle: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  compactVp: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'right',
  },
  cardSquare: {
    padding: 4,
    borderRadius: 8,
  },
  squareTitle: {
    fontSize: 8,
    lineHeight: 10,
  },
  cardLandscape: {
    padding: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C0392B',
  },
  landscapeInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  landscapeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  landscapeCost: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  landscapeName: {
    flex: 1,
    color: '#F1C40F',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  landscapeValor: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  landscapeFaction: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default Card;
