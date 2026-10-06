// Model choices from the brief, and helpers shared by the AI functions.

import { Anthropic } from './deps.ts';
import { HttpError } from './http.ts';

/** Fast and cheap: coach chat and meal estimates. */
export const CHAT_MODEL = 'claude-haiku-4-5-20251001';
/** Reads InBody result sheets (and, later, program customisation). */
export const SCAN_MODEL = 'claude-sonnet-5-5';

/** Maps SDK errors to our codes. Never includes request or response content. */
export function aiError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (e instanceof Anthropic.APIError) {
    console.error('anthropic_error', e.status ?? 'network');
    return new HttpError('ai_unavailable');
  }
  console.error('ai_error', e instanceof Error ? e.name : typeof e);
  return new HttpError('ai_unavailable');
}

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export function mediaTypeFor(path: string): ImageMediaType | null {
  const ext = path.toLowerCase().split('.').pop();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return null;
}

/** Base64 without blowing the call stack on multi-megabyte images. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Claude's per-image limit is 5 MB of base64; keep a margin. */
export const MAX_IMAGE_BYTES = 3_500_000;
