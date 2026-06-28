import { ENV } from '../lib/env';
import { tryGetSupabase } from '../lib/supabase';

function sortIds(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

export async function fetchSharedTestedGalleryIds(): Promise<string[] | null> {
  const supabase = tryGetSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('gallery_tested_cards')
    .select('definition_id')
    .order('definition_id');

  if (error) {
    console.warn('[galleryTestedSync] fetch failed', error.message);
    return null;
  }

  return sortIds((data ?? []).map((row) => row.definition_id));
}

export async function syncSharedTestedGalleryIds(ids: string[]): Promise<boolean> {
  const supabase = tryGetSupabase();
  if (!supabase) return false;

  const unique = sortIds(ids);
  if (unique.length === 0) return true;

  const { error } = await supabase.from('gallery_tested_cards').upsert(
    unique.map((definition_id) => ({
      definition_id,
      marked_by: ENV.playerName,
    })),
    { onConflict: 'definition_id', ignoreDuplicates: false }
  );

  if (error) {
    console.warn('[galleryTestedSync] sync failed', error.message);
    return false;
  }
  return true;
}

export async function clearSharedTestedGalleryIds(): Promise<boolean> {
  const supabase = tryGetSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from('gallery_tested_cards')
    .delete()
    .not('definition_id', 'is', null);

  if (error) {
    console.warn('[galleryTestedSync] clear failed', error.message);
    return false;
  }
  return true;
}

export function subscribeSharedTestedGallery(
  onChange: (ids: string[]) => void
): (() => void) | null {
  const supabase = tryGetSupabase();
  if (!supabase) return null;

  const channel = supabase
    .channel('gallery_tested_cards_shared')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'gallery_tested_cards' },
      () => {
        void fetchSharedTestedGalleryIds().then((ids) => {
          if (ids) onChange(ids);
        });
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
