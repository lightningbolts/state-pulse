import { STATE_MAP, STATE_NAMES } from '@/types/geo';

export const USER_STATE_STORAGE_KEY = 'statepulse-user-state';

export function resolveStateName(state?: string | null): string | null {
  if (!state) return null;
  if (STATE_MAP[state]) return state;
  const fromAbbr = STATE_NAMES[state.toUpperCase()];
  if (fromAbbr) return fromAbbr;
  return state;
}

export function getStoredUserState(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(USER_STATE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredUserState(state: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(USER_STATE_STORAGE_KEY, state);
  } catch {
    // ignore storage errors
  }
}
