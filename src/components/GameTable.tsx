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
import Animated, {
  FadeInRight,
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  useGameState,
  useDispatchAction,
  useDraggedCard,
  useHoveredZone,
  useLocalPlayer,
  useIsLocalTurn,
} from '../store/useGameStore';
import { getArenaChallengeStats, getArenaChallengeTotalValor, getCurrentPlayer } from '../game/GameEngine';
import { getArenaMaxCommit } from '../utils/arenaUtils';
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
import CardHoverPreviewOverlay from './CardHoverPreview';
import DiscardModal from './DiscardModal';
import DestroyedModal from './DestroyedModal';
import DestroyedPileButton from './DestroyedPileButton';
import ArenaChallengeModal, { ArenaModalStep } from './ArenaChallengeModal';
import FactionChoiceModal from './FactionChoiceModal';
import BandingBonusModal from './BandingBonusModal';
import ForcedOpponentDiscardModal from './ForcedOpponentDiscardModal';
import ArenaLossModal from './ArenaLossModal';
import GalleryEventModal from './GalleryEventModal';
import {
  getPendingEventHandChoiceForPlayer,
  getPendingEventHandChoicePlayerIds,
  getPendingEventItemChoicePlayerIds,
  handCardValidForEventChoice,
} from '../game/EventResolver';
import FavorRevealModal from './FavorRevealModal';
import ArenaWagerResultModal from './ArenaWagerResultModal';
import CardDestroyPickModal from './CardDestroyPickModal';
import OrEffectChoiceModal from './OrEffectChoiceModal';
import AnyDiscardDestroyModal from './AnyDiscardDestroyModal';
import PregameMarketView from './PregameMarketView';
import TutorialOverlay from './TutorialOverlay';
import TutorialTarget from './TutorialTarget';
import DebugPanel from './DebugPanel';
import { useTutorial } from '../context/TutorialContext';
import { getValorInPlay } from '../utils/combatStatsUtils';
import { requiresFactionChoiceOnPlay } from '../utils/cardFactionUtils';
import {
  getEffectivePurchaseCost,
  getTurnEpicDiscount,
} from '../utils/purchaseCostUtils';
import {
  isCoinOnlyPlayCard,
  listEligibleDestroyedGainCards,
  listEligibleDestroyedPlaceCards,
  listEligibleInPlayCopyCards,
  listEligibleMarketCopyCards,
  listEligibleMarketGainCards,
  listEligiblePlaceOnDeckCards,
} from '../utils/effectFlowUtils';
import MarketPickModal from './MarketPickModal';
import DeckLookModal from './DeckLookModal';
import DeckTopRevealModal from './DeckTopRevealModal';
import GainBandingBonusPickModal from './GainBandingBonusPickModal';
import { Faction } from '../types/cardTypes';
import {
  getCardDefinition,
  isGratiaSupplyDefinition,
  isPurchasableMarketCard,
} from '../game/CardDefinitions';
import { FullBleedBackground } from './FullBleedBackground';
import { gameBackground } from '../assets/images';

const ZONE_LAYOUTS = new Map<string, LayoutRectangle>();
const MARKET_LOCATIONS: CardLocation[] = ['GALLERY', 'EPIC_ROW', 'RECRUIT'];
const DOUBLE_TAP_MS = 400;

function isBuyableMarketCard(
  card: CardInstance | null,
  galleryPurchasedBy?: Record<string, string>
): boolean {
  if (card == null || isGratiaSupplyDefinition(card)) return false;
  if (!MARKET_LOCATIONS.includes(card.location)) return false;
  if (!isPurchasableMarketCard(card)) return false;
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
  const isPregame = state.phase === 'PREGAME' && state.status === 'active';
  const layout = useBoardLayout(!isPregame);
  const [previewCard, setPreviewCard] = useState<CardInstance | null>(null);
  const [discardPlayer, setDiscardPlayer] = useState<PlayerState | null>(null);
  const [destroyedModalOpen, setDestroyedModalOpen] = useState(false);
  const [arenaModalOpen, setArenaModalOpen] = useState(false);
  const [arenaModalStep, setArenaModalStep] = useState<ArenaModalStep>('prompt');
  const [factionChoiceCard, setFactionChoiceCard] = useState<CardInstance | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [tableScreenRect, setTableScreenRect] = useState({ x: 0, y: 0 });
  const tableRef = useRef<View>(null);
  const lastMarketTapRef = useRef<{ id: string; at: number } | null>(null);
  const tutorialAutoStartedRef = useRef(false);
  const {
    isActive: tutorialActive,
    isCompleted: tutorialCompleted,
    startTutorial,
    pendingActivePhase,
    resumeActivePhase,
    currentStep: tutorialStep,
  } = useTutorial();

  const measureTable = useCallback(() => {
    tableRef.current?.measureInWindow((x, y) => {
      setTableScreenRect({ x, y });
    });
  }, []);

  useEffect(() => {
    if (draggedCard) measureTable();
  }, [draggedCard, measureTable]);

  useEffect(() => {
    if (
      isPregame &&
      !tutorialCompleted &&
      !tutorialActive &&
      !tutorialAutoStartedRef.current
    ) {
      tutorialAutoStartedRef.current = true;
      startTutorial();
    }
  }, [isPregame, tutorialCompleted, tutorialActive, startTutorial]);

  const localPlayer = useLocalPlayer();
  const opponents = state.players.filter((p) => p.id !== localPlayer?.id);
  const turnPlayer = getCurrentPlayer(state) ?? localPlayer;
  const isTurnPlayerLocal = turnPlayer?.id === localPlayer?.id;
  const isLocalTurn = useIsLocalTurn();
  const arenaStats = getArenaChallengeStats(state.arenaCard);
  const arenaMaxCommit = localPlayer
    ? getArenaMaxCommit(localPlayer)
    : 3;

  const isMainActive = state.status === 'active' && state.phase === 'MAIN';

  useEffect(() => {
    if (tutorialActive && pendingActivePhase && isMainActive) {
      const timer = setTimeout(() => resumeActivePhase(), 350);
      return () => clearTimeout(timer);
    }
  }, [tutorialActive, pendingActivePhase, isMainActive, resumeActivePhase]);

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
  const showBandingKeyForTutorial =
    tutorialActive && tutorialStep?.targetKey === 'tutorial_faction_key';
  const showBandingKey = isMainActive || showBandingKeyForTutorial;
  const pendingArenaResponse =
    state.arenaChallenge?.pendingResponsePlayerIds.includes(localPlayer?.id ?? '') ?? false;
  const arenaChallengeTotal = getArenaChallengeTotalValor(state);

  const handCardsTranslateY = useSharedValue(isLocalTurn ? 0 : layout.handZoneH * 0.4);
  const wasLocalTurnRef = useRef(isLocalTurn);
  const handDropOffsetRef = useRef(layout.handZoneH * 0.4);
  handDropOffsetRef.current = layout.handZoneH * 0.4;

  useEffect(() => {
    if (!isMainActive) {
      cancelAnimation(handCardsTranslateY);
      handCardsTranslateY.value = 0;
      wasLocalTurnRef.current = isLocalTurn;
      return;
    }

    const dropOffset = handDropOffsetRef.current;
    const wasLocal = wasLocalTurnRef.current;
    wasLocalTurnRef.current = isLocalTurn;

    if (isLocalTurn && !wasLocal) {
      cancelAnimation(handCardsTranslateY);
      handCardsTranslateY.value = withSpring(0, {
        damping: 22,
        stiffness: 280,
        mass: 0.85,
      });
      return;
    }

    if (!isLocalTurn && wasLocal) {
      cancelAnimation(handCardsTranslateY);
      handCardsTranslateY.value = withTiming(dropOffset, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    if (!isLocalTurn) {
      handCardsTranslateY.value = dropOffset;
    }
  }, [isLocalTurn, isMainActive, handCardsTranslateY]);

  const handCardsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: handCardsTranslateY.value }],
  }));

  useEffect(() => {
    if (pendingArenaResponse) {
      setArenaModalOpen(true);
      setArenaModalStep('respond');
    }
  }, [pendingArenaResponse]);

  useEffect(() => {
    if (state.lastArenaResult && !state.arenaChallenge) {
      if (
        state.pendingArenaLoss &&
        state.pendingArenaLoss.playerId === localPlayer?.id
      ) {
        setArenaModalOpen(false);
        return;
      }
      setArenaModalOpen(true);
      setArenaModalStep('result');
    } else if (!state.lastArenaResult && arenaModalStep === 'result') {
      setArenaModalOpen(false);
      setArenaModalStep('prompt');
    }
  }, [state.lastArenaResult, state.arenaChallenge, state.pendingArenaLoss, localPlayer?.id, arenaModalStep]);

  useEffect(() => {
    if (state.arenaChallenge && !pendingArenaResponse && arenaModalStep !== 'result') {
      setArenaModalStep('waiting');
      if (localPlayer?.id === state.arenaChallenge.challengerId) {
        setArenaModalOpen(true);
      }
    }
  }, [state.arenaChallenge, pendingArenaResponse, arenaModalStep, localPlayer?.id]);

  const carryCoins = localPlayer?.carryCoins ?? 0;
  const inActiveGame =
    state.status === 'active' && state.phase !== 'PREGAME';
  const pendingEventHandChoicePlayerIds = getPendingEventHandChoicePlayerIds(state);
  const pendingEventItemChoicePlayerIds = getPendingEventItemChoicePlayerIds(state);
  const localEventHandChoice = localPlayer
    ? getPendingEventHandChoiceForPlayer(state, localPlayer.id)
    : null;

  const galleryEventFlow =
    state.pendingGalleryEvent != null ||
    (state.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0 ||
    pendingEventHandChoicePlayerIds.length > 0 ||
    pendingEventItemChoicePlayerIds.length > 0 ||
    state.phase === 'CLEANUP';
  const coinsInPlay = !inActiveGame
    ? 0
    : carryCoins !== 0
      ? carryCoins
      : isLocalTurn
        ? state.turnCoins
        : 0;
  const coinsAreCarried =
    inActiveGame &&
    carryCoins !== 0 &&
    (galleryEventFlow || !isLocalTurn || state.turnCoins === 0);
  const victoryPoints = localPlayer ? getPlayerTotalVp(localPlayer) : 0;
  const destroyedCount = state.destroyedPile?.length ?? 0;

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
    if (pendingEventHandChoicePlayerIds.length > 0) return;
    if (pendingEventItemChoicePlayerIds.length > 0) return;
    if ((state.pendingEventOptionalDiscards?.pendingPlayerIds.length ?? 0) > 0) {
      return;
    }
    dispatchAction('RESOLVE_GALLERY_EVENT');
  }, [
    dispatchAction,
    localPlayer,
    state.pendingGalleryEvent,
    pendingEventHandChoicePlayerIds,
    pendingEventItemChoicePlayerIds,
    state.pendingEventOptionalDiscards,
  ]);

  const handleSkipGalleryOptional = useCallback(() => {
    if (!localPlayer) return;
    dispatchAction('EVENT_SKIP_GALLERY_CHOICE');
  }, [dispatchAction, localPlayer]);

  const handleEventLoseItem = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('EVENT_LOSE_ITEM', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const handleEventDiscardCard = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('EVENT_DISCARD_CARD', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const handleResolveFavor = useCallback(() => {
    if (
      !state.pendingFavorReveal ||
      state.pendingFavorDestroyPick ||
      state.pendingFavorArenaWagerPick
    ) {
      return;
    }
    dispatchAction('RESOLVE_FAVOR');
  }, [
    dispatchAction,
    state.pendingFavorReveal,
    state.pendingFavorDestroyPick,
    state.pendingFavorArenaWagerPick,
  ]);

  const handleAcceptFavor = useCallback(() => {
    if (!localPlayer || !state.pendingFavorReveal) return;
    dispatchAction('ACCEPT_FAVOR');
  }, [dispatchAction, localPlayer, state.pendingFavorReveal]);

  const handleDeclineFavor = useCallback(() => {
    if (!localPlayer || !state.pendingFavorReveal) return;
    dispatchAction('DECLINE_FAVOR');
  }, [dispatchAction, localPlayer, state.pendingFavorReveal]);

  const handleFavorDestroyCard = useCallback(
    (card: CardInstance, sourceZone: 'hand' | 'discard' | 'play_area') => {
      if (!localPlayer) return;
      const zoneMap = {
        hand: 'HAND',
        discard: 'DISCARD',
        play_area: 'PLAY_AREA',
      } as const;
      dispatchAction('FAVOR_DESTROY_CARD', {
        cardInstanceId: card.instanceId,
        sourceZone: zoneMap[sourceZone],
      });
    },
    [dispatchAction, localPlayer]
  );

  const handleArenaWagerPick = useCallback(
    (card: CardInstance, sourceZone: 'hand' | 'play_area') => {
      if (!localPlayer) return;
      dispatchAction('FAVOR_ARENA_WAGER_PICK', {
        cardInstanceId: card.instanceId,
        sourceZone: sourceZone === 'hand' ? 'HAND' : 'PLAY_AREA',
      });
    },
    [dispatchAction, localPlayer]
  );

  const handleDismissArenaWagerResult = useCallback(() => {
    dispatchAction('DISMISS_ARENA_WAGER_RESULT');
  }, [dispatchAction]);

  const pendingBandingBonus =
    state.pendingBandingBonus?.playerId === localPlayer?.id
      ? state.pendingBandingBonus
      : null;

  const pendingHandDiscard =
    state.pendingHandDiscard?.playerId === localPlayer?.id
      ? state.pendingHandDiscard
      : null;

  const pendingCardDestroyPick =
    state.pendingCardDestroyPick?.playerId === localPlayer?.id
      ? state.pendingCardDestroyPick
      : null;

  const pendingGalleryDestroyPick =
    state.pendingGalleryDestroyPick?.playerId === localPlayer?.id
      ? state.pendingGalleryDestroyPick
      : null;

  const pendingEpicDestroyPick =
    state.pendingEpicDestroyPick?.playerId === localPlayer?.id
      ? state.pendingEpicDestroyPick
      : null;

  const pendingAnyDiscardDestroyPick =
    state.pendingAnyDiscardDestroyPick?.playerId === localPlayer?.id
      ? state.pendingAnyDiscardDestroyPick
      : null;

  const pendingOrEffectChoice =
    state.pendingOrEffectChoice?.playerId === localPlayer?.id
      ? state.pendingOrEffectChoice
      : null;

  const pendingOnGainDestroyPick =
    state.pendingOnGainDestroyPick?.playerId === localPlayer?.id
      ? state.pendingOnGainDestroyPick
      : null;

  const pendingForcedOpponentFlow =
    state.pendingForcedOpponentDiscards?.controllerId === localPlayer?.id &&
    state.pendingForcedOpponentDiscards.controllerPicks
      ? state.pendingForcedOpponentDiscards
      : null;

  const pendingForcedDiscard =
    state.pendingForcedOpponentDiscards?.targetPlayerId === localPlayer?.id &&
    !state.pendingForcedOpponentDiscards?.controllerPicks
      ? state.pendingForcedOpponentDiscards
      : null;

  const pendingPlaceCardOnDeckPick =
    state.pendingPlaceCardOnDeckPick?.playerId === localPlayer?.id
      ? state.pendingPlaceCardOnDeckPick
      : null;

  const placeOnDeckPickCards =
    pendingPlaceCardOnDeckPick && localPlayer
      ? listEligiblePlaceOnDeckCards(localPlayer, {
          source: 'discard',
          faction: pendingPlaceCardOnDeckPick.faction,
          anyFaction: pendingPlaceCardOnDeckPick.anyFaction,
          position: pendingPlaceCardOnDeckPick.position,
          optional: pendingPlaceCardOnDeckPick.optional ?? false,
        })
      : [];

  const pendingFavorReplayPick =
    state.pendingFavorReplayPick?.playerId === localPlayer?.id
      ? state.pendingFavorReplayPick
      : null;

  const pendingGainCardPick =
    state.pendingGainCardPick?.playerId === localPlayer?.id
      ? state.pendingGainCardPick
      : null;

  const pendingCopyCardPick =
    state.pendingCopyCardPick?.playerId === localPlayer?.id
      ? state.pendingCopyCardPick
      : null;

  const pendingDeckLookPick =
    state.pendingDeckLookPick?.playerId === localPlayer?.id
      ? state.pendingDeckLookPick
      : null;

  const pendingDeckTopRevealPick =
    state.pendingDeckTopRevealPick?.playerId === localPlayer?.id
      ? state.pendingDeckTopRevealPick
      : null;

  const pendingGainBandingBonusPick =
    state.pendingGainBandingBonusPick?.playerId === localPlayer?.id
      ? state.pendingGainBandingBonusPick
      : null;

  const pendingPlaceDestroyedOnMarketPick =
    state.pendingPlaceDestroyedOnMarketPick?.playerId === localPlayer?.id
      ? state.pendingPlaceDestroyedOnMarketPick
      : null;

  const pendingArenaLoss =
    state.pendingArenaLoss?.playerId === localPlayer?.id
      ? state.pendingArenaLoss
      : null;

  const forcedDiscardTarget = pendingForcedDiscard
    ? localPlayer
    : pendingForcedOpponentFlow?.targetPlayerId
      ? state.players.find((p) => p.id === pendingForcedOpponentFlow.targetPlayerId) ??
        null
      : null;

  const forcedDiscardOpponentCandidates =
    pendingForcedOpponentFlow?.phase === 'choose_opponent'
      ? (pendingForcedOpponentFlow.opponentCandidateIds ?? [])
          .map((id) => state.players.find((p) => p.id === id))
          .filter((p): p is PlayerState => p != null)
      : [];

  const coinCardsInHand = (localPlayer?.hand ?? []).filter(isCoinOnlyPlayCard);
  const destroyPickPending =
    pendingForcedOpponentFlow ||
    pendingPlaceCardOnDeckPick ||
    pendingCardDestroyPick ||
    pendingGalleryDestroyPick ||
    pendingEpicDestroyPick ||
    pendingAnyDiscardDestroyPick ||
    pendingOrEffectChoice ||
    pendingOnGainDestroyPick ||
    pendingFavorReplayPick ||
    pendingGainCardPick ||
    pendingCopyCardPick ||
    pendingDeckLookPick ||
    pendingDeckTopRevealPick ||
    pendingGainBandingBonusPick ||
    pendingPlaceDestroyedOnMarketPick ||
    pendingPlaceCardOnDeckPick;

  const canPlayAllCoins =
    canInteract &&
    !pendingBandingBonus &&
    !pendingHandDiscard &&
    !destroyPickPending &&
    !pendingForcedDiscard &&
    !pendingArenaLoss &&
    coinCardsInHand.length > 1;

  const handlePlayAllCoins = useCallback(async () => {
    if (!localPlayer || !canPlayAllCoins) return;

    for (const card of coinCardsInHand) {
      await dispatch({
        type: 'PLAY_CARD',
        playerId: localPlayer.id,
        payload: { cardInstanceId: card.instanceId },
        timestamp: Date.now(),
      });
    }
  }, [localPlayer, canPlayAllCoins, coinCardsInHand, dispatch]);

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
      if (!localPlayer) return;
      dispatchAction('FORCE_OPPONENT_DISCARD', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const handleChooseForceDiscardTarget = useCallback(
    (playerId: string) => {
      if (!localPlayer) return;
      dispatchAction('CHOOSE_FORCE_DISCARD_TARGET', { targetPlayerId: playerId });
    },
    [dispatchAction, localPlayer]
  );

  const handlePlaceCardOnDeckPick = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('PLACE_CARD_ON_DECK_PICK', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const handleSkipPlaceCardOnDeck = useCallback(() => {
    if (!localPlayer) return;
    dispatchAction('PLACE_CARD_ON_DECK_SKIP');
  }, [dispatchAction, localPlayer]);

  const handleGainCardPick = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('GAIN_CARD_PICK', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const handleFavorReplayPick = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('FAVOR_REPLAY_PICK', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const handleCopyCardPick = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('COPY_CARD_PICK', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const handlePlaceDestroyedOnMarketPick = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('PLACE_DESTROYED_ON_MARKET_PICK', {
        cardInstanceId: card.instanceId,
      });
    },
    [dispatchAction, localPlayer]
  );

  const handleSkipPlaceDestroyedOnMarket = useCallback(() => {
    if (!localPlayer) return;
    dispatchAction('PLACE_DESTROYED_ON_MARKET_SKIP');
  }, [dispatchAction, localPlayer]);

  const handleDeckLookChoosePlayer = useCallback(
    (playerId: string) => {
      if (!localPlayer) return;
      dispatchAction('DECK_LOOK_CHOOSE_PLAYER', { targetPlayerId: playerId });
    },
    [dispatchAction, localPlayer]
  );

  const handleDeckLookKeepTop = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('DECK_LOOK_KEEP_TOP', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const handleDeckTopRevealResolve = useCallback(
    (choice: 'destroy' | 'return') => {
      if (!localPlayer) return;
      dispatchAction('DECK_TOP_REVEAL_RESOLVE', { deckTopRevealChoice: choice });
    },
    [dispatchAction, localPlayer]
  );

  const handleChooseGainBandingBonus = useCallback(
    (faction: 'Ludus' | 'Legion' | 'Senate') => {
      if (!localPlayer) return;
      dispatchAction('CHOOSE_GAIN_BANDING_BONUS', { bandingFaction: faction });
    },
    [dispatchAction, localPlayer]
  );

  const gainPickCards = pendingGainCardPick
    ? pendingGainCardPick.gainSource === 'destroyed_pile'
      ? listEligibleDestroyedGainCards(state, {
          source: 'destroyed_pile',
          maxCost: pendingGainCardPick.maxCost,
          type: pendingGainCardPick.cardType,
        })
      : listEligibleMarketGainCards(
          state,
          {
            source:
              pendingGainCardPick.gainSource === 'market_or_epic'
                ? 'market_or_epic'
                : 'market',
            maxCost: pendingGainCardPick.maxCost,
            type: pendingGainCardPick.cardType,
            faction: pendingGainCardPick.gainFaction,
          },
          (id) => !state.galleryPurchasedBy?.[id]
        )
    : [];

  const placeDestroyedPickCards = pendingPlaceDestroyedOnMarketPick
    ? listEligibleDestroyedPlaceCards(state)
    : [];

  const copyPickCards = pendingCopyCardPick
    ? pendingCopyCardPick.copySource === 'in_play'
      ? listEligibleInPlayCopyCards(
          state,
          { source: 'in_play', maxCost: pendingCopyCardPick.maxCost },
          pendingCopyCardPick.sourceCardInstanceId
        )
      : listEligibleMarketCopyCards(
          state,
          { source: 'market', maxCost: pendingCopyCardPick.maxCost },
          (id) => !state.galleryPurchasedBy?.[id]
        )
    : [];

  const handleArenaLossDisfavor = useCallback(() => {
    dispatchAction('RESOLVE_ARENA_LOSS', { arenaLossChoice: 'disfavor' });
  }, [dispatchAction]);

  const handleArenaLossDestroyStrongest = useCallback(() => {
    dispatchAction('RESOLVE_ARENA_LOSS', { arenaLossChoice: 'destroy_fighter' });
  }, [dispatchAction]);

  const handleArenaLossDestroyFighter = useCallback(
    (card: CardInstance) => {
      dispatchAction('RESOLVE_ARENA_LOSS', { cardInstanceId: card.instanceId });
    },
    [dispatchAction]
  );

  const handleHandCardPress = useCallback(
    (card: CardInstance) => {
      if (pendingForcedDiscard) {
        handleForcedOpponentDiscard(card);
        return;
      }
      if (pendingHandDiscard && pendingHandDiscard.remaining > 0) {
        dispatchAction('DISCARD_CARD', { cardInstanceId: card.instanceId });
        return;
      }
      if (pendingCardDestroyPick?.fromZones.includes('hand')) {
        dispatchAction('CARD_DESTROY_PICK', {
          cardInstanceId: card.instanceId,
          sourceZone: 'HAND',
        });
        return;
      }
      setPreviewCard(card);
    },
    [dispatchAction, pendingHandDiscard, pendingCardDestroyPick, pendingForcedDiscard, handleForcedOpponentDiscard]
  );

  const handleCardPreview = useCallback((card: CardInstance) => {
    setPreviewCard(card);
  }, []);

  const handlePlayAreaCardPress = useCallback(
    (card: CardInstance) => {
      if (pendingCopyCardPick?.copySource === 'in_play') {
        handleCopyCardPick(card);
        return;
      }
      if (pendingCardDestroyPick?.fromZones.includes('play_area')) {
        dispatchAction('CARD_DESTROY_PICK', {
          cardInstanceId: card.instanceId,
          sourceZone: 'PLAY_AREA',
        });
        return;
      }
      setPreviewCard(card);
    },
    [dispatchAction, pendingCardDestroyPick, pendingCopyCardPick, handleCopyCardPick]
  );

  const handleCardDestroyPick = useCallback(
    (card: CardInstance, sourceZone: 'hand' | 'discard' | 'play_area') => {
      if (!localPlayer) return;
      const zoneMap = {
        hand: 'HAND',
        discard: 'DISCARD',
        play_area: 'PLAY_AREA',
      } as const;
      dispatchAction('CARD_DESTROY_PICK', {
        cardInstanceId: card.instanceId,
        sourceZone: zoneMap[sourceZone],
      });
    },
    [dispatchAction, localPlayer]
  );

  const handleSkipCardDestroy = useCallback(() => {
    if (!localPlayer) return;
    dispatchAction('CARD_DESTROY_SKIP');
  }, [dispatchAction, localPlayer]);

  const handleGalleryDestroyPick = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('GALLERY_DESTROY_PICK', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const handleSkipGalleryDestroy = useCallback(() => {
    if (!localPlayer) return;
    dispatchAction('GALLERY_DESTROY_SKIP');
  }, [dispatchAction, localPlayer]);

  const handleEpicDestroyPick = useCallback(
    (card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('EPIC_DESTROY_PICK', { cardInstanceId: card.instanceId });
    },
    [dispatchAction, localPlayer]
  );

  const handleAnyDiscardDestroyPick = useCallback(
    (targetPlayerId: string, card: CardInstance) => {
      if (!localPlayer) return;
      dispatchAction('ANY_DISCARD_DESTROY_PICK', {
        targetPlayerId,
        cardInstanceId: card.instanceId,
      });
    },
    [dispatchAction, localPlayer]
  );

  const handleChooseOrEffect = useCallback(
    (branchIndex: number) => {
      dispatchAction('CHOOSE_OR_EFFECT', { branchIndex });
    },
    [dispatchAction]
  );

  const handleOnGainDestroyPick = useCallback(
    (card: CardInstance, sourceZone: 'hand' | 'discard') => {
      if (!localPlayer) return;
      dispatchAction('ON_GAIN_DESTROY_PICK', {
        cardInstanceId: card.instanceId,
        sourceZone: sourceZone === 'hand' ? 'HAND' : 'DISCARD',
      });
    },
    [dispatchAction, localPlayer]
  );

  const handleSkipOnGainDestroy = useCallback(() => {
    if (!localPlayer) return;
    dispatchAction('ON_GAIN_DESTROY_SKIP');
  }, [dispatchAction, localPlayer]);

  const orBranchLabels =
    pendingOrEffectChoice?.branches.map((branch) => {
      const parts: string[] = [];
      if (branch.discard_hand) parts.push('Discard your hand');
      if (branch.destroy_self) {
        parts.push(
          (branch.draw_cards as number) > 0
            ? 'Destroy this, '
            : (branch.gain_imperial_favor as number) > 0 ||
                (branch.gain_favor as number) > 0
              ? 'Destroy this for a Favor'
              : (branch.gain_coins as number) > 0
                ? 'Destroy this for +2 Coins'
                : 'Destroy this'
        );
      }
      if ((branch.destroy_cards as number) > 0 && !branch.destroy_self) {
        parts.push('Destroy a card');
      }
      if ((branch.draw_cards as number) > 0) {
        parts.push(`Draw ${branch.draw_cards}`);
      }
      if ((branch.gain_coins as number) > 0) {
        parts.push(`+${branch.gain_coins} Coins`);
      }
      if ((branch.arena_bonus_valor as number) < 0) {
        parts.push(`Sabotage ${branch.arena_bonus_valor} Valor`);
      } else if ((branch.arena_bonus_valor as number) > 0) {
        parts.push(`+${branch.arena_bonus_valor} Arena Valor`);
      }
      return parts.join(', ') || 'Alternate effect';
    }) ?? [];

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
    if (arenaModalStep === 'result' && state.lastArenaResult) {
      dispatchAction('DISMISS_ARENA_RESULT');
    }
    setArenaModalOpen(false);
    setArenaModalStep('prompt');
  }, [arenaModalStep, state.lastArenaResult, dispatchAction]);

  const handleBuyCard = useCallback(
    (card: CardInstance) => {
      if (!canInteract) return;
      dispatchAction('BUY_CARD', { cardInstanceId: card.instanceId });
    },
    [canInteract, dispatchAction]
  );

  const handleMarketCardPress = useCallback(
    (card: CardInstance) => {
      if (pendingGalleryDestroyPick) {
        if (!state.galleryPurchasedBy?.[card.instanceId]) {
          handleGalleryDestroyPick(card);
        }
        return;
      }
      if (pendingEpicDestroyPick && card.location === 'EPIC_ROW') {
        handleEpicDestroyPick(card);
        return;
      }
      if (pendingGainCardPick) {
        if (!state.galleryPurchasedBy?.[card.instanceId]) {
          handleGainCardPick(card);
        }
        return;
      }
      if (pendingCopyCardPick) {
        if (!state.galleryPurchasedBy?.[card.instanceId]) {
          handleCopyCardPick(card);
        }
        return;
      }
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
    [canInteract, handleBuyCard, pendingGalleryDestroyPick, pendingEpicDestroyPick, pendingGainCardPick, pendingCopyCardPick, handleGalleryDestroyPick, handleEpicDestroyPick, handleGainCardPick, handleCopyCardPick, state.galleryPurchasedBy]
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
    if (pendingHandDiscard || destroyPickPending || pendingForcedDiscard || pendingArenaLoss) return undefined;
    const cost = getEffectivePurchaseCost(state, previewCard);
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
    !destroyPickPending &&
    !pendingForcedDiscard &&
    !pendingArenaLoss &&
    state.turnCoins >= getEffectivePurchaseCost(state, previewCard);

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
        <TutorialTarget targetKey="tutorial_opponents" style={styles.opponentsBarContent}>
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
        </TutorialTarget>
        <DebugPanel inOpponentsBar />
      </View>

      {/* Main board: sidebars span gallery + play + hand */}
      <View style={[styles.mainRow, { height: layout.mainContentH }]}>
        <BoardSidebarLeft
          width={layout.sidebarW}
          stackW={layout.stackW}
          stackH={layout.stackH}
          playerStackW={layout.playerStackW}
          playerStackH={layout.playerStackH}
          playerStackGap={layout.playerStackGap}
          stackGap={layout.stackGap}
          galleryDeck={state.gallerySupply ?? []}
          epicDeck={state.epicSupply ?? []}
          flavorDeck={state.flavorDeck}
          disfavorDeck={state.disfavorDeck}
          playerDeck={localPlayer?.deck ?? []}
          playerDiscard={localPlayer?.discard ?? []}
          onDiscardPress={handleLocalDiscardPress}
          onDiscardLayout={handleZoneLayout('discard')}
          onSupplyPreview={handleCardPreview}
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
                  <DestroyedPileButton
                    count={destroyedCount}
                    onPress={() => setDestroyedModalOpen(true)}
                  />
                  <View style={[styles.galleryRow, { gap: layout.galleryCardGap }]}>
                    {state.galleryCards.map((card) => (
                      <GalleryCard
                        key={card.instanceId}
                        card={card}
                        size={layout.galleryCardSize}
                        purchased={!!state.galleryPurchasedBy?.[card.instanceId]}
                        onPress={handleMarketCardPress}
                        onLongPress={(c) => isMainActive && !pendingGalleryDestroyPick && handleBuyCard(c)}
                        disabled={!isMainActive && !pendingGalleryDestroyPick}
                        destroyTarget={!!pendingGalleryDestroyPick && !state.galleryPurchasedBy?.[card.instanceId]}
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
                            hoverPreview
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
                          costOverride={
                            getTurnEpicDiscount(state) > 0
                              ? getEffectivePurchaseCost(state, card)
                              : undefined
                          }
                          onPress={handleMarketCardPress}
                          onLongPress={(c) => isMainActive && !pendingEpicDestroyPick && handleBuyCard(c)}
                          disabled={!isMainActive && !pendingEpicDestroyPick}
                          destroyTarget={!!pendingEpicDestroyPick}
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
            <TutorialTarget targetKey="tutorial_play_zone" style={styles.playTargetWrap}>
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
              {isMainActive && !isTurnPlayerLocal && pendingForcedDiscard ? (
                <Text style={styles.playFieldEmptyText}>
                  Choose cards to discard ({pendingForcedDiscard.remainingForTarget}{' '}
                  remaining)
                </Text>
              ) : (turnPlayer?.playArea.length ?? 0) === 0 ? (
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
            </TutorialTarget>

            <TutorialTarget targetKey="tutorial_hand">
            <View style={styles.handZoneShell}>
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
                  cardsContainerStyle={handCardsAnimatedStyle}
                  canPlayAllCharity={canPlayAllCoins}
                  onPlayAllCharity={handlePlayAllCoins}
                  showBandingKey={showBandingKey}
                  playArea={
                    isTurnPlayerLocal ? (localPlayer?.playArea ?? []) : []
                  }
                  turnPlayedCards={
                    isTurnPlayerLocal
                      ? (localPlayer?.turnPlayedCards ?? [])
                      : []
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
            </TutorialTarget>
          </View>
            </>
          )}
        </View>

        <BoardSidebarRight
          width={layout.sidebarW}
          actionLog={state.actionLog}
          players={state.players}
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
          coinsHint={
            coinsAreCarried
              ? carryCoins < 0
                ? 'Tax next turn'
                : 'Next turn'
              : undefined
          }
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

      <CardHoverPreviewOverlay />

      <CardPreviewModal
        card={previewCard}
        visible={previewCard !== null}
        onClose={() => setPreviewCard(null)}
        showPurchase={
          isBuyableMarketCard(previewCard, state.galleryPurchasedBy) &&
          !pendingHandDiscard &&
          !destroyPickPending &&
          !pendingForcedDiscard &&
          !pendingArenaLoss
        }
        canPurchase={previewCanPurchase}
        purchaseBlockedReason={previewPurchaseBlockedReason}
        onPurchase={handlePreviewPurchase}
      />
      <DiscardModal
        player={discardPlayer}
        visible={discardPlayer !== null}
        onClose={() => setDiscardPlayer(null)}
        onCardPress={(card) => {
          if (pendingCardDestroyPick?.fromZones.includes('discard')) {
            handleCardDestroyPick(card, 'discard');
            setDiscardPlayer(null);
            return;
          }
          setDiscardPlayer(null);
          setPreviewCard(card);
        }}
      />
      <DestroyedModal
        cards={state.destroyedPile ?? []}
        visible={destroyedModalOpen}
        onClose={() => setDestroyedModalOpen(false)}
        onCardPress={(card) => {
          setDestroyedModalOpen(false);
          setPreviewCard(card);
        }}
      />
      <CardDestroyPickModal
        visible={pendingCardDestroyPick != null}
        sourceCardName={pendingCardDestroyPick?.sourceCardName}
        remaining={pendingCardDestroyPick?.remaining ?? 1}
        fromZones={pendingCardDestroyPick?.fromZones ?? ['hand']}
        optional={pendingCardDestroyPick?.optional}
        localHand={localPlayer?.hand ?? []}
        localDiscard={localPlayer?.discard ?? []}
        localPlayArea={localPlayer?.playArea ?? []}
        onDestroyCard={handleCardDestroyPick}
        onSkip={
          pendingCardDestroyPick?.optional ? handleSkipCardDestroy : undefined
        }
      />
      <CardDestroyPickModal
        visible={pendingOnGainDestroyPick != null}
        sourceCardName={pendingOnGainDestroyPick?.sourceCardName}
        remaining={pendingOnGainDestroyPick?.remaining ?? 1}
        fromZones={pendingOnGainDestroyPick?.fromZones ?? ['hand', 'discard']}
        optional={pendingOnGainDestroyPick?.optional}
        localHand={localPlayer?.hand ?? []}
        localDiscard={localPlayer?.discard ?? []}
        localPlayArea={[]}
        onDestroyCard={(card, zone) => {
          if (zone === 'play_area') return;
          handleOnGainDestroyPick(card, zone);
        }}
        onSkip={
          pendingOnGainDestroyPick?.optional ? handleSkipOnGainDestroy : undefined
        }
      />
      <AnyDiscardDestroyModal
        visible={pendingAnyDiscardDestroyPick != null}
        sourceCardName={pendingAnyDiscardDestroyPick?.sourceCardName}
        players={state.players.filter(
          (p) =>
            !pendingAnyDiscardDestroyPick?.opponentsOnly ||
            p.id !== localPlayer?.id
        )}
        onDestroyCard={handleAnyDiscardDestroyPick}
      />
      <OrEffectChoiceModal
        visible={pendingOrEffectChoice != null}
        cardName={pendingOrEffectChoice?.sourceCardName ?? 'Card'}
        baseGainCoins={pendingOrEffectChoice?.baseGainCoins ?? 0}
        branchLabels={orBranchLabels}
        onChoose={handleChooseOrEffect}
      />
      <FactionChoiceModal
        card={factionChoiceCard}
        visible={factionChoiceCard !== null}
        onChoose={handleFactionChoice}
        onCancel={handleCancelFactionChoice}
      />
      <BandingBonusModal
        pending={pendingBandingBonus}
        visible={pendingBandingBonus !== null && !destroyPickPending}
        onAccept={handleAcceptBanding}
        onDecline={handleDeclineBanding}
      />
      <ForcedOpponentDiscardModal
        pending={pendingForcedOpponentFlow ?? pendingForcedDiscard}
        targetPlayer={forcedDiscardTarget}
        opponentCandidates={forcedDiscardOpponentCandidates}
        visible={
          (pendingForcedOpponentFlow != null || pendingForcedDiscard != null) &&
          (pendingForcedOpponentFlow?.phase === 'choose_opponent' ||
            forcedDiscardTarget != null)
        }
        onChoose={handleForcedOpponentDiscard}
        onChooseOpponent={handleChooseForceDiscardTarget}
      />
      <MarketPickModal
        visible={pendingPlaceCardOnDeckPick != null && placeOnDeckPickCards.length > 0}
        title="Place on Deck"
        subtitle={
          pendingPlaceCardOnDeckPick?.optional
            ? `Optional — ${pendingPlaceCardOnDeckPick.sourceCardName ?? 'choose a card'}`
            : pendingPlaceCardOnDeckPick?.sourceCardName
        }
        cards={placeOnDeckPickCards}
        onChoose={handlePlaceCardOnDeckPick}
        onSkip={
          pendingPlaceCardOnDeckPick?.optional
            ? handleSkipPlaceCardOnDeck
            : undefined
        }
      />
      <MarketPickModal
        visible={
          pendingFavorReplayPick != null &&
          (state.flavorDiscard?.length ?? 0) > 0
        }
        title="Replay a Favor"
        subtitle={pendingFavorReplayPick?.sourceCardName}
        cards={state.flavorDiscard ?? []}
        onChoose={handleFavorReplayPick}
      />
      <MarketPickModal
        visible={pendingGainCardPick != null && gainPickCards.length > 0}
        title={
          pendingGainCardPick?.gainSource === 'destroyed_pile'
            ? 'Gain from Destroyed Pile'
            : 'Gain a Card'
        }
        subtitle={pendingGainCardPick?.sourceCardName}
        cards={gainPickCards}
        onChoose={handleGainCardPick}
      />
      <MarketPickModal
        visible={
          pendingGalleryDestroyPick != null &&
          state.galleryCards.some(
            (c) => !state.galleryPurchasedBy?.[c.instanceId]
          )
        }
        title="Destroy Gallery Card"
        subtitle={
          pendingGalleryDestroyPick?.optional
            ? `${pendingGalleryDestroyPick.sourceCardName ?? 'Effect'} — up to ${(pendingGalleryDestroyPick.remaining ?? 0) + (pendingGalleryDestroyPick.destroyedSoFar ?? 0)} (${pendingGalleryDestroyPick.remaining} left)`
            : pendingGalleryDestroyPick?.sourceCardName
        }
        cards={state.galleryCards.filter(
          (c) => !state.galleryPurchasedBy?.[c.instanceId]
        )}
        onChoose={handleGalleryDestroyPick}
        onSkip={
          pendingGalleryDestroyPick?.optional
            ? handleSkipGalleryDestroy
            : undefined
        }
        skipLabel="Done"
      />
      <MarketPickModal
        visible={pendingEpicDestroyPick != null && state.epicCards.length > 0}
        title="Destroy an Epic"
        subtitle={pendingEpicDestroyPick?.sourceCardName}
        cards={state.epicCards}
        onChoose={handleEpicDestroyPick}
      />
      <MarketPickModal
        visible={
          pendingPlaceDestroyedOnMarketPick != null &&
          placeDestroyedPickCards.length > 0
        }
        title="Place on Market Deck"
        subtitle={
          pendingPlaceDestroyedOnMarketPick?.sourceCardName
            ? `Optional (${pendingPlaceDestroyedOnMarketPick.sourceCardName})`
            : 'Choose a destroyed card'
        }
        cards={placeDestroyedPickCards}
        onChoose={handlePlaceDestroyedOnMarketPick}
        onSkip={
          pendingPlaceDestroyedOnMarketPick?.optional
            ? handleSkipPlaceDestroyedOnMarket
            : undefined
        }
      />
      <MarketPickModal
        visible={pendingCopyCardPick != null && copyPickCards.length > 0}
        title={
          pendingCopyCardPick?.copySource === 'in_play'
            ? 'Copy Card In Play'
            : 'Copy Market Card'
        }
        subtitle={pendingCopyCardPick?.sourceCardName}
        cards={copyPickCards}
        onChoose={handleCopyCardPick}
      />
      <DeckLookModal
        pending={pendingDeckLookPick}
        players={state.players}
        visible={pendingDeckLookPick != null}
        onChoosePlayer={handleDeckLookChoosePlayer}
        onKeepTop={handleDeckLookKeepTop}
      />
      <DeckTopRevealModal
        pending={pendingDeckTopRevealPick}
        visible={pendingDeckTopRevealPick != null}
        onResolve={handleDeckTopRevealResolve}
      />
      <GainBandingBonusPickModal
        pending={pendingGainBandingBonusPick}
        visible={pendingGainBandingBonusPick != null}
        onChoose={handleChooseGainBandingBonus}
      />
      <ArenaLossModal
        pending={pendingArenaLoss}
        arenaName={state.arenaCard?.definition.name}
        visible={pendingArenaLoss !== null}
        onChooseDisfavor={handleArenaLossDisfavor}
        onChooseDestroyStrongest={handleArenaLossDestroyStrongest}
        onDestroyFighter={handleArenaLossDestroyFighter}
      />
      <GalleryEventModal
        event={state.pendingGalleryEvent ?? null}
        visible={state.pendingGalleryEvent != null}
        pendingDiscardPlayerIds={pendingEventHandChoicePlayerIds}
        pendingItemPlayerIds={pendingEventItemChoicePlayerIds}
        localEventHandChoice={localEventHandChoice}
        pendingOptionalPlayerIds={
          state.pendingEventOptionalDiscards?.pendingPlayerIds ?? []
        }
        localPlayerId={localPlayer?.id ?? ''}
        localHand={localPlayer?.hand ?? []}
        localItemsInPlay={localPlayer?.itemsInPlay ?? []}
        onResolve={handleResolveGalleryEvent}
        onDiscardCard={handleEventDiscardCard}
        onLoseItem={handleEventLoseItem}
        onSkipOptional={handleSkipGalleryOptional}
        eventOutcomes={state.galleryEventOutcomes ?? []}
        eventDecreeOutcomes={state.galleryEventDecreeOutcomes ?? []}
      />
      <FavorRevealModal
        favor={state.pendingFavorReveal?.card ?? null}
        beneficiaryId={state.pendingFavorReveal?.playerId ?? ''}
        beneficiaryName={
          state.players.find((p) => p.id === state.pendingFavorReveal?.playerId)
            ?.name ?? 'Player'
        }
        visible={state.pendingFavorReveal != null}
        localPlayerId={localPlayer?.id ?? ''}
        localHand={localPlayer?.hand ?? []}
        localDiscard={localPlayer?.discard ?? []}
        localPlayArea={localPlayer?.playArea ?? []}
        pendingDestroyPick={state.pendingFavorDestroyPick ?? null}
        pendingArenaWagerPick={state.pendingFavorArenaWagerPick ?? null}
        onResolve={handleResolveFavor}
        onAccept={handleAcceptFavor}
        onDecline={handleDeclineFavor}
        onDestroyCard={handleFavorDestroyCard}
        onArenaWagerPick={handleArenaWagerPick}
      />
      <ArenaWagerResultModal
        result={state.lastArenaWagerResult ?? null}
        visible={state.lastArenaWagerResult != null}
        onDismiss={handleDismissArenaWagerResult}
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
        maxCommit={arenaMaxCommit}
      />
      <TutorialOverlay />
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
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.3)',
    paddingRight: 44,
  },
  opponentsBarContent: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
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
    position: 'relative',
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
    overflow: 'hidden',
  },
  playTargetWrap: {
    flex: 1,
    minHeight: 0,
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
  handZoneShell: {
    overflow: 'hidden',
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
