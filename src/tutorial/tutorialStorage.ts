import { Platform } from 'react-native';

const STORAGE_KEY = 'bl_tutorial_completed_v1';

let memoryCompleted = false;

export function isTutorialCompleted(): boolean {
  if (memoryCompleted) return true;
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }
  return false;
}

export function markTutorialCompleted(): void {
  memoryCompleted = true;
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, '1');
  }
}

export function resetTutorialCompleted(): void {
  memoryCompleted = false;
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
