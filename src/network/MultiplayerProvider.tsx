import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useSetAtom, getDefaultStore } from 'jotai';
import {
  MultiplayerGameClient,
  GameSession,
  LobbyInfo,
  ConnectionStatus,
  isOnlineModeAvailable,
} from './MultiplayerClient';
import {
  registerRemoteDispatch,
  setGameStateAtom,
  setMultiplayerMetaAtom,
  localPlayerKeyAtom,
  gameStateAtom,
} from '../store/useGameStore';
import { GameState } from '../types/gameTypes';
import { createLobbyGameState } from '../game/GameEngine';

export type AppPhase = 'landing' | 'lobby' | 'game' | 'postgame';

interface MultiplayerContextValue {
  phase: AppPhase;
  session: GameSession | null;
  lobby: LobbyInfo | null;
  status: ConnectionStatus;
  isOnline: boolean;
  error: string | null;
  loading: boolean;
  joinCode: string;
  createGame: (displayName: string, maxPlayers: number) => Promise<void>;
  joinGame: (joinCode: string, displayName: string) => Promise<void>;
  startLocalPractice: (displayName: string) => Promise<void>;
  updateMaxPlayers: (maxPlayers: number) => Promise<void>;
  startGame: () => Promise<void>;
  leaveToLanding: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue>({
  phase: 'landing',
  session: null,
  lobby: null,
  status: 'disconnected',
  isOnline: false,
  error: null,
  loading: false,
  joinCode: '',
  createGame: async () => {},
  joinGame: async () => {},
  startLocalPractice: async () => {},
  updateMaxPlayers: async () => {},
  startGame: async () => {},
  leaveToLanding: () => {},
});

function resolvePhase(
  state: GameState | null,
  session: GameSession | null,
  lobby: LobbyInfo | null
): AppPhase {
  if (!session) return 'landing';
  if (session.gameId === 'local') {
    if (state?.status === 'finished') return 'postgame';
    return 'game';
  }
  if (state?.status === 'finished') return 'postgame';
  if (state?.phase === 'PREGAME' || state?.status === 'active') return 'game';
  if (lobby?.status === 'lobby' || state?.status === 'lobby') return 'lobby';
  return 'lobby';
}

export function MultiplayerProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<MultiplayerGameClient | null>(null);
  const lobbyRef = useRef<LobbyInfo | null>(null);
  const [phase, setPhase] = useState<AppPhase>('landing');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [session, setSession] = useState<GameSession | null>(null);
  const [lobby, setLobby] = useState<LobbyInfo | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setGameState = useSetAtom(setGameStateAtom);
  const setMeta = useSetAtom(setMultiplayerMetaAtom);
  const setLocalPlayerKey = useSetAtom(localPlayerKeyAtom);

  useEffect(() => {
    const client = new MultiplayerGameClient();
    clientRef.current = client;

    client.setStateHandler((state) => {
      setGameState(state);
      setPhase((prev) => {
        const next = resolvePhase(state, client.getSession(), lobbyRef.current);
        return next === 'landing' ? prev : next;
      });
    });

    client.setLobbyHandler((info) => {
      lobbyRef.current = info;
      setLobby(info);
      setJoinCode(info.joinCode);
      setPhase((prev) => {
        const currentState = getDefaultStore().get(gameStateAtom);
        const next = resolvePhase(currentState, client.getSession(), info);
        return next === 'landing' ? prev : next;
      });
    });

    registerRemoteDispatch(async (action) => {
      const store = getDefaultStore();
      const currentState = store.get(gameStateAtom);
      return clientRef.current!.dispatchAction(currentState, action);
    });

    setGameState(createLobbyGameState('pending', []));

    return () => {
      registerRemoteDispatch(null);
      client.disconnect();
      clientRef.current = null;
    };
  }, [setGameState]);

  const runOnline = useCallback(
    async (fn: (client: MultiplayerGameClient) => Promise<GameSession>) => {
      const client = clientRef.current;
      if (!client) return;
      if (!isOnlineModeAvailable()) {
        setError('Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        client.disconnect();
        setGameState(createLobbyGameState('pending', []));
        const onlineSession = await fn(client);
        setSession(onlineSession);
        setLocalPlayerKey(onlineSession.playerKey);
        setJoinCode(onlineSession.joinCode);
        setMeta({ online: true, joinCode: onlineSession.joinCode, error: null });
        setStatus(client.getStatus());

        const lobbyInfo = await client.fetchLobby();
        lobbyRef.current = lobbyInfo;
        setLobby(lobbyInfo);
        setPhase('lobby');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Request failed';
        setError(message);
        setMeta({ online: false, error: message });
      } finally {
        setLoading(false);
      }
    },
    [setGameState, setLocalPlayerKey, setMeta]
  );

  const createGame = useCallback(
    async (displayName: string, maxPlayers: number) => {
      await runOnline((client) => client.createGame(displayName.trim(), maxPlayers));
    },
    [runOnline]
  );

  const joinGame = useCallback(
    async (code: string, displayName: string) => {
      await runOnline((client) => client.joinGame(code.trim(), displayName.trim()));
    },
    [runOnline]
  );

  const startLocalPractice = useCallback(async (displayName: string) => {
    const client = clientRef.current;
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      client.disconnect();
      const state = await client.connectLocal(displayName.trim());
      setSession(client.getSession());
      setLocalPlayerKey('player_1');
      setLobby(null);
      setJoinCode('LOCAL');
      setMeta({ online: false, joinCode: 'LOCAL', error: null });
      setGameState(state);
      setPhase('game');
      setStatus(client.getStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start practice');
    } finally {
      setLoading(false);
    }
  }, [setGameState, setLocalPlayerKey, setMeta]);

  const updateMaxPlayers = useCallback(async (maxPlayers: number) => {
    const client = clientRef.current;
    if (!client || !session?.isHost) return;
    setLoading(true);
    setError(null);
    try {
      const info = await client.updateMaxPlayers(maxPlayers);
      setLobby(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update players');
    } finally {
      setLoading(false);
    }
  }, [session]);

  const startGame = useCallback(async () => {
    const client = clientRef.current;
    if (!client || !session?.isHost) return;
    setLoading(true);
    setError(null);
    try {
      const state = await client.startGame();
      lobbyRef.current = lobby
        ? { ...lobby, status: 'active' }
        : null;
      setGameState(state);
      setPhase('game');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start game');
    } finally {
      setLoading(false);
    }
  }, [session, lobby, setGameState]);

  const leaveToLanding = useCallback(() => {
    clientRef.current?.disconnect();
    lobbyRef.current = null;
    setSession(null);
    setLobby(null);
    setJoinCode('');
    setError(null);
    setPhase('landing');
    setStatus('disconnected');
    setLocalPlayerKey('player_1');
    setGameState(createLobbyGameState('pending', []));
    setMeta({ online: false, joinCode: '', error: null });
  }, [setGameState, setLocalPlayerKey, setMeta]);

  return (
    <MultiplayerContext.Provider
      value={{
        phase,
        session,
        lobby,
        status,
        isOnline: isOnlineModeAvailable() && session?.gameId !== 'local',
        error,
        loading,
        joinCode,
        createGame,
        joinGame,
        startLocalPractice,
        updateMaxPlayers,
        startGame,
        leaveToLanding,
      }}
    >
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer(): MultiplayerContextValue {
  return useContext(MultiplayerContext);
}
