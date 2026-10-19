import { createContext, useContext, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'sphoto.adminKey';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function setAdminKey(key: string): void {
  sessionStorage.setItem(STORAGE_KEY, key);
  notify();
}

export function clearAdminKey(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdminKey(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

// The admin layout only renders its children once a key is present and provides it here.
export const AdminKeyContext = createContext<string | null>(null);

export function useAdminSessionKey(): string {
  const key = useContext(AdminKeyContext);
  if (key === null) throw new Error('useAdminSessionKey must be used inside the admin layout');
  return key;
}
