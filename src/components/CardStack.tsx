import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { CardInstance, FACTION_COLORS } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { cardBack as cardBackImage } from '../assets/images';
import { useSidebarPreview } from '../hooks/useSidebarPreview';
import CardFace from './CardFace';

interface CardStackProps {
  cards: CardInstance[];
  label: string;
  onPress?: () => void;
  color?: string;
  showCount?: boolean;
  width?: number;
  height?: number;
  icon?: string;
  /** Supply pile style (Favor/Disfavor) – stack icon look instead of cards */
  supplyPile?: boolean;
  /** Left sidebar square stack buttons */
  sidebarStack?: boolean;
  /** Show shared card back art instead of colored tile + icon */
  useCardBack?: boolean;
  /** Dark overlay on card back (e.g. discard pile) */
  cardBackOverlay?: boolean;
  /** Show the top card's face art instead of a solid tile */
  showTopCardFace?: boolean;
  /** Hover sidebar preview + click to enlarge (face-up sidebar stacks). */
  hoverPreview?: boolean;
  onPreview?: (card: CardInstance) => void;
}

export const CardStack: React.FC<CardStackProps> = ({
  cards,
  label,
  onPress,
  color,
  showCount = true,
  width = 80,
  height = 112,
  icon,
  supplyPile = false,
  sidebarStack = false,
  useCardBack = false,
  cardBackOverlay = false,
  showTopCardFace = false,
  hoverPreview = false,
  onPreview,
}) => {
  const topCard = cards[cards.length - 1];
  const bgColor =
    color ??
    (topCard?.definition?.faction
      ? FACTION_COLORS[topCard.definition.faction]
      : '#222238');
  const count = cards.length;
  const isEmpty = count === 0;
  const previewTarget =
    showTopCardFace && topCard && !isEmpty ? topCard : null;
  const hoverAnchorRef = useRef<View>(null);
  const { hoverProps, handlePress: handlePreviewPress } = useSidebarPreview(
    previewTarget,
    hoverAnchorRef,
    {
      enabled: hoverPreview && !!previewTarget,
      onPreview,
    }
  );

  if (sidebarStack) {
    const faceOnly = showTopCardFace && !isEmpty;
    const handlePress = () => {
      if (onPreview && previewTarget) {
        handlePreviewPress();
        return;
      }
      onPress?.();
    };
    return (
      <Pressable
        ref={hoverAnchorRef}
        {...hoverProps}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.sidebarStack,
          useCardBack && styles.sidebarStackCardBack,
          faceOnly && styles.sidebarStackFaceCard,
          {
            width,
            height,
            backgroundColor: faceOnly
              ? 'transparent'
              : useCardBack
                ? 'rgba(0,0,0,0.25)'
                : isEmpty
                  ? '#1a1a2e'
                  : bgColor,
          },
          pressed && (onPress || onPreview) && styles.pressed,
        ]}
      >
        {showTopCardFace && topCard && !isEmpty ? (
          <CardFace
            definition={
              topCard.definition ?? getCardDefinition(topCard.definitionId)
            }
            faceUp
            width={width}
            height={height}
            chosenFaction={topCard.chosenFaction}
          />
        ) : useCardBack ? (
          <View style={{ width, height }}>
            <Image
              source={cardBackImage}
              style={{ width, height }}
              resizeMode="contain"
            />
            {cardBackOverlay && (
              <View style={[styles.cardBackOverlay, { width, height }]} />
            )}
          </View>
        ) : (
          <Text style={styles.sidebarIcon}>{icon ?? '⚔'}</Text>
        )}
        {showCount && (
          <View style={styles.sidebarCountBadge}>
            <Text style={styles.sidebarCountText}>{count}</Text>
          </View>
        )}
        {!faceOnly && label ? (
          <Text style={[styles.sidebarLabel, useCardBack && styles.sidebarLabelOnBack]}>
            {label}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  if (supplyPile) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.supplyContainer,
          pressed && onPress && styles.pressed,
        ]}
      >
        <View style={styles.supplyPileWrap}>
          {[0, 1, 2].map((i) => {
            const w = 52 - i * 4;
            const h = 36 - i * 3;
            return (
              <View
                key={i}
                style={[
                  styles.supplyLayer,
                  {
                    width: w,
                    height: h,
                    left: (56 - w) / 2,
                    backgroundColor: isEmpty ? '#1a1a2e' : bgColor,
                    bottom: i * 6,
                    opacity: isEmpty ? 0.4 : 0.5 + (2 - i) * 0.2,
                    borderColor: isEmpty ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)',
                  },
                ]}
              />
            );
          })}
        </View>
        <Text style={styles.supplyIcon}>{icon ?? '📦'}</Text>
        {showCount && (
          <View style={styles.supplyCountBadge}>
            <Text style={styles.supplyCountText}>{count}</Text>
          </View>
        )}
        <Text style={styles.supplyLabel}>{label}</Text>
      </Pressable>
    );
  }

  const stackLayers = Math.min(count, 4);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && onPress && styles.pressed,
      ]}
    >
      <View style={[styles.stackWrapper, { width: width + 8, height: height + 10 }]}>
        {!isEmpty &&
          Array.from({ length: stackLayers }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.stackLayer,
                {
                  width,
                  height,
                  backgroundColor: bgColor,
                  bottom: (stackLayers - i) * 2,
                  left: (stackLayers - i) * 1,
                  opacity: 0.3 + i * 0.15,
                },
              ]}
            />
          ))}

        <View
          style={[
            styles.topCard,
            {
              width,
              height,
              backgroundColor: isEmpty ? '#1a1a2e' : bgColor,
            },
            isEmpty && styles.emptyStack,
          ]}
        >
          {icon && <Text style={styles.iconText}>{icon}</Text>}

          {showCount && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          )}

          <Text style={styles.labelText}>{label}</Text>

          {topCard && !isEmpty && (
            <Text style={styles.topCardName} numberOfLines={1}>
              {topCard.faceUp ? topCard.definition.name : '???'}
            </Text>
          )}

          {isEmpty && <Text style={styles.emptyLabel}>Empty</Text>}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  stackWrapper: {
    position: 'relative',
  },
  stackLayer: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  topCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  emptyStack: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iconText: {
    fontSize: 20,
    marginBottom: 2,
  },
  countBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  countText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  labelText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  topCardName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyLabel: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 9,
    marginTop: 2,
  },
  // Supply pile (Favor / Disfavor)
  supplyContainer: {
    alignItems: 'center',
  },
  supplyPileWrap: {
    position: 'relative',
    width: 56,
    height: 50,
  },
  supplyLayer: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: 1.5,
  },
  supplyIcon: {
    fontSize: 22,
    marginTop: 4,
  },
  supplyCountBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    minWidth: 24,
    height: 22,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  supplyCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  supplyLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  sidebarStack: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  sidebarStackCardBack: {
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sidebarStackFaceCard: {
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardBackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
  },
  sidebarIcon: {
    fontSize: 22,
  },
  sidebarCountBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  sidebarLabel: {
    position: 'absolute',
    bottom: 3,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 7,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sidebarLabelOnBack: {
    color: '#F5E6C8',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

export default CardStack;
