import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { GameState, GameAction } from '../types/gameTypes';
import { CardInstance } from '../types/cardTypes';
import {
  createInitialGameState,
  createLobbyGameState,
  applyActionWithPhaseRules,
  rehydrateGameState,
  getCurrentPlayer,
  getArenaCommitValor,
  MAX_PLAYERS,
} from '../game/GameEngine';

const DEFAULT_PLAYER_NAMES = [
  'You',
  'Opponent 1',
  'Opponent 2',
  'Opponent 3',
  'Opponent 4',
  'Opponent 5',
];

const defaultSetups = DEFAULT_PLAYER_NAMES.slice(0, MAX_PLAYERS).map((name, i) => ({
  id: `player_${i + 1}`,
  name,
  isAI: i > 0,
}));

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

let remoteDispatch: ((action: GameAction) => Promise<GameState>) | null = null;

export function registerRemoteDispatch(
  handler: ((action: GameAction) => Promise<GameState>) | null
) {
  remoteDispatch = handler;
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
    const localNext = applyActionWithPhaseRules(currentState, action);

    if (localNext === currentState) {
      return currentState;
    }

    set(gameStateAtom, localNext);

    if (remoteDispatch) {
      try {
        const synced = rehydrateGameState(await remoteDispatch(action));
        set(gameStateAtom, synced);
        set(multiplayerMetaAtom, (prev) => ({ ...prev, error: null }));
        return synced;
      } catch (err) {
        set(gameStateAtom, currentState);
        const message = err instanceof Error ? err.message : 'Sync failed';
        set(multiplayerMetaAtom, (prev) => ({ ...prev, error: message }));
        return currentState;
      }
    }

    return localNext;
  }
);

const resetGameAtom = atom(null, (_get, set) => {
  set(gameStateAtom, createInitialGameState(defaultSetups));
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

export {
  gameStateAtom,
  debugVisibleAtom,
  draggedCardAtom,
  hoveredZoneAtom,
  localPlayerKeyAtom,
  multiplayerMetaAtom,
};
