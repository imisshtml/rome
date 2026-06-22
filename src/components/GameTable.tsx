import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutRectangle,
  Platform,
} from 'react-native';
import { createPortal } from 'react-dom';
import Animated, { FadeInRight } from 'react-native-reanimated';
import {
  useGameState,
  useDispatchAction,
  useDraggedCard,
  useHoveredZone,
  useHoverPreviewCard,
  useLocalPlayer,
  useIsLocalTurn,
} from '../store/useGameStore';
import { getArenaChallengeStats, getArenaChallengeTotalValor, getCurrentPlayer } from '../game/GameEngine';
import { getPlayerTotalVp } from '../game/postGame';
import { CardInstance, CardLocation } from '../types/cardTypes';
import { GameAction, PlayerState } from '../types/gameTypes';
import { mustEnterArenaBeforeEndTurn } from '../utils/arenaUtils';
import { canDropCard } from '../utils/dragHelpers';
import { useBoardLayout } from '../utils/boardLayout';
import Card from './Card';
import CardFace from './CardFace';
import DropZone from './DropZone';
import PlayerHand from './PlayerHand';
import OpponentStrip from './OpponentStrip';
import BoardSidebarLeft from './BoardSidebarLeft';
import BoardSidebarRight from './BoardSidebarRight';
import GalleryCard from './GalleryCard';
import GallerySectionHeader, {
  GALLERY_BOTTOM_COLUMN_FLEX,
} from './GallerySectionHeader';
import CardPreviewModal from './CardPreviewModal';
import DiscardModal from './DiscardModal';
import ArenaChallengeModal, { ArenaModalStep } from './ArenaChallengeModal';
import FactionChoiceModal from './FactionChoiceModal';
import BandingBonusModal from './BandingBonusModal';
import ForcedOpponentDiscardModal from './ForcedOpponentDiscardModal';
import GalleryEventModal from './GalleryEventModal';
import PregameMarketView from './PregameMarketView';
import { getValorInPlay } from '../utils/combatStatsUtils';
import { requiresFactionChoiceOnPlay, isCharityCard } from '../utils/cardFactionUtils';
import { Faction } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { FullBleedBackground } from './FullBleedBackground';
import { gameBackground } from '../assets/images';

const ZONE_LAYOUTS = new Map<string, LayoutRectangle>();
const MARKET_LOCATIONS: CardLocation[] = ['GALLERY', 'EPIC_ROW', 'RECRUIT'];
const DOUBLE_TAP_MS = 400;

function isBuyableMarketCard(
  card: CardInstance | null,
  galleryPurchasedBy?: Record<string, string>
): boolean {
  if (card == null || !MARKET_LOCATIONS.includes(card.location)) return false;
  if (card.location === 'GALLERY' && galleryPurchasedBy?.[card.instanceId]) {
    return false;
  }
  return true;
}

const ZONE_TYPE_BY_ID: Record<string, CardLocation> = {
  play_area: 'PLAY_AREA',
  discard: 'DISCARD',
};

export const GameTable: React.FC = () => {
  const state = useGameState();
  const dispatch = useDispatchAction();
  const [draggedCard, setDraggedCard] = useDraggedCard();
  const [, setHoveredZone] = useHoveredZone();
  const [hoverPreviewCard] = useHoverPreviewCard();
  const isPregame = state.phase === 'PREGAME' && state.status === 'active';
  const layout = useBoardLayout(!isPregame);
  const [previewCard, setPreviewCard] = useState<CardInstance | null>(null);
  const [discardPlayer, setDiscardPlayer] = useState<PlayerState | null>(null);
  const [arenaModalOpen, setArenaModalOpen] = useState(false);
  const [arenaModalStep, setArenaModalStep] = useState<ArenaModalStep>('prompt');
  const [factionChoiceCard, setFactionChoiceCard] = useState<CardInstance | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [tableScreenRect, setTableScreenRect] = useState({ x: 0, y: 0 });
  const tableRef = useRef<View>(null);
  const lastMarketTapRef = useRef<{ id: string; at: number } | null>(null);

  const measureTable = useCallback(() => {
    tableRef.current?.measureInWindow((x, y) => {
      setTableScreenRect({ x, y });
    });
  }, []);

  useEffect(() => {
    if (draggedCard) measureTable();
  }, [draggedCard, measureTable]);

  const localPlayer = useLocalPlayer();
  const opponents = state.players.filter((p) => p.id !== localPlayer?.id);
  const turnPlayer = getCurrentPlayer(state) ?? localPlayer;
  const isTurnPlayerLocal = turnPlayer?.id === localPlayer?.id;
  const isLocalTurn = useIsLocalTurn();
  const arenaStats = getArenaChallengeStats(state.arenaCard);

  const isMainActive = state.status === 'active' && state.phase === 'MAIN';
  const canInteract = isMainActive && isLocalTurn;
  const isLocalReady = localPlayer
    ? state.readyPlayerIds.includes(localPlayer.id)
    : false;
  const readyCount = state.readyPlayerIds.length;

  const valorInPlay =
    localPlayer && isMainActive && isLocalTurn
      ? getValorInPlay(localPlayer, state.turnValor)
      : localPlayer
        ? getValorInPlay(localPlayer)
        : 0;
  const canChallengeArena =
    canInteract && !!state.arenaCard && !state.arenaChallenge;
  const mandatoryArenaPending =
    !!localPlayer &&
    isLocalTurn &&
    isMainActive &&
    mustEnterArenaBeforeEndTurn(state, localPlayer.id);
  const mainPhaseButtonLabel = mandatoryArenaPending ? 'Enter Arena' : undefined;
  const pendingArenaResponse =
    state.arenaChallenge?.pendingResponsePlayerIds.includes(localPlayer?.id ?? '') ?? false;
  const arenaChallengeTotal = getArenaChallengeTotalValor(state);

  useEffect(() => {
    if (pendingArenaResponse) {
      setArenaModalOpen(true);
      setArenaModalStep('respond');
    }
  }, [pendingArenaResponse]);

  useEffect(() => {
    if (state.lastArenaResult && !state.arenaChallenge) {
      setArenaModalOpen(true);
      setArenaModalStep('result');
    }
  }, [state.lastArenaResult, state.arenaChallenge]);

  useEffect(() => {
    if (state.arenaChallenge && !pendingArenaResponse && arenaModalStep !== 'result') {
      setArenaModalStep('waiting');
      if (localPlayer?.id === state.arenaChallenge.challengerId) {
        setArenaModalOpen(true);
      }
    }
  }, [state.arenaChallenge, pendingArenaResponse, arenaModalStep, localPlayer?.id]);

  const coinsInPlay = isMainActive && isLocalTurn ? state.turnCoins : 0;
  const victoryPoints = localPlayer ? getPlayerTotalVp(localPlayer) : 0;

  const dispatchAction = useCallback(
    (type: GameAction['type'], payload?: GameAction['payload']) => {
      if (!localPlayer) return;
      dispatch({
        type,
        playerId: localPlayer.id,
        payload,
        timestamp: Date.now(),
      });
    },
    [dispatch, localPlayer]
  );

  const playCard = useCallback(
    (card: CardInstance, chosenFaction?: Faction) => {
      if (!canInteract) return;
      if (requiresFactionChoiceOnPlay(card.definition) && !chosenFaction) {
        setFactionChoiceCard(card);
        return;
      }
      dispatchAction('PLAY_CARD', {
        cardInstanceId: card.instanceId,
        chosenFaction,
      });
    },
    [canInteract, dispatchAction]
  );

  const handleFactionChoice = useCallback(
    (faction: Faction) => {
      if (!factionChoiceCard) return;
      playCard(factionChoiceCard, faction);
      setFactionChoiceCard(null);
    },
    [factionChoiceCard, playCard]
  );

  const handleCancelFactionChoice = useCallback(() => {
    setFactionChoiceCard(null);
  }, []);

  const handleDeclineBanding = useCallback(() => {
    dispatchAction('DECLINE_BANDING_BONUS');
  }, [dispatchAction]);

  const handleAcceptBanding = useCallback(() => {
    dispatchAction('ACCEPT_BANDING_BONUS');
  }, [dispatchAction]);

  const handleResolveGalleryEvent = useCallback(() => {
    if (!localPlayer || !state.pendingGalleryEvent) return;
    if ((state.pendingEventDiscards?.length ?? 0) > 0) return;
    dispatchAction('RESOLVE_GALLERY_EVENT');
  }, [dispatchAction, localPlayer, state.pendingGalleryEvent, state.pendingEventDiscards]);

  const handleEventDiscardCard = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('EVENT_DISCARD_CARD', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const pendingBandingBonus =
    state.pendingBandingBonus?.playerId === localPlayer?.id
      ? state.pendingBandingBonus
      : null;

  const pendingHandDiscard =
    state.pendingHandDiscard?.playerId === localPlayer?.id
      ? state.pendingHandDiscard
      : null;

  const pendingForcedDiscard =
    state.pendingForcedOpponentDiscards?.controllerId === localPlayer?.id
      ? state.pendingForcedOpponentDiscards
      : null;

  const forcedDiscardTarget = pendingForcedDiscard
    ? state.players.find((p) => p.id === pendingForcedDiscard.targetPlayerId) ?? null
    : null;

  const charityInHand = (localPlayer?.hand ?? []).filter(isCharityCard);
  const canPlayAllCharity =
    canInteract &&
    !pendingBandingBonus &&
    !pendingHandDiscard &&
    !pendingForcedDiscard &&
    charityInHand.length > 1;

  const handlePlayAllCharity = useCallback(async () => {
    if (!localPlayer || !canPlayAllCharity) return;

    for (const card of charityInHand) {
      await dispatch({
        type: 'PLAY_CARD',
        playerId: localPlayer.id,
        payload: { cardInstanceId: card.instanceId },
        timestamp: Date.now(),
      });
    }
  }, [localPlayer, canPlayAllCharity, charityInHand, dispatch]);

  const handleEndPhase = useCallback(() => {
    if (!canInteract) return;
    if (mandatoryArenaPending) {
      setArenaModalStep('prompt');
      setArenaModalOpen(true);
      return;
    }
    dispatchAction('END_PHASE');
  }, [dispatchAction, canInteract, mandatoryArenaPending]);

  const handlePlayerReady = useCallback(() => {
    if (!localPlayer || !isPregame || isLocalReady) return;
    dispatchAction('PLAYER_READY');
  }, [dispatchAction, isPregame, isLocalReady, localPlayer]);

  const handleForcedOpponentDiscard = useCallback(
    (card: CardInstance) => {
      if (!localPlayer || !pendingForcedDiscard) return;
      dispatchAction('FORCE_OPPONENT_DISCARD', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer, pendingForcedDiscard]
  );

  const handleHandCardPress = useCallback(
    (card: CardInstance) => {
      if (pendingHandDiscard && pendingHandDiscard.remaining > 0) {
        dispatchAction('DISCARD_CARD', { cardInstanceId: card.instanceId });
        return;
      }
      setPreviewCard(card);
    },
    [dispatchAction, pendingHandDiscard]
  );

  const handleCardPreview = useCallback((card: CardInstance) => {
    setPreviewCard(card);
  }, []);

  const handlePlayAreaCardPress = useCallback(
    (card: CardInstance) => {
      setPreviewCard(card);
    },
    []
  );

  const handleArenaPress = useCallback(() => {
    if (!canChallengeArena) {
      if (state.arenaCard) setPreviewCard(state.arenaCard);
      return;
    }
    setArenaModalStep('prompt');
    setArenaModalOpen(true);
  }, [canChallengeArena, state.arenaCard]);

  const handleArenaDecline = useCallback(() => {
    if (mandatoryArenaPending) {
      dispatchAction('DECLINE_ARENA');
    }
    setArenaModalOpen(false);
    setArenaModalStep('prompt');
  }, [mandatoryArenaPending, dispatchAction]);

  const handleArenaEnter = useCallback(() => {
    setArenaModalStep('select');
  }, []);

  const handleConfirmArenaFighters = useCallback(
    (cardInstanceIds: string[]) => {
      dispatchAction('CONFIRM_ARENA_FIGHTERS', { cardInstanceIds });
      setArenaModalStep('waiting');
    },
    [dispatchAction]
  );

  const handleArenaRespond = useCallback(
    (responseType: 'support' | 'hinder' | 'pass', cardInstanceId?: string) => {
      if (!localPlayer) return;
      dispatch({
        type: 'ARENA_RESPOND',
        playerId: localPlayer.id,
        payload: { responseType, cardInstanceId },
        timestamp: Date.now(),
      });
      if (responseType === 'pass' || cardInstanceId) {
        setArenaModalStep('waiting');
      }
    },
    [dispatch, localPlayer]
  );

  const handleCloseArenaModal = useCallback(() => {
    setArenaModalOpen(false);
    setArenaModalStep('prompt');
  }, []);

  const handleBuyCard = useCallback(
    (card: CardInstance) => {
      if (!canInteract) return;
      dispatchAction('BUY_CARD', { cardInstanceId: card.instanceId });
    },
    [canInteract, dispatchAction]
  );

  const handleMarketCardPress = useCallback(
    (card: CardInstance) => {
      const now = Date.now();
      const last = lastMarketTapRef.current;
      if (
        canInteract &&
        last?.id === card.instanceId &&
        now - last.at <= DOUBLE_TAP_MS
      ) {
        lastMarketTapRef.current = null;
        handleBuyCard(card);
        setPreviewCard(null);
        return;
      }
      lastMarketTapRef.current = { id: card.instanceId, at: now };
      setPreviewCard(card);
    },
    [canInteract, handleBuyCard]
  );

  const handlePreviewPurchase = useCallback(() => {
    if (!previewCard || !isBuyableMarketCard(previewCard, state.galleryPurchasedBy)) return;
    handleBuyCard(previewCard);
    setPreviewCard(null);
  }, [previewCard, handleBuyCard]);

  const previewPurchaseBlockedReason = (() => {
    if (!previewCard || !isBuyableMarketCard(previewCard, state.galleryPurchasedBy)) return undefined;
    if (!canInteract) return 'Not your turn';
    if (pendingBandingBonus) return 'Resolve banding bonus first';
    if (pendingHandDiscard) {
      return `Discard ${pendingHandDiscard.remaining} card(s) from hand`;
    }
    if (pendingForcedDiscard) {
      return 'Choose a card for your opponent to discard';
    }
    const cost = previewCard.definition?.cost ?? 0;
    if (state.turnCoins < cost) {
      return `Need ${cost} coins (${state.turnCoins} available)`;
    }
    return undefined;
  })();

  const previewCanPurchase =
    !!previewCard &&
    isBuyableMarketCard(previewCard, state.galleryPurchasedBy) &&
    canInteract &&
    !pendingBandingBonus &&
    !pendingHandDiscard &&
    !pendingForcedDiscard &&
    state.turnCoins >= (previewCard.definition?.cost ?? 0);

  const handleLogCardPreview = useCallback((card: CardInstance) => {
    setPreviewCard(card);
  }, []);

  const opponentHighlight =
    state.turnActionHighlight &&
    state.turnActionHighlight.playerId !== localPlayer?.id
      ? state.turnActionHighlight
      : null;

  const handleZoneLayout = useCallback(
    (zoneId: string) => (rect: LayoutRectangle) => {
      ZONE_LAYOUTS.set(zoneId, rect);
    },
    []
  );

  const findZoneAtPosition = useCallback(
    (x: number, y: number, card?: CardInstance | null): string | null => {
      const matches: { zoneId: string; area: number; targetZone: CardLocation }[] = [];

      for (const [zoneId, rect] of ZONE_LAYOUTS.entries()) {
        if (
          x >= rect.x &&
          x <= rect.x + rect.width &&
          y >= rect.y &&
          y <= rect.y + rect.height
        ) {
          const targetZone = ZONE_TYPE_BY_ID[zoneId];
          if (!targetZone) continue;
          matches.push({
            zoneId,
            area: rect.width * rect.height,
            targetZone,
          });
        }
      }

      if (matches.length === 0) return null;

      if (card) {
        const accepting = matches.filter((m) =>
          canDropCard(card, card.location, m.targetZone)
        );
        if (accepting.length > 0) {
          accepting.sort((a, b) => a.area - b.area);
          return accepting[0].zoneId;
        }
      }

      matches.sort((a, b) => a.area - b.area);
      return matches[0].zoneId;
    },
    []
  );

  const handleDragUpdate = useCallback(
    (x: number, y: number) => {
      setDragPosition({ x, y });
      setHoveredZone(findZoneAtPosition(x, y, draggedCard));
    },
    [draggedCard, findZoneAtPosition, setHoveredZone]
  );

  const handleDragEnd = useCallback(
    (card: CardInstance, x: number, y: number) => {
      setDragPosition(null);
      if (!canInteract) return;
      const zoneId = findZoneAtPosition(x, y, card);
      setHoveredZone(null);
      if (!zoneId) return;

      const targetZone = ZONE_TYPE_BY_ID[zoneId];
      if (!targetZone) return;
      if (!canDropCard(card, card.location, targetZone)) return;

      if (targetZone === 'PLAY_AREA') {
        playCard(card);
      } else if (targetZone === 'DISCARD') {
        dispatchAction('DISCARD_CARD', { cardInstanceId: card.instanceId });
      }
    },
    [canInteract, dispatchAction, findZoneAtPosition, playCard, setHoveredZone]
  );

  const handleOpponentPress = useCallback((player: PlayerState) => {
    setDiscardPlayer(player);
  }, []);

  const handleLocalDiscardPress = useCallback(() => {
    if (localPlayer) setDiscardPlayer(localPlayer);
  }, [localPlayer]);

  const overlayCardW = layout.handCardW;
  const overlayCardH = layout.handCardH;
  const overlayLeft = dragPosition
    ? dragPosition.x - tableScreenRect.x - overlayCardW / 2
    : 0;
  const overlayTop = dragPosition
    ? dragPosition.y - tableScreenRect.y - overlayCardH / 2
    : 0;

  const dragGhostFace = draggedCard ? (
    <CardFace
      definition={
        draggedCard.definition ?? getCardDefinition(draggedCard.definitionId)
      }
      faceUp={draggedCard.faceUp}
      width={overlayCardW}
      height={overlayCardH}
      chosenFaction={draggedCard.chosenFaction}
    />
  ) : null;

  const portalOverlay =
    Platform.OS === 'web' &&
    typeof document !== 'undefined' &&
    draggedCard &&
    dragPosition &&
    createPortal(
      <View style={styles.dragOverlayPortalWrap} pointerEvents="none">
        <View
          style={[
            styles.dragOverlayPortal,
            {
              left: dragPosition.x - overlayCardW / 2,
              top: dragPosition.y - overlayCardH / 2,
            },
          ]}
        >
          <View style={styles.dragOverlayCardShadow}>
            {dragGhostFace}
          </View>
        </View>
      </View>,
      document.body
    );

  return (
    <FullBleedBackground
      source={gameBackground}
      style={styles.table}
      overlayColor="rgba(8, 8, 18, 0.62)"
    >
      <View ref={tableRef} style={styles.tableForeground} onLayout={measureTable}>
      {/* Opponents bar */}
      <View style={[styles.opponentsBar, { height: layout.opponentsBarH }]}>
        {opponents.length > 0 ? (
          <OpponentStrip
            opponents={opponents}
            turnPlayerId={state.turnPlayerId}
            turnCoins={state.turnCoins}
            turnValor={state.turnValor}
            barHeight={layout.opponentsBarH}
            onPressOpponent={handleOpponentPress}
          />
        ) : (
          <Text style={styles.opponentsPlaceholder}>Opponents</Text>
        )}
      </View>

      {/* Main board: sidebars span gallery + play + hand */}
      <View style={[styles.mainRow, { height: layout.mainContentH }]}>
        <BoardSidebarLeft
          width={layout.sidebarW}
          stackW={layout.stackW}
          stackH={layout.stackH}
          stackGap={layout.stackGap}
          galleryDeck={state.gallerySupply ?? []}
          flavorDeck={state.flavorDeck}
          disfavorDeck={state.disfavorDeck}
          playerDeck={localPlayer?.deck ?? []}
          playerDiscard={localPlayer?.discard ?? []}
          onDiscardPress={handleLocalDiscardPress}
          onDiscardLayout={handleZoneLayout('discard')}
        />

        <View style={[styles.centerColumn, { width: layout.centerW }]}>
          {isPregame ? (
            <PregameMarketView
              width={layout.centerW}
              height={layout.mainContentH}
              galleryCards={state.galleryCards}
              epicCards={state.epicCards}
              arenaCard={state.arenaCard}
              recruitCard={state.recruitCard}
              players={state.players}
              readyPlayerIds={state.readyPlayerIds}
              readyCount={readyCount}
              totalPlayers={state.players.length}
              isLocalReady={isLocalReady}
              onCardPress={handleCardPreview}
              onStartGame={handlePlayerReady}
            />
          ) : (
            <>
          {/* Gallery zone — fixed height ratio */}
          <View style={[styles.galleryZone, { height: layout.galleryH }]}>
            <DropZone
              id="gallery"
              zoneType="GALLERY"
              label=""
              onLayout={handleZoneLayout('gallery')}
              activePhase={isMainActive}
              contentColumn
              contentCenter
              style={styles.galleryDrop}
            >
              <View style={styles.galleryContent}>
                <View style={styles.galleryMarketSection}>
                  <View style={[styles.galleryRow, { gap: layout.galleryCardGap }]}>
                    {state.galleryCards.map((card) => (
                      <GalleryCard
                        key={card.instanceId}
                        card={card}
                        size={layout.galleryCardSize}
                        purchased={!!state.galleryPurchasedBy?.[card.instanceId]}
                        onPress={handleMarketCardPress}
                        onLongPress={(c) => isMainActive && handleBuyCard(c)}
                        disabled={!isMainActive}
                      />
                    ))}
                  </View>
                  <GallerySectionHeader label="Market" />
                </View>

                <View style={[styles.gallerySubRow, { gap: layout.galleryCardGap }]}>
                  <View
                    style={[
                      styles.gallerySubColumn,
                      { flex: GALLERY_BOTTOM_COLUMN_FLEX.recruit },
                    ]}
                  >
                    <View style={[styles.galleryRow, { gap: layout.galleryCardGap }]}>
                      {state.recruitCard ? (
                        <GalleryCard
                          key={state.recruitCard.instanceId}
                          card={state.recruitCard}
                          size={layout.galleryCardSize}
                          onPress={handleMarketCardPress}
                          onLongPress={(c) => isMainActive && handleBuyCard(c)}
                          disabled={!isMainActive}
                        />
                      ) : (
                        <Text style={styles.emptyText}>—</Text>
                      )}
                    </View>
                    <GallerySectionHeader label="Recruits" size="expanded" />
                  </View>

                  <View
                    style={[
                      styles.gallerySubColumn,
                      { flex: GALLERY_BOTTOM_COLUMN_FLEX.arena },
                    ]}
                  >
                    <DropZone
                      id="arena_challenge"
                      zoneType="ARENA"
                      label=""
                      onLayout={handleZoneLayout('arena_challenge')}
                      showGlow={isMainActive || opponentHighlight?.kind === 'arena'}
                      highlight={opponentHighlight?.kind === 'arena'}
                      style={styles.arenaGallerySlot}
                      contentColumn
                      contentCenter
                    >
                      {state.arenaCard ? (
                        <Pressable onPress={handleArenaPress} disabled={!state.arenaCard}>
                          <Card
                            card={state.arenaCard}
                            width={layout.arenaCardW}
                            height={layout.arenaCardH}
                            sizeMode="landscape"
                            onPress={handleArenaPress}
                            onLongPress={handleCardPreview}
                          />
                        </Pressable>
                      ) : (
                        <Text style={styles.emptyText}>No Arena</Text>
                      )}
                    </DropZone>
                    <GallerySectionHeader label="Arena" size="expanded" />
                  </View>

                  <View
                    style={[
                      styles.gallerySubColumn,
                      { flex: GALLERY_BOTTOM_COLUMN_FLEX.epics },
                    ]}
                  >
                    <View style={[styles.galleryRow, { gap: layout.galleryCardGap }]}>
                      {state.epicCards.map((card) => (
                        <GalleryCard
                          key={card.instanceId}
                          card={card}
                          size={layout.galleryCardSize}
                          onPress={handleMarketCardPress}
                          onLongPress={(c) => isMainActive && handleBuyCard(c)}
                          disabled={!isMainActive}
                        />
                      ))}
                    </View>
                    <GallerySectionHeader label="Epics" size="wide" />
                  </View>
                </View>
              </View>
            </DropZone>
          </View>

          {/* Play field + hand */}
          <View style={[styles.bodyColumn, { flex: 1 }]}>
            <DropZone
              id="play_area"
              zoneType="PLAY_AREA"
              label=""
              onLayout={handleZoneLayout('play_area')}
              activePhase={isMainActive && isTurnPlayerLocal}
              highlight={isMainActive && isTurnPlayerLocal && !!draggedCard}
              contentColumn
              style={StyleSheet.flatten([styles.playField, { flex: 1 }])}
            >
              {state.arenaOpen && isMainActive && isTurnPlayerLocal ? (
                <Text style={styles.arenaOpenNote}>
                  The Arena is OPEN, playing ANY Faction or Epic requires you challenge the Arena
                </Text>
              ) : null}
              <View style={styles.playFieldCards}>
                {(turnPlayer?.playArea.length ?? 0) === 0 ? (
                  isMainActive ? (
                    <Text style={styles.playFieldEmptyText}>
                      {isTurnPlayerLocal
                        ? 'Drag cards here from your hand'
                        : `${turnPlayer?.name ?? 'Opponent'} is playing…`}
                    </Text>
                  ) : null
                ) : (
                  <View style={styles.playedCardsRow}>
                    {turnPlayer?.playArea.map((card) => (
                      <Animated.View
                        key={card.instanceId}
                        entering={FadeInRight.springify().damping(20).stiffness(280)}
                      >
                        <Card
                          card={card}
                          width={layout.handCardW}
                          height={layout.handCardH}
                          sizeMode="full"
                          draggable={isMainActive && isTurnPlayerLocal}
                          onPress={isTurnPlayerLocal ? handlePlayAreaCardPress : handleCardPreview}
                          onLongPress={handleCardPreview}
                          onDragEnd={handleDragEnd}
                        />
                      </Animated.View>
                    ))}
                  </View>
                )}
              </View>
            </DropZone>

            <View style={[styles.handZone, { height: layout.handZoneH }]}>
              {pendingHandDiscard && (
                <Text style={styles.handDiscardPrompt}>
                  Discard {pendingHandDiscard.remaining} card
                  {pendingHandDiscard.remaining === 1 ? '' : 's'} from hand
                  {pendingHandDiscard.sourceCardName
                    ? ` (${pendingHandDiscard.sourceCardName})`
                    : ''}
                </Text>
              )}
              <View style={styles.handArea}>
                <PlayerHand
                  cards={localPlayer?.hand ?? []}
                  cardWidth={layout.handCardW}
                  cardHeight={layout.handCardH}
                  canPlayAllCharity={canPlayAllCharity}
                  onPlayAllCharity={handlePlayAllCharity}
                  showBandingKey={isMainActive}
                  playArea={
                    isTurnPlayerLocal ? (localPlayer?.playArea ?? []) : []
                  }
                  claimedBandingFactions={
                    isTurnPlayerLocal ? (state.turnBandingClaimed ?? []) : []
                  }
                  onCardPress={handleHandCardPress}
                  onLongPress={handleCardPreview}
                  onDragStart={(card) => setDraggedCard(card)}
                  onDragEnd={handleDragEnd}
                  onDragUpdate={handleDragUpdate}
                />
              </View>
            </View>
          </View>
            </>
          )}
        </View>

        <BoardSidebarRight
          width={layout.sidebarW}
          actionLog={state.actionLog}
          players={state.players}
          hoverPreviewCard={hoverPreviewCard}
          isPregame={isPregame}
          coinsInPlay={coinsInPlay}
          valorInPlay={valorInPlay}
          victoryPoints={victoryPoints}
          phase={state.phase}
          isLocalTurn={isLocalTurn}
          isLocalReady={isLocalReady}
          readyCount={readyCount}
          totalPlayers={state.players.length}
          mainPhaseButtonLabel={mainPhaseButtonLabel}
          onEndPhase={handleEndPhase}
          onPlayerReady={handlePlayerReady}
          onPreviewLogCard={handleLogCardPreview}
        />
      </View>

      {draggedCard && dragPosition && (
        Platform.OS === 'web' && typeof document !== 'undefined'
          ? portalOverlay
          : (
            <View style={styles.dragOverlay} pointerEvents="none">
              <View
                style={[
                  styles.dragOverlayCard,
                  { left: overlayLeft, top: overlayTop },
                ]}
              >
                <View style={styles.dragOverlayCardShadow}>
                  {dragGhostFace}
                </View>
              </View>
            </View>
          )
      )}

      <CardPreviewModal
        card={previewCard}
        visible={previewCard !== null}
        onClose={() => setPreviewCard(null)}
        showPurchase={isBuyableMarketCard(previewCard, state.galleryPurchasedBy)}
        canPurchase={previewCanPurchase}
        purchaseBlockedReason={previewPurchaseBlockedReason}
        onPurchase={handlePreviewPurchase}
      />
      <DiscardModal
        player={discardPlayer}
        visible={discardPlayer !== null}
        onClose={() => setDiscardPlayer(null)}
        onCardPress={(card) => {
          setDiscardPlayer(null);
          setPreviewCard(card);
        }}
      />
      <FactionChoiceModal
        card={factionChoiceCard}
        visible={factionChoiceCard !== null}
        onChoose={handleFactionChoice}
        onCancel={handleCancelFactionChoice}
      />
      <BandingBonusModal
        pending={pendingBandingBonus}
        visible={pendingBandingBonus !== null}
        onAccept={handleAcceptBanding}
        onDecline={handleDeclineBanding}
      />
      <ForcedOpponentDiscardModal
        pending={pendingForcedDiscard}
        targetPlayer={forcedDiscardTarget}
        visible={pendingForcedDiscard !== null}
        onChoose={handleForcedOpponentDiscard}
      />
      <GalleryEventModal
        event={state.pendingGalleryEvent ?? null}
        visible={state.pendingGalleryEvent != null}
        pendingDiscardPlayerIds={state.pendingEventDiscards ?? []}
        localPlayerId={localPlayer?.id ?? ''}
        localHand={localPlayer?.hand ?? []}
        onResolve={handleResolveGalleryEvent}
        onDiscardCard={handleEventDiscardCard}
      />
      <ArenaChallengeModal
        visible={arenaModalOpen}
        step={arenaModalStep}
        onClose={handleCloseArenaModal}
        onDecline={handleArenaDecline}
        onEnterArena={handleArenaEnter}
        onConfirmFighters={handleConfirmArenaFighters}
        onRespond={handleArenaRespond}
        arenaCard={state.arenaCard}
        requiredValor={arenaStats.requiredValor}
        rewardVp={arenaStats.rewardVp}
        playArea={localPlayer?.playArea ?? []}
        hand={localPlayer?.hand ?? []}
        committedCards={state.arenaCommitZone}
        pendingResponders={state.arenaChallenge?.pendingResponsePlayerIds ?? []}
        players={state.players}
        localPlayerId={localPlayer?.id ?? ''}
        challengerId={state.arenaChallenge?.challengerId ?? localPlayer?.id ?? ''}
        totalValor={arenaChallengeTotal}
        lastResult={state.lastArenaResult ?? null}
        mandatory={mandatoryArenaPending}
      />
      </View>
    </FullBleedBackground>
  );
};

const styles = StyleSheet.create({
  table: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  tableForeground: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  opponentsBar: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.3)',
  },
  opponentsPlaceholder: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  galleryZone: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  galleryDrop: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 4,
    minHeight: 0,
  },
  galleryContent: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  galleryMarketSection: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
  },
  gallerySubRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  gallerySubColumn: {
    alignItems: 'center',
    minWidth: 0,
    gap: 4,
  },
  galleryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arenaGallerySlot: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
    minHeight: 0,
    minWidth: 0,
  },
  mainRow: {
    flexDirection: 'row',
    minHeight: 0,
    overflow: 'hidden',
    flexShrink: 0,
  },
  centerColumn: {
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  bodyColumn: {
    flexDirection: 'column',
    minHeight: 0,
    marginTop: 6,
    gap: 6,
  },
  playField: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 8,
    minHeight: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  arenaOpenNote: {
    color: 'rgba(241,196,15,0.9)',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 8,
    lineHeight: 14,
  },
  playFieldCards: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 0,
    width: '100%',
  },
  playFieldEmptyText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  playedCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handZone: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  handDiscardPrompt: {
    color: '#f1c40f',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  handArea: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    fontStyle: 'italic',
  },
  dragOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100000,
    elevation: 100000,
  },
  dragOverlayCard: {
    position: 'absolute',
    zIndex: 100001,
    elevation: 100001,
  },
  dragOverlayCardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
  dragOverlayPortalWrap: {
    position: 'fixed' as unknown as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2147483646,
    pointerEvents: 'none',
  },
  dragOverlayPortal: {
    position: 'absolute',
    zIndex: 2147483647,
  },
});

export default GameTable;
