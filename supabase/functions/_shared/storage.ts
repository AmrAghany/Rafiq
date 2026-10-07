import type { SupabaseClient } from './deps.ts';
import { MAX_IMAGE_BYTES, mediaTypeFor, toBase64, type ImageMediaType } from './claude.ts';
import { HttpError } from './http.ts';

export type PhotoBucket = 'scan-photos' | 'meal-photos';

/**
 * Downloads a member's own photo with their RLS-scoped client. The path must be in their
 * folder ("<uid>/..."); Storage policies enforce the same rule.
 */
export async function readOwnPhoto(
  db: SupabaseClient,
  bucket: PhotoBucket,
  path: unknown,
  userId: string,
): Promise<{ data: string; mediaType: ImageMediaType; path: string }> {
  if (typeof path !== 'string' || !path.startsWith(`${userId}/`) || path.includes('..')) {
    throw new HttpError('bad_request', { reason: 'photo_path' });
  }
  const mediaType = mediaTypeFor(path);
  if (!mediaType) throw new HttpError('bad_request', { reason: 'photo_type' });
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) throw new HttpError('not_found', { reason: 'photo' });
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError('payload_too_large');
  return { data: toBase64(bytes), mediaType, path };
}
