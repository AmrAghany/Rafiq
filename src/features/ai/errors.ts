/** Error codes returned by the Edge Functions (supabase/functions/_shared/http.ts). */
export type AiErrorCode =
  | 'unauthorized'
  | 'bad_request'
  | 'payload_too_large'
  | 'upgrade_required'
  | 'quota_exceeded'
  | 'not_found'
  | 'ai_refused'
  | 'ai_unavailable'
  | 'network'
  | 'internal';

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    public detail?: Record<string, unknown>,
  ) {
    super(code);
  }
}

const KNOWN: AiErrorCode[] = [
  'unauthorized',
  'bad_request',
  'payload_too_large',
  'upgrade_required',
  'quota_exceeded',
  'not_found',
  'ai_refused',
  'ai_unavailable',
  'internal',
];

export function toAiError(code: unknown, detail?: Record<string, unknown>): AiError {
  return new AiError(
    KNOWN.includes(code as AiErrorCode) ? (code as AiErrorCode) : 'internal',
    detail,
  );
}
