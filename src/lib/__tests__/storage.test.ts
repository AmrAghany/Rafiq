import { CHUNK_SIZE, createChunkedSecureStorage, type SecureStoreLike } from '../storage';

function fakeStore(): SecureStoreLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (k) => data.get(k) ?? null,
    setItemAsync: async (k, v) => void data.set(k, v),
    deleteItemAsync: async (k) => void data.delete(k),
  };
}

describe('createChunkedSecureStorage', () => {
  it('returns null for a missing key', async () => {
    const storage = createChunkedSecureStorage(fakeStore());
    await expect(storage.getItem('nope')).resolves.toBeNull();
  });

  it('round-trips small and empty values', async () => {
    const storage = createChunkedSecureStorage(fakeStore());
    await storage.setItem('a', 'hello');
    await storage.setItem('b', '');
    await expect(storage.getItem('a')).resolves.toBe('hello');
    await expect(storage.getItem('b')).resolves.toBe('');
  });

  it('splits values larger than the SecureStore limit into chunks', async () => {
    const store = fakeStore();
    const storage = createChunkedSecureStorage(store);
    const big = 'x'.repeat(CHUNK_SIZE * 2 + 5);
    await storage.setItem('session', big);
    await expect(storage.getItem('session')).resolves.toBe(big);
    expect(store.data.get('session.chunks')).toBe('3');
    for (const v of store.data.values()) expect(v.length).toBeLessThanOrEqual(CHUNK_SIZE);
  });

  it('removes stale chunks when a value shrinks', async () => {
    const store = fakeStore();
    const storage = createChunkedSecureStorage(store);
    await storage.setItem('k', 'y'.repeat(CHUNK_SIZE * 3));
    await storage.setItem('k', 'short');
    expect([...store.data.keys()].sort()).toEqual(['k.0', 'k.chunks']);
    await expect(storage.getItem('k')).resolves.toBe('short');
  });

  it('removeItem deletes every chunk', async () => {
    const store = fakeStore();
    const storage = createChunkedSecureStorage(store);
    await storage.setItem('k', 'z'.repeat(CHUNK_SIZE + 1));
    await storage.removeItem('k');
    expect(store.data.size).toBe(0);
    await expect(storage.getItem('k')).resolves.toBeNull();
  });

  it('treats a partially written value as missing', async () => {
    const store = fakeStore();
    const storage = createChunkedSecureStorage(store);
    await storage.setItem('k', 'q'.repeat(CHUNK_SIZE + 1));
    store.data.delete('k.1');
    await expect(storage.getItem('k')).resolves.toBeNull();
  });

  it('sanitises keys SecureStore would reject', async () => {
    const store = fakeStore();
    const storage = createChunkedSecureStorage(store);
    await storage.setItem('sb-localhost:54321-auth-token', 'v');
    expect(store.data.has('sb-localhost_54321-auth-token.0')).toBe(true);
    await expect(storage.getItem('sb-localhost:54321-auth-token')).resolves.toBe('v');
  });
});
