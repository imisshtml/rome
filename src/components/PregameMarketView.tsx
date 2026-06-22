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
import {
  CARD_PORTRAIT_RATIO,
  CARD_LANDSCAPE_RATIO,
  landscapeCardWidth,
} from '../utils/cardDisplayUtils';
import Card from './Card';
import GalleryCard from './GalleryCard';
import GallerySectionHeader, {
  GALLERY_BOTTOM_COLUMN_FLEX,
} from './GallerySectionHeader';
import TutorialTarget from './TutorialTarget';
import { useTutorialOptional } from '../context/TutorialContext';

const TURN_BUTTON_ASPECT = 448 / 132;
/** Slightly shrink gallery/epics from max fit (arena unchanged). */
const MARKET_CARD_SCALE = 0.9;

const TITLE_BLOCK_H = 52;
const FOOTER_H = 110;
const ROOT_H_PAD = 18;
const ROOT_W_PAD = 10;
const SECTION_LABEL_H = 20;
const BOTTOM_COLUMN_FLEX = GALLERY_BOTTOM_COLUMN_FLEX;

interface PregameMarketViewProps {
  width: number;
  height: number;
  galleryCards: CardInstance[];
  epicCards: CardInstance[];
  arenaCard: CardInstance | null;
  recruitCard?: CardInstance | null;
  players: PlayerState[];
  readyPlayerIds: string[];
  readyCount: number;
  totalPlayers: number;
  isLocalReady: boolean;
  onCardPress: (card: CardInstance) => void;
  onStartGame: () => void;
}

/** Max portrait card height if `count` cards share a row width (2.5×3.5 aspect). */
function maxPortraitHeightInRow(
  rowWidth: number,
  count: number,
  gap: number,
  horizontalPad: number
): number {
  if (count <= 0) return 0;
  const usableW = rowWidth - horizontalPad * 2 - gap * Math.max(0, count - 1);
  if (usableW <= 0) return 0;
  return Math.floor((usableW / count) * CARD_PORTRAIT_RATIO);
}

function computePregameSizes(width: number, height: number) {
  const scrollH = Math.max(
    140,
    height - TITLE_BLOCK_H - FOOTER_H - ROOT_H_PAD
  );
  const rowGap = 8;
  const labelReserve = SECTION_LABEL_H + 4;
  const galleryRowH = Math.floor((scrollH - rowGap - labelReserve) * 0.48);
  const bottomRowH = scrollH - galleryRowH - rowGap - labelReserve;

  const galleryGap = 6;
  const galleryCount = 6;
  const galleryMaxByWidth = maxPortraitHeightInRow(
    width,
    galleryCount,
    galleryGap,
    ROOT_W_PAD
  );
  const galleryCardSize = Math.floor(
    Math.min(galleryMaxByWidth, galleryRowH) * MARKET_CARD_SCALE
  );

  const epicCount = 3;
  const columnGap = galleryGap;
  const bottomRowW = width - ROOT_W_PAD * 2;
  const totalFlex =
    BOTTOM_COLUMN_FLEX.recruit +
    BOTTOM_COLUMN_FLEX.arena +
    BOTTOM_COLUMN_FLEX.epics;
  const columnsUsableW = bottomRowW - columnGap * 2;
  const recruitColW =
    columnsUsableW * (BOTTOM_COLUMN_FLEX.recruit / totalFlex);
  const arenaColW = columnsUsableW * (BOTTOM_COLUMN_FLEX.arena / totalFlex);
  const epicsColW = columnsUsableW * (BOTTOM_COLUMN_FLEX.epics / totalFlex);

  const cardAreaH = bottomRowH - SECTION_LABEL_H - 4;
  const epicMaxByCol = maxPortraitHeightInRow(epicsColW, epicCount, columnGap, 0);
  const recruitMaxByCol = maxPortraitHeightInRow(recruitColW, 1, 0, 0);
  const arenaMaxHByCol = Math.floor(arenaColW / CARD_LANDSCAPE_RATIO);

  const epicSize = Math.floor(
    Math.min(
      epicMaxByCol,
      recruitMaxByCol,
      arenaMaxHByCol,
      cardAreaH * 0.95
    ) * MARKET_CARD_SCALE
  );
  const arenaH = epicSize;
  const arenaW = landscapeCardWidth(arenaH);

  const buttonW = Math.min(width - ROOT_W_PAD * 2, 220);
  const buttonH = Math.round(buttonW / TURN_BUTTON_ASPECT);

  return {
    galleryCardSize,
    galleryGap,
    galleryRowH,
    bottomRowH,
    arenaW,
    arenaH,
    epicSize,
    epicGap: columnGap,
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
  recruitCard,
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
  const tutorial = useTutorialOptional();
  const canPressStart = !isLocalReady;
  const buttonLabel = isLocalReady ? 'Waiting for others…' : 'Start Game';

  const handleStartPress = () => {
    if (tutorial?.isTargetClickRequired('tutorial_start_game')) {
      tutorial.notifyTargetClicked('tutorial_start_game');
    }
    onStartGame();
  };

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
        <View style={styles.marketSection}>
          <TutorialTarget targetKey="tutorial_market">
            <View
              style={[
                styles.galleryRow,
                { gap: sizes.galleryGap, minHeight: sizes.galleryRowH },
              ]}
            >
              {galleryCards.map((card) => (
                <GalleryCard
                  key={card.instanceId}
                  card={card}
                  height={sizes.galleryCardSize}
                  onPress={onCardPress}
                  onLongPress={onCardPress}
                />
              ))}
            </View>
          </TutorialTarget>
          <GallerySectionHeader label="Market" />
        </View>

        <View
          style={[
            styles.bottomRow,
            {
              gap: sizes.epicGap,
              marginTop: sizes.epicGap,
              minHeight: sizes.bottomRowH,
            },
          ]}
        >
          <View style={[styles.bottomSubColumn, styles.recruitSubColumn]}>
            <TutorialTarget targetKey="tutorial_recruits">
              {recruitCard ? (
                <GalleryCard
                  card={recruitCard}
                  height={sizes.epicSize}
                  onPress={onCardPress}
                  onLongPress={onCardPress}
                />
              ) : (
                <Text style={styles.emptyArena}>—</Text>
              )}
            </TutorialTarget>
            <GallerySectionHeader label="Recruits" size="expanded" />
          </View>

          <View style={[styles.bottomSubColumn, styles.arenaSubColumn]}>
            <TutorialTarget targetKey="tutorial_arena">
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
            </TutorialTarget>
            <GallerySectionHeader label="Arena" size="expanded" />
          </View>

          <View style={[styles.bottomSubColumn, styles.epicsSubColumn]}>
            <TutorialTarget targetKey="tutorial_epics">
              <View style={[styles.galleryRow, { gap: sizes.epicGap }]}>
                {epicCards.map((card) => (
                  <GalleryCard
                    key={card.instanceId}
                    card={card}
                    height={sizes.epicSize}
                    onPress={onCardPress}
                    onLongPress={onCardPress}
                  />
                ))}
              </View>
            </TutorialTarget>
            <GallerySectionHeader label="Epics" size="wide" />
          </View>
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

        <TutorialTarget targetKey="tutorial_start_game">
          <Pressable
            onPress={handleStartPress}
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
        </TutorialTarget>
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
    paddingHorizontal: ROOT_W_PAD,
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
    width: '100%',
  },
  marketSection: {
    width: '100%',
    gap: 4,
    marginBottom: 4,
  },
  galleryRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  bottomSubColumn: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    gap: 4,
  },
  recruitSubColumn: {
    flex: BOTTOM_COLUMN_FLEX.recruit,
  },
  arenaSubColumn: {
    flex: BOTTOM_COLUMN_FLEX.arena,
  },
  epicsSubColumn: {
    flex: BOTTOM_COLUMN_FLEX.epics,
    overflow: 'visible',
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
