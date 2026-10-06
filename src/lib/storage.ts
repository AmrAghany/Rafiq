import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Async key-value storage backed by the device keychain/keystore.
 *
 * SecureStore rejects values over ~2 KB, and a Supabase session (JWT plus
 * refresh token and user metadata) is often larger, so values are split into
 * chunks. On web (dev only) it falls back to localStorage.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Minimal subset of expo-secure-store used here, so it can be faked in tests. */
export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1800;

// SecureStore keys may only contain alphanumerics, ".", "-" and "_".
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');
const countKey = (key: string) => `${safeKey(key)}.chunks`;
const chunkKey = (key: string, i: number) => `${safeKey(key)}.${i}`;

export function createChunkedSecureStorage(store: SecureStoreLike): KeyValueStorage {
  async function removeItem(key: string) {
    const raw = await store.getItemAsync(countKey(key));
    const count = raw ? Number.parseInt(raw, 10) : 0;
    for (let i = 0; i < count; i++) {
      await store.deleteItemAsync(chunkKey(key, i));
    }
    await store.deleteItemAsync(countKey(key));
  }

  return {
    async getItem(key) {
      const raw = await store.getItemAsync(countKey(key));
      if (raw == null) return null;
      const count = Number.parseInt(raw, 10);
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await store.getItemAsync(chunkKey(key, i));
        // A missing chunk means a partial write; treat the value as absent.
        if (part == null) return null;
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key, value) {
      await removeItem(key);
      const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
      for (let i = 0; i < count; i++) {
        await store.setItemAsync(
          chunkKey(key, i),
          value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        );
      }
      // Written last so readers never see a count without its chunks.
      await store.setItemAsync(countKey(key), String(count));
    },
    removeItem,
  };
}

const webStorage: KeyValueStorage = {
  async getItem(key) {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  },
  async setItem(key, value) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  async removeItem(key) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

export const secureStorage: KeyValueStorage =
  Platform.OS === 'web' ? webStorage : createChunkedSecureStorage(SecureStore);
