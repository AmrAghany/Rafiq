// The smart-station contract (docs/smart-stations.md): signatures and request bodies.
// Pure apart from WebCrypto, so the simulator and tests share it.

import { safeEqual } from './revenuecat.ts';

/** Requests older or newer than this are refused, so a captured request can't be replayed later. */
export const MAX_SKEW_SECONDS = 300;

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** "v1=" + hex(HMAC-SHA256(secret, `${timestamp}.${body}`)). */
export async function signStationRequest(
  secret: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return `v1=${hex(mac)}`;
}

export type SignatureCheck = 'ok' | 'bad_signature' | 'stale_timestamp';

export async function verifyStationRequest(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
  now: Date,
): Promise<SignatureCheck> {
  if (!/^\d{9,11}$/.test(timestamp)) return 'stale_timestamp';
  if (Math.abs(now.getTime() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) {
    return 'stale_timestamp';
  }
  const expected = await signStationRequest(secret, timestamp, body);
  return safeEqual(expected, signature) ? 'ok' : 'bad_signature';
}

export type StationRequest =
  | { type: 'pairing_code' }
  | { type: 'end' }
  | {
      type: 'set';
      event_id: string;
      exercise_key: string;
      weight_kg: number;
      reps: number;
      performed_at: string | null;
    };

/** Validates a parsed body; null when it isn't one of the contract's requests. */
export function parseStationRequest(body: unknown): StationRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.type === 'pairing_code' || b.type === 'end') return { type: b.type };
  if (b.type !== 'set') return null;
  const { event_id, exercise_key, weight_kg, reps, performed_at } = b;
  if (typeof event_id !== 'string' || !/^[\w.:-]{1,100}$/.test(event_id)) {
    return null;
  }
  if (typeof exercise_key !== 'string' || !/^[a-z_]{1,60}$/.test(exercise_key)) return null;
  if (typeof weight_kg !== 'number' || !Number.isFinite(weight_kg)) return null;
  if (typeof reps !== 'number' || !Number.isInteger(reps)) return null;
  if (
    performed_at != null &&
    (typeof performed_at !== 'string' || isNaN(Date.parse(performed_at)))
  ) {
    return null;
  }
  return {
    type: 'set',
    event_id,
    exercise_key,
    weight_kg,
    reps,
    performed_at: (performed_at as string | undefined) ?? null,
  };
}
