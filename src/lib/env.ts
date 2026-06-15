const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://jrzstndscpobuqfcpffx.supabase.co';

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyenN0bmRzY3BvYnVxZmNwZmZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NTI0NzAsImV4cCI6MjA5NzAyODQ3MH0.lZXGJmdXGQMFtlI3U8Q7Wf0X5rScdfYTiLsA1_eRXcE';

export const ENV = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  playerName: process.env.EXPO_PUBLIC_PLAYER_NAME ?? 'You',
  gameJoinCode: process.env.EXPO_PUBLIC_GAME_JOIN_CODE ?? '',
} as const;

export function isSupabaseConfigured(): boolean {
  return ENV.supabaseAnonKey.length > 0;
}
