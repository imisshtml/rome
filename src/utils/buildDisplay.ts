import { BUILD_INFO } from '../buildInfo';

export function formatBuildDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatBuildLabel(): string {
  if (__DEV__) return 'DEV BUILD';
  return `build ${BUILD_INFO.commitSha} • ${formatBuildDate(BUILD_INFO.commitDate)}`;
}
