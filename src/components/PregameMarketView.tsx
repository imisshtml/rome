import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { PlayerState } from '../types/gameTypes';
import { turnButtonBg } from '../assets/images';
import { landscapeCardWidth } from '../utils/cardDisplayUtils';
import Card from './Card';
import GalleryCard from './GalleryCard';

const TURN_BUTTON_ASPECT = 448 / 132;

interface PregameMarketViewProps {
  width: number;
  height: number;
  galleryCards: CardInstance[];
  epicCards: CardInstance[];
  arenaCard: CardInstance | null;
  players: PlayerState[];
  readyPlayerIds: string[];
  readyCount: number;
  totalPlayers: number;
  isLocalReady: boolean;
  onCardPress: (card: CardInstance) => void;
  onStartGame: () => void;
}

function computePregameSizes(width: number, height: number) {
  const padX = 12;
  const headerH = 36;
  const footerH = 96;
  const gap = 10;
  const contentH = height - headerH - footerH - gap * 2;
  const rowH = Math.floor((contentH - gap) / 2);

  const galleryGap = Math.max(6, Math.floor(width * 0.012));
  const galleryCount = 6;
  const galleryCardSize = Math.min(
    Math.floor((width - padX * 2 - galleryGap * (galleryCount - 1)) / galleryCount),
    Math.floor(rowH * 0.96)
  );

  const arenaH = Math.floor(rowH * 0.92);
  const arenaW = landscapeCardWidth(arenaH);
  const epicCount = 3;
  const epicGap = galleryGap;
  const epicSize = Math.min(
    Math.floor(
      (width - padX * 2 - arenaW - epicGap * (epicCount + 1)) / epicCount
    ),
    arenaH
  );

  const buttonW = Math.min(width - padX * 2, 220);
  const buttonH = Math.round(buttonW / TURN_BUTTON_ASPECT);

  return {
    galleryCardSize,
    galleryGap,
    arenaW,
    arenaH,
    epicSize,
    epicGap,
    buttonW,
    buttonH,
  };
}

export const PregameMarketView: React.FC<PregameMarketViewProps> = ({
  width,
  height,
  galleryCards,
  epicCards,
  arenaCard,
  players,
  readyPlayerIds,
  readyCount,
  totalPlayers,
  isLocalReady,
  onCardPress,
  onStartGame,
}) => {
  const sizes = useMemo(
    () => computePregameSizes(width, height),
    [width, height]
  );
  const canPressStart = !isLocalReady;
  const buttonLabel = isLocalReady ? 'Waiting for others…' : 'Start Game';

  return (
    <View style={[styles.root, { width, height }]}>
      <Text style={styles.title}>Review the Market</Text>
      <Text style={styles.subtitle}>
        Market, epics, and the arena challenge for this game
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.galleryRow, { gap: sizes.galleryGap }]}>
          {galleryCards.map((card) => (
            <GalleryCard
              key={card.instanceId}
              card={card}
              size={sizes.galleryCardSize}
              onPress={onCardPress}
              onLongPress={onCardPress}
            />
          ))}
        </View>

        <View style={[styles.bottomRow, { gap: sizes.epicGap, marginTop: sizes.epicGap }]}>
          {arenaCard ? (
            <Card
              card={arenaCard}
              width={sizes.arenaW}
              height={sizes.arenaH}
              sizeMode="landscape"
              onPress={onCardPress}
              onLongPress={onCardPress}
              hoverPreview
            />
          ) : (
            <Text style={styles.emptyArena}>No arena challenge</Text>
          )}

          {epicCards.map((card) => (
            <GalleryCard
              key={card.instanceId}
              card={card}
              size={sizes.epicSize}
              onPress={onCardPress}
              onLongPress={onCardPress}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.readyList}>
          {players.map((p) => (
            <Text key={p.id} style={styles.readyPlayer}>
              {readyPlayerIds.includes(p.id) ? '✓' : '○'} {p.name}
            </Text>
          ))}
        </View>
        <Text style={styles.readyCount}>
          {readyCount}/{totalPlayers} ready
        </Text>

        <Pressable
          onPress={onStartGame}
          disabled={!canPressStart}
          style={({ pressed }) => [
            styles.buttonWrap,
            !canPressStart && styles.buttonDisabled,
            pressed && canPressStart && styles.buttonPressed,
          ]}
        >
          <ImageBackground
            source={turnButtonBg}
            style={[styles.buttonBg, { width: sizes.buttonW, height: sizes.buttonH }]}
            imageStyle={styles.buttonBgImage}
            resizeMode="contain"
          >
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </ImageBackground>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    color: '#F1C40F',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  galleryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  emptyArena: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontStyle: 'italic',
    alignSelf: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  readyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  readyPlayer: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
  },
  readyCount: {
    color: 'rgba(241,196,15,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonWrap: {
    alignItems: 'center',
  },
  buttonBg: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonBgImage: {
    borderRadius: 6,
    resizeMode: 'contain',
  },
  buttonText: {
    color: '#F5E6C8',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

export default PregameMarketView;
