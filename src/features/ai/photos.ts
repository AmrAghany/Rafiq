import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type PhotoSource = 'camera' | 'library';
export type PhotoBucket = 'scan-photos' | 'meal-photos';

/** Matches the server's limit (Claude accepts up to 5 MB per image as base64). */
export const MAX_PHOTO_BYTES = 3_500_000;

export class PhotoError extends Error {
  constructor(public code: 'permission' | 'too_large' | 'upload') {
    super(code);
  }
}

/** Decodes base64 without extra libraries (Hermes and Node both provide atob). */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Takes or picks a photo as compressed JPEG. Resolves null if the member cancels. */
export async function pickPhoto(
  source: PhotoSource,
): Promise<{ base64: string; uri: string } | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new PhotoError('permission');

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6,
    base64: true,
    exif: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]?.base64) return null;
  return { base64: result.assets[0].base64, uri: result.assets[0].uri };
}

/** Uploads to the member's own folder in a private bucket and returns the object path. */
export async function uploadPhoto(
  bucket: PhotoBucket,
  userId: string,
  base64: string,
): Promise<string> {
  const bytes = base64ToBytes(base64);
  if (bytes.length > MAX_PHOTO_BYTES) throw new PhotoError('too_large');
  const path = `${userId}/${Crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw new PhotoError('upload');
  return path;
}
