import { fetch as streamingFetch } from 'expo/fetch';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

import { AiError, toAiError } from './errors';
import { parseSse } from './sse';

const functionUrl = (name: string) => `${env.supabaseUrl}/functions/v1/${name}`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AiError('unauthorized');
  return {
    Authorization: `Bearer ${token}`,
    apikey: env.supabaseAnonKey,
    'Content-Type': 'application/json',
  };
}

async function errorFrom(res: { json(): Promise<unknown> }): Promise<AiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string } & Record<string, unknown> };
    return toAiError(body.error?.code, body.error);
  } catch {
    return new AiError('internal');
  }
}

/** Calls a JSON Edge Function. Throws AiError with the server's code on failure. */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  let res: Response;
  try {
    res = await fetch(functionUrl(name), { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    throw new AiError('network');
  }
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
}

export interface CoachRequest {
  message: string;
  localDate: string;
  localTime: string;
}

/**
 * Sends a message to the coach and calls onDelta with each piece of the reply as it
 * streams in. Resolves with the saved message id. Abort with the signal to stop.
 */
export async function streamCoach(
  request: CoachRequest,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<{ id: string | null }> {
  const headers = await authHeaders();
  let res;
  try {
    res = await streamingFetch(functionUrl('coach-chat'), {
      method: 'POST',
      headers: { ...headers, Accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new AiError('network');
  }
  if (!res.ok) throw await errorFrom(res);
  if (!res.body) throw new AiError('internal');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSse(buffer);
    buffer = parsed.rest;
    for (const { event, data } of parsed.events) {
      const d = data as { text?: string; id?: string | null; code?: string };
      if (event === 'delta' && d.text) onDelta(d.text);
      else if (event === 'done') return { id: d.id ?? null };
      else if (event === 'error') throw toAiError(d.code);
    }
  }
  throw new AiError('ai_unavailable');
}
