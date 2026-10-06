import { base64ToBytes, MAX_PHOTO_BYTES, PhotoError, uploadPhoto } from '../photos';

const mockUpload = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ upload: (...a: unknown[]) => mockUpload(...a) }) } },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));

beforeEach(() => mockUpload.mockReset().mockResolvedValue({ error: null }));

describe('photos', () => {
  it('decodes base64', () => {
    expect(Array.from(base64ToBytes('UmFmaXE='))).toEqual([82, 97, 102, 105, 113]);
  });

  it('uploads into the member’s folder as JPEG', async () => {
    await expect(uploadPhoto('meal-photos', 'user-1', 'UmFmaXE=')).resolves.toBe(
      'user-1/uuid-1.jpg',
    );
    const [path, bytes, opts] = mockUpload.mock.calls[0];
    expect(path).toBe('user-1/uuid-1.jpg');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(opts).toEqual({ contentType: 'image/jpeg' });
  });

  it('refuses photos over the size limit before uploading', async () => {
    const big = btoa('x'.repeat(MAX_PHOTO_BYTES + 3));
    await expect(uploadPhoto('scan-photos', 'u', big)).rejects.toEqual(new PhotoError('too_large'));
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('reports upload failures', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'denied' } });
    await expect(uploadPhoto('scan-photos', 'u', 'UmFmaXE=')).rejects.toEqual(
      new PhotoError('upload'),
    );
  });
});
