import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { BUILD_INFO } from '../buildInfo';

const POLL_MS = 5 * 60 * 1000;

/** Web only: true when live `/build-meta.json` is a newer commit than this bundle. */
export function useWebAppUpdateAvailable(): boolean {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || stale) return;

    const localSha = BUILD_INFO.commitShaFull;
    if (!localSha || localSha.length < 7) return;
    const shortSha: string = BUILD_INFO.commitSha;
    if (shortSha === 'dev') return;

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/build-meta.json?cb=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { commitShaFull?: string };
        const remote = data.commitShaFull;
        if (remote && remote.length >= 7 && remote !== localSha) {
          setStale(true);
        }
      } catch {
        /* offline or dev server without public copy */
      }
    };

    void check();
    const interval = setInterval(check, POLL_MS);

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });

    const onVis =
      typeof document !== 'undefined'
        ? () => {
            if (document.visibilityState === 'visible') void check();
          }
        : null;
    if (onVis) document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
      if (onVis) document.removeEventListener('visibilitychange', onVis);
    };
  }, [stale]);

  return stale;
}
