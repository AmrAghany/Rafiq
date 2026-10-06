// Small HTTP helpers. Error bodies carry a stable `code` the app maps to translated text.

export type ErrorCode =
  | 'method_not_allowed'
  | 'unauthorized'
  | 'bad_request'
  | 'payload_too_large'
  | 'upgrade_required'
  | 'quota_exceeded'
  | 'not_found'
  | 'ai_refused'
  | 'ai_unavailable'
  | 'internal';

const STATUS: Record<ErrorCode, number> = {
  method_not_allowed: 405,
  unauthorized: 401,
  bad_request: 400,
  payload_too_large: 413,
  upgrade_required: 402,
  quota_exceeded: 429,
  not_found: 404,
  ai_refused: 422,
  ai_unavailable: 503,
  internal: 500,
};

export class HttpError extends Error {
  constructor(
    public code: ErrorCode,
    public detail?: Record<string, unknown>,
  ) {
    super(code);
  }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

export const errorResponse = (code: ErrorCode, detail?: Record<string, unknown>) =>
  json({ error: { code, ...detail } }, STATUS[code]);

/** Parses a JSON body with a size cap (the app never sends large bodies; photos go to Storage). */
export async function readJson(req: Request, maxBytes = 16_384): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError('payload_too_large');
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError('bad_request', { reason: 'invalid_json' });
  }
}

/**
 * Wraps a handler: method check and uniform errors. Never logs request bodies, chat
 * text or images; only the error code reaches the logs.
 */
export function route(
  method: 'POST' | 'GET',
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method !== method) return errorResponse('method_not_allowed');
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return errorResponse(e.code, e.detail);
      console.error('unhandled', e instanceof Error ? e.name : typeof e);
      return errorResponse('internal');
    }
  };
}
