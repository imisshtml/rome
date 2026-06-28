import { atom, useAtom, useAtomValue, useSetAtom, getDefaultStore } from 'jotai';
import { GameState, GameAction } from '../types/gameTypes';
import { CardInstance } from '../types/cardTypes';
import { HoverPreviewAnchor } from '../utils/hoverPreviewLayout';
import {
  createInitialGameState,
  createLobbyGameState,
  applyActionWithPhaseRules,
  rehydrateGameState,
  getCurrentPlayer,
  getArenaCommitValor,
  MAX_PLAYERS,
} from '../game/GameEngine';

import { pickAiDisplayNames } from '../utils/aiPlayerNames';
import {
  applyTestDeckConfig,
  loadTestDeckConfig,
  TestDeckConfig,
} from '../utils/testDeckConfig';

const aiDefaultNames = pickAiDisplayNames(MAX_PLAYERS - 1, ['You']);
const defaultSetups = [
  { id: 'player_1', name: 'You', isAI: false },
  ...aiDefaultNames.map((name, i) => ({
    id: `player_${i + 2}`,
    name,
    isAI: true,
  })),
];

const gameStateAtom = atom<GameState>(
  createLobbyGameState('local', [])
);

const localPlayerKeyAtom = atom<string>('player_1');

const multiplayerMetaAtom = atom<{
  joinCode: string;
  online: boolean;
  error: string | null;
}>({
  joinCode: '',
  online: false,
  error: null,
});

const debugVisibleAtom = atom(false);
const draggedCardAtom = atom<CardInstance | null>(null);
const hoveredZoneAtom = atom<string | null>(null);
export interface HoverPreviewState {
  card: CardInstance;
  anchor: HoverPreviewAnchor;
}

const hoverPreviewAtom = atom<HoverPreviewState | null>(null);

let remoteDispatch: ((action: GameAction) => Promise<GameState>) | null = null;
let readGameState: (() => GameState) | null = null;

export function registerRemoteDispatch(
  handler: ((action: GameAction) => Promise<GameState>) | null
) {
  remoteDispatch = handler;
}

/** Read from the same Jotai store as React hooks (not getDefaultStore when Provider is used). */
export function registerGameStateReader(reader: (() => GameState) | null) {
  readGameState = reader;
}

export function readGameStateSnapshot(): GameState {
  const raw = readGameState?.() ?? getDefaultStore().get(gameStateAtom);
  return rehydrateGameState(raw);
}

export const setGameStateAtom = atom(null, (_get, set, state: GameState) => {
  set(gameStateAtom, rehydrateGameState(state));
});

export const setMultiplayerMetaAtom = atom(
  null,
  (_get, set, meta: Partial<{ joinCode: string; online: boolean; error: string | null }>) => {
    set(multiplayerMetaAtom, (prev) => ({ ...prev, ...meta }));
  }
);

const dispatchActionAtom = atom(
  null,
  async (get, set, action: GameAction) => {
    const currentState = rehydrateGameState(get(gameStateAtom));

    if (remoteDispatch) {
      try {
        const next = rehydrateGameState(await remoteDispatch(action));
        set(gameStateAtom, next);
        set(multiplayerMetaAtom, (prev) => ({ ...prev, error: null }));
        return next;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed';
        set(multiplayerMetaAtom, (prev) => ({ ...prev, error: message }));
        return currentState;
      }
    }

    const localNext = applyActionWithPhaseRules(currentState, action);
    if (localNext === currentState) {
      return currentState;
    }
    set(gameStateAtom, localNext);
    return localNext;
  }
);

const testDeckConfigAtom = atom<TestDeckConfig>(loadTestDeckConfig());

export const setTestDeckConfigAtom = atom(
  null,
  (_get, set, config: TestDeckConfig) => {
    set(testDeckConfigAtom, applyTestDeckConfig(config));
  }
);

const resetGameAtom = atom(null, (get, set) => {
  const meta = get(multiplayerMetaAtom);
  applyTestDeckConfig(get(testDeckConfigAtom));

  const current = rehydrateGameState(get(gameStateAtom));
  const setups =
    current.players.length > 0
      ? current.players.map((p) => ({
          id: p.id,
          name: p.name,
          isAI: p.isAI ?? false,
        }))
      : defaultSetups;
  const gameId =
    current.id && current.id !== 'pending' ? current.id : 'game_1';

  if (!meta.online) {
    set(gameStateAtom, rehydrateGameState(createInitialGameState(setups, gameId)));
    return;
  }

  if (
    current.phase === 'PREGAME' &&
    current.status === 'active' &&
    current.players.length > 0
  ) {
    let next = current;
    for (const player of current.players) {
      if (next.readyPlayerIds.includes(player.id)) continue;
      next = applyActionWithPhaseRules(next, {
        type: 'PLAYER_READY',
        playerId: player.id,
        timestamp: Date.now(),
      });
    }
    set(gameStateAtom, rehydrateGameState(next));
    return;
  }

  set(gameStateAtom, rehydrateGameState(createInitialGameState(setups, gameId)));
});

export function useGameState(): GameState {
  return useAtomValue(gameStateAtom);
}

export function useDispatchAction() {
  return useSetAtom(dispatchActionAtom);
}

export function useResetGame() {
  return useSetAtom(resetGameAtom);
}

export function useTestDeckConfig() {
  return useAtomValue(testDeckConfigAtom);
}

export function useSetTestDeckConfig() {
  return useSetAtom(setTestDeckConfigAtom);
}

export function useLocalPlayerKey() {
  return useAtomValue(localPlayerKeyAtom);
}

export function useSetLocalPlayerKey() {
  return useSetAtom(localPlayerKeyAtom);
}

export function useMultiplayerMeta() {
  return useAtomValue(multiplayerMetaAtom);
}

export function useCurrentPlayer() {
  const state = useGameState();
  return getCurrentPlayer(state);
}

export function useLocalPlayer() {
  const state = useGameState();
  const localKey = useLocalPlayerKey();
  return state.players.find((p) => p.id === localKey) ?? state.players[0];
}

export function useIsLocalTurn() {
  const state = useGameState();
  const localKey = useLocalPlayerKey();
  return state.turnPlayerId === localKey;
}

export function useArenaValor() {
  const state = useGameState();
  return getArenaCommitValor(state);
}

export function useDebugVisible() {
  return useAtom(debugVisibleAtom);
}

export function useDraggedCard() {
  return useAtom(draggedCardAtom);
}

export function useHoveredZone() {
  return useAtom(hoveredZoneAtom);
}

export function useHoverPreview() {
  return useAtom(hoverPreviewAtom);
}

export function useHoverPreviewCard() {
  return useAtom(hoverPreviewAtom);
}

export {
  gameStateAtom,
  debugVisibleAtom,
  draggedCardAtom,
  hoveredZoneAtom,
  hoverPreviewAtom,
  localPlayerKeyAtom,
  multiplayerMetaAtom,
  testDeckConfigAtom,
};
