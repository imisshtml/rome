import { Platform } from 'react-native';

export async function copyToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;

  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
