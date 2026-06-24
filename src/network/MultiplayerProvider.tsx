import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useSetAtom, useStore } from 'jotai';
import {
  MultiplayerGameClient,
  GameSession,
  LobbyInfo,
  ConnectionStatus,
  isOnlineModeAvailable,
} from './MultiplayerClient';
import {
  registerRemoteDispatch,
  registerGameStateReader,
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
    if (state?.status === 'active') return 'game';
    return 'landing';
  }
  if (state?.status === 'finished') return 'postgame';
  if (state?.status === 'active') return 'game';
  if (state?.status === 'lobby' || lobby?.status === 'lobby') return 'lobby';
  return 'lobby';
}

export function MultiplayerProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<MultiplayerGameClient | null>(null);
  const lobbyRef = useRef<LobbyInfo | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [phase, setPhase] = useState<AppPhase>('landing');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [session, setSessionState] = useState<GameSession | null>(null);
  const [lobby, setLobby] = useState<LobbyInfo | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setGameState = useSetAtom(setGameStateAtom);
  const setMeta = useSetAtom(setMultiplayerMetaAtom);
  const setLocalPlayerKey = useSetAtom(localPlayerKeyAtom);
  const jotaiStore = useStore();
  const jotaiStoreRef = useRef(jotaiStore);
  jotaiStoreRef.current = jotaiStore;
  const setGameStateRef = useRef(setGameState);
  setGameStateRef.current = setGameState;

  const applySession = useCallback((next: GameSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  const syncPhase = useCallback(
    (state: GameState | null, lobbyInfo: LobbyInfo | null = lobbyRef.current) => {
      const activeSession =
        clientRef.current?.getSession() ?? sessionRef.current;
      setPhase((prev) => {
        const next = resolvePhase(state, activeSession, lobbyInfo);
        return next === 'landing' ? prev : next;
      });
    },
    []
  );

  const ensureClient = useCallback(() => {
    if (clientRef.current) return clientRef.current;

    const client = new MultiplayerGameClient();
    clientRef.current = client;

    client.setStateHandler((state) => {
      setGameStateRef.current(state);
      if (
        state?.status === 'active' &&
        lobbyRef.current &&
        lobbyRef.current.status === 'lobby'
      ) {
        const updated = { ...lobbyRef.current, status: 'active' as const };
        lobbyRef.current = updated;
        setLobby(updated);
      }
      syncPhase(state);
    });

    client.setLobbyHandler((info) => {
      lobbyRef.current = info;
      setLobby(info);
      setJoinCode(info.joinCode);
      syncPhase(jotaiStoreRef.current.get(gameStateAtom), info);
    });

    return client;
  }, [syncPhase]);

  useEffect(() => {
    ensureClient();

    registerGameStateReader(() => jotaiStoreRef.current.get(gameStateAtom));
    registerRemoteDispatch(async (action) => {
      const activeClient = clientRef.current;
      if (!activeClient) {
        throw new Error('Multiplayer client not ready');
      }
      const currentState = jotaiStoreRef.current.get(gameStateAtom);
      return activeClient.dispatchAction(currentState, action);
    });

    return () => {
      registerGameStateReader(null);
      registerRemoteDispatch(null);
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, [ensureClient]);

  useEffect(() => {
    if (phase !== 'lobby' || !session || session.gameId === 'local') return;

    const client = clientRef.current;
    if (!client) return;

    const refreshLobby = () => {
      client
        .fetchLobby()
        .then((info) => {
          lobbyRef.current = info;
          setLobby(info);
          setJoinCode(info.joinCode);
        })
        .catch(() => {});
    };

    refreshLobby();
    const intervalId = setInterval(refreshLobby, 2000);
    return () => clearInterval(intervalId);
  }, [phase, session?.gameId]);

  const runOnline = useCallback(
    async (fn: (client: MultiplayerGameClient) => Promise<GameSession>) => {
      const client = ensureClient();
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
        applySession(onlineSession);
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
    [applySession, ensureClient, setGameState, setLocalPlayerKey, setMeta]
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
    const client = ensureClient();
    setLoading(true);
    setError(null);
    try {
      client.disconnect();
      lobbyRef.current = null;

      const localSession: GameSession = {
        gameId: 'local',
        joinCode: 'LOCAL',
        playerKey: 'player_1',
        playerId: 'player_1',
        isHost: true,
      };
      applySession(localSession);

      const state = await client.connectLocal(displayName.trim());
      if (state.status !== 'active' || state.players.length === 0) {
        throw new Error('Practice game failed to initialize');
      }
      setLocalPlayerKey('player_1');
      setLobby(null);
      setJoinCode('LOCAL');
      setMeta({ online: false, joinCode: 'LOCAL', error: null });
      setGameState(state);
      setPhase('game');
      setStatus(client.getStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start practice');
      setPhase('landing');
      applySession(null);
    } finally {
      setLoading(false);
    }
  }, [applySession, ensureClient, setGameState, setLocalPlayerKey, setMeta]);

  const updateMaxPlayers = useCallback(async (maxPlayers: number) => {
    const client = ensureClient();
    if (!session?.isHost) return;
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
  }, [ensureClient, session]);

  const startGame = useCallback(async () => {
    const client = ensureClient();
    if (!session?.isHost || session.gameId === 'local') return;
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
  }, [ensureClient, session, lobby, setGameState]);

  const leaveToLanding = useCallback(() => {
    clientRef.current?.disconnect();
    lobbyRef.current = null;
    applySession(null);
    setLobby(null);
    setJoinCode('');
    setError(null);
    setPhase('landing');
    setStatus('disconnected');
    setLocalPlayerKey('player_1');
    setGameState(createLobbyGameState('pending', []));
    setMeta({ online: false, joinCode: '', error: null });
  }, [applySession, setGameState, setLocalPlayerKey, setMeta]);

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
