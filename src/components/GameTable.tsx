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
import {
  useGameState,
  useDispatchAction,
  useArenaValor,
  useDraggedCard,
  useHoveredZone,
  useLocalPlayer,
  useIsLocalTurn,
} from '../store/useGameStore';
import { getArenaChallengeStats } from '../game/GameEngine';
import { CardInstance, CardLocation } from '../types/cardTypes';
import { GameAction, PlayerState } from '../types/gameTypes';
import { canDropCard } from '../utils/dragHelpers';
import { useBoardLayout } from '../utils/boardLayout';
import Card from './Card';
import DropZone from './DropZone';
import PlayerHand from './PlayerHand';
import OpponentStrip from './OpponentStrip';
import BoardSidebarLeft from './BoardSidebarLeft';
import BoardSidebarRight from './BoardSidebarRight';
import GalleryCard from './GalleryCard';
import CardPreviewModal from './CardPreviewModal';
import DiscardModal from './DiscardModal';

const ZONE_LAYOUTS = new Map<string, LayoutRectangle>();

const ZONE_TYPE_BY_ID: Record<string, CardLocation> = {
  play_area: 'PLAY_AREA',
  arena_commit: 'ARENA_COMMIT',
  discard: 'DISCARD',
};

export const GameTable: React.FC = () => {
  const state = useGameState();
  const dispatch = useDispatchAction();
  const arenaValor = useArenaValor();
  const [draggedCard, setDraggedCard] = useDraggedCard();
  const [, setHoveredZone] = useHoveredZone();
  const layout = useBoardLayout();

  const [previewCard, setPreviewCard] = useState<CardInstance | null>(null);
  const [discardPlayer, setDiscardPlayer] = useState<PlayerState | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [tableScreenRect, setTableScreenRect] = useState({ x: 0, y: 0 });
  const tableRef = useRef<View>(null);

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
  const isLocalTurn = useIsLocalTurn();
  const arenaStats = getArenaChallengeStats(state.arenaCard);

  const playValor =
    localPlayer?.playArea.reduce((s, c) => s + (c.definition?.valor ?? 0), 0) ?? 0;
  const valorInPlay = playValor + arenaValor;
  const coinsInPlay =
    (localPlayer?.karma ?? 0) +
    (localPlayer?.playArea.filter(
      (c) => c.definition.type === 'Favor' || c.definition.faction === 'Favor'
    ).length ?? 0);
  const victoryPoints = localPlayer?.victoryPoints ?? 0;

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

  const handleEndPhase = useCallback(() => {
    if (!isLocalTurn) return;
    dispatchAction('END_PHASE');
  }, [dispatchAction, isLocalTurn]);

  const handleHandCardPress = useCallback((card: CardInstance) => {
    setPreviewCard(card);
  }, []);

  const handleCardPreview = useCallback((card: CardInstance) => {
    setPreviewCard(card);
  }, []);

  const handlePlayAreaCardPress = useCallback(
    (card: CardInstance) => {
      if (!isLocalTurn) return;
      if (state.phase === 'ARENA') {
        dispatchAction('MOVE_CARD', {
          cardInstanceId: card.instanceId,
          targetZone: 'ARENA_COMMIT',
        });
      } else {
        setPreviewCard(card);
      }
    },
    [isLocalTurn, state.phase, dispatchAction]
  );

  const handleBuyCard = useCallback(
    (card: CardInstance) => {
      if (!isLocalTurn || state.phase !== 'BUY') return;
      dispatchAction('BUY_CARD', { cardInstanceId: card.instanceId });
    },
    [isLocalTurn, state.phase, dispatchAction]
  );

  const handleAttemptArena = useCallback(() => {
    if (!isLocalTurn || state.phase !== 'ARENA') return;
    dispatchAction('ATTEMPT_ARENA');
  }, [isLocalTurn, state.phase, dispatchAction]);

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
      if (!isLocalTurn) return;
      const zoneId = findZoneAtPosition(x, y, card);
      setHoveredZone(null);
      if (!zoneId) return;

      const targetZone = ZONE_TYPE_BY_ID[zoneId];
      if (!targetZone) return;
      if (!canDropCard(card, card.location, targetZone)) return;

      if (targetZone === 'PLAY_AREA') {
        dispatchAction('PLAY_CARD', { cardInstanceId: card.instanceId });
      } else if (targetZone === 'ARENA_COMMIT') {
        dispatchAction('MOVE_CARD', {
          cardInstanceId: card.instanceId,
          targetZone: 'ARENA_COMMIT',
        });
      } else if (targetZone === 'DISCARD') {
        dispatchAction('DISCARD_CARD', { cardInstanceId: card.instanceId });
      }
    },
    [isLocalTurn, dispatchAction, findZoneAtPosition, setHoveredZone]
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
            <Card
              card={draggedCard}
              width={overlayCardW}
              height={overlayCardH}
              sizeMode="full"
            />
          </View>
        </View>
      </View>,
      document.body
    );

  return (
    <View ref={tableRef} style={styles.table} onLayout={measureTable}>
      {/* Opponents bar */}
      <View style={[styles.opponentsBar, { height: layout.opponentsBarH }]}>
        {opponents.length > 0 ? (
          <OpponentStrip
            opponents={opponents}
            turnPlayerId={state.turnPlayerId}
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
          flavorDeck={state.flavorDeck}
          disfavorDeck={state.disfavorDeck}
          playerDeck={localPlayer?.deck ?? []}
          playerDiscard={localPlayer?.discard ?? []}
          onDiscardPress={handleLocalDiscardPress}
        />

        <View style={[styles.centerColumn, { width: layout.centerW }]}>
          {/* Gallery zone — fixed height ratio */}
          <View style={[styles.galleryZone, { height: layout.galleryH }]}>
            <DropZone
              id="gallery"
              zoneType="GALLERY"
              label=""
              onLayout={handleZoneLayout('gallery')}
              activePhase={state.phase === 'BUY'}
              contentColumn
              contentCenter
              style={styles.galleryDrop}
            >
              <View style={styles.galleryContent}>
                <View style={[styles.galleryRow, { gap: layout.galleryCardGap }]}>
                  {state.galleryCards.map((card) => (
                    <GalleryCard
                      key={card.instanceId}
                      card={card}
                      size={layout.galleryCardSize}
                      onPress={handleCardPreview}
                      onLongPress={(c) => state.phase === 'BUY' && handleBuyCard(c)}
                      disabled={state.phase !== 'BUY'}
                    />
                  ))}
                </View>

                <View
                  style={[
                    styles.galleryRow,
                    { gap: layout.galleryCardGap, marginTop: 6 },
                  ]}
                >
                  <DropZone
                    id="arena_challenge"
                    zoneType="ARENA"
                    label=""
                    onLayout={handleZoneLayout('arena_challenge')}
                    showGlow={state.phase === 'ARENA'}
                    style={styles.arenaGallerySlot}
                  >
                    {state.arenaCard ? (
                      <Card
                        card={state.arenaCard}
                        width={layout.arenaCardW}
                        height={layout.arenaCardH}
                        sizeMode="landscape"
                        onPress={handleCardPreview}
                        onLongPress={handleCardPreview}
                      />
                    ) : (
                      <Text style={styles.emptyText}>No Arena</Text>
                    )}
                  </DropZone>

                  {state.epicCards.map((card) => (
                    <GalleryCard
                      key={card.instanceId}
                      card={card}
                      size={layout.galleryCardSize}
                      onPress={handleCardPreview}
                      onLongPress={(c) => state.phase === 'BUY' && handleBuyCard(c)}
                      disabled={state.phase !== 'BUY'}
                    />
                  ))}
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
              activePhase={state.phase === 'MAIN'}
              highlight={state.phase === 'MAIN' && !!draggedCard}
              contentColumn
              style={StyleSheet.flatten([styles.playField, { flex: 1 }])}
            >
              {state.phase === 'ARENA' && state.arenaCard && (
                <View style={styles.playFieldArena}>
                  <Card
                    card={state.arenaCard}
                    width={Math.min(layout.arenaCardW * 1.1, layout.centerW * 0.45)}
                    height={layout.arenaCardH}
                    sizeMode="landscape"
                    onPress={handleCardPreview}
                    onLongPress={handleCardPreview}
                  />
                  <Text style={styles.arenaReqLabel}>
                    Required: {arenaStats.requiredValor} ⚔
                  </Text>
                </View>
              )}

              <View style={styles.playFieldCards}>
                {(localPlayer?.playArea.length ?? 0) === 0 ? (
                  state.phase === 'MAIN' ? (
                    <Text style={styles.playFieldEmptyText}>
                      Drag cards here from your hand
                    </Text>
                  ) : null
                ) : (
                  <View style={styles.playedCardsRow}>
                    {localPlayer?.playArea.map((card) => (
                      <Card
                        key={card.instanceId}
                        card={card}
                        width={layout.handCardW}
                        height={layout.handCardH}
                        sizeMode="full"
                        draggable={state.phase === 'ARENA'}
                        onPress={handlePlayAreaCardPress}
                        onLongPress={handleCardPreview}
                        onDragEnd={handleDragEnd}
                      />
                    ))}
                  </View>
                )}
              </View>

              <DropZone
                id="arena_commit"
                zoneType="ARENA_COMMIT"
                label=""
                onLayout={handleZoneLayout('arena_commit')}
                activePhase={state.phase === 'ARENA'}
                highlight={state.phase === 'ARENA' && !!draggedCard}
                emptyText={
                  state.phase === 'ARENA' ? 'Commit from Play Area' : undefined
                }
                style={styles.commitZone}
              >
                {state.arenaCommitZone.map((card) => (
                  <Card
                    key={card.instanceId}
                    card={card}
                    width={layout.playCardW}
                    height={layout.playCardH}
                    sizeMode="short"
                    onPress={handleCardPreview}
                    onLongPress={handleCardPreview}
                  />
                ))}
                {state.phase === 'ARENA' && state.arenaCommitZone.length > 0 && (
                  <Pressable style={styles.attemptBtn} onPress={handleAttemptArena}>
                    <Text style={styles.attemptBtnText}>
                      ⚔ Attempt ({arenaValor}/{arenaStats.requiredValor})
                    </Text>
                  </Pressable>
                )}
              </DropZone>
            </DropZone>

            <View style={[styles.handZone, { height: layout.handZoneH }]}>
              <DropZone
                id="discard"
                zoneType="DISCARD"
                label=""
                onLayout={handleZoneLayout('discard')}
                style={styles.handDiscardSlot}
              >
                {localPlayer && localPlayer.discard.length > 0 ? (
                  <Pressable onPress={handleLocalDiscardPress}>
                    <Card
                      card={localPlayer.discard[localPlayer.discard.length - 1]}
                      width={layout.playCardW}
                      height={layout.playCardH}
                      sizeMode="short"
                      onLongPress={handleCardPreview}
                    />
                  </Pressable>
                ) : null}
              </DropZone>

              <View style={styles.handArea}>
                <PlayerHand
                  cards={localPlayer?.hand ?? []}
                  cardWidth={layout.handCardW}
                  cardHeight={layout.handCardH}
                  onCardPress={handleHandCardPress}
                  onLongPress={handleCardPreview}
                  onDragStart={(card) => setDraggedCard(card)}
                  onDragEnd={handleDragEnd}
                  onDragUpdate={handleDragUpdate}
                />
              </View>
            </View>
          </View>
        </View>

        <BoardSidebarRight
          width={layout.sidebarW}
          coinsInPlay={coinsInPlay}
          valorInPlay={valorInPlay}
          victoryPoints={victoryPoints}
          phase={state.phase}
          isLocalTurn={isLocalTurn}
          onEndPhase={handleEndPhase}
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
                  <Card
                    card={draggedCard}
                    width={overlayCardW}
                    height={overlayCardH}
                    sizeMode="full"
                  />
                </View>
              </View>
            </View>
          )
      )}

      <CardPreviewModal
        card={previewCard}
        visible={previewCard !== null}
        onClose={() => setPreviewCard(null)}
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
    </View>
  );
};

const styles = StyleSheet.create({
  table: {
    flex: 1,
    backgroundColor: '#1a1a28',
  },
  opponentsBar: {
    backgroundColor: 'rgba(212,175,55,0.15)',
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
    backgroundColor: 'rgba(135,206,235,0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(135,206,235,0.25)',
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
    flex: 1,
    minHeight: 0,
  },
  centerColumn: {
    flexDirection: 'column',
    minHeight: 0,
  },
  bodyColumn: {
    flexDirection: 'column',
    minHeight: 0,
  },
  playField: {
    backgroundColor: 'rgba(255,105,180,0.1)',
    borderWidth: 0,
    borderRadius: 0,
    padding: 8,
    minHeight: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  playFieldArena: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
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
  arenaReqLabel: {
    color: '#F1C40F',
    fontWeight: '700',
    fontSize: 11,
  },
  playedCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commitZone: {
    borderStyle: 'dashed',
    borderColor: 'rgba(139,105,20,0.45)',
    backgroundColor: 'rgba(139,105,20,0.06)',
    minHeight: 72,
    marginTop: 'auto',
  },
  attemptBtn: {
    backgroundColor: '#C0392B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  attemptBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  handZone: {
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(76,175,80,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 6,
  },
  handDiscardSlot: {
    width: 56,
    minHeight: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
  },
  handArea: {
    flex: 1,
    minHeight: 0,
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
