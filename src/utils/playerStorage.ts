import { Platform } from 'react-native';

const NICKNAME_COOKIE = 'bl_nickname';
const SESSION_ID_KEY = 'bl_session_id_v1';
const GAME_SESSION_KEY = 'bl_game_session_v1';
const COOKIE_MAX_AGE_DAYS = 365;

export type SavedGameSession = {
  gameId: string;
  joinCode: string;
  playerKey: string;
  playerId: string;
  isHost: boolean;
  displayName: string;
};

let memoryNickname: string | null = null;
let memorySessionId: string | null = null;
let memoryGameSession: SavedGameSession | null = null;

function isWebStorage(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

function readCookie(name: string): string | null {
  if (!isWebStorage()) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (!isWebStorage()) return;
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function readLocal(key: string): string | null {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
}

function writeLocal(key: string, value: string): void {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

function removeLocal(key: string): void {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
  }
}

export function getStoredNickname(): string | null {
  if (memoryNickname) return memoryNickname;
  const fromCookie = readCookie(NICKNAME_COOKIE);
  if (fromCookie) {
    memoryNickname = fromCookie;
    return fromCookie;
  }
  return null;
}

export function setStoredNickname(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  memoryNickname = trimmed;
  writeCookie(NICKNAME_COOKIE, trimmed);
}

export function getOrCreateSessionId(): string {
  if (memorySessionId) return memorySessionId;
  const stored = readLocal(SESSION_ID_KEY);
  if (stored) {
    memorySessionId = stored;
    return stored;
  }
  const created = `sess_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  memorySessionId = created;
  writeLocal(SESSION_ID_KEY, created);
  return created;
}

export function getSavedGameSession(): SavedGameSession | null {
  if (memoryGameSession) return memoryGameSession;
  const raw = readLocal(GAME_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedGameSession;
    if (parsed?.gameId && parsed?.joinCode && parsed?.playerKey) {
      memoryGameSession = parsed;
      return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

export function saveGameSession(session: SavedGameSession): void {
  memoryGameSession = session;
  writeLocal(GAME_SESSION_KEY, JSON.stringify(session));
  setStoredNickname(session.displayName);
}

export function clearSavedGameSession(): void {
  memoryGameSession = null;
  removeLocal(GAME_SESSION_KEY);
}
