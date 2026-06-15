import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV, isSupabaseConfigured } from './env';

export interface DbGame {
  id: string;
  join_code: string;
  status: 'lobby' | 'active' | 'finished';
  max_players: number;
  state: unknown;
  version: number;
  turn_player_id: string | null;
  phase: string | null;
  turn_number: number;
  host_player_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbGamePlayer {
  id: string;
  game_id: string;
  player_key: string;
  seat_index: number;
  display_name: string;
  is_ai: boolean;
  is_host: boolean;
  session_id: string | null;
  created_at: string;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_ANON_KEY in .env'
    );
  }
  if (!client) {
    client = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

export function tryGetSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return getSupabase();
}
