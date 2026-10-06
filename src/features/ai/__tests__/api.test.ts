import { callFunction, streamCoach } from '../api';
import { AiError } from '../errors';

const mockStreamingFetch = jest.fn();
jest.mock('expo/fetch', () => ({ fetch: (...a: unknown[]) => mockStreamingFetch(...a) }));
jest.mock('@/lib/env', () => ({
  env: { supabaseUrl: 'https://proj.supabase.co', supabaseAnonKey: 'anon' },
}));
let mockToken: string | null = 'jwt-1';
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: mockToken ? { access_token: mockToken } : null },
      }),
    },
  },
}));

/** A Response-like object whose body streams the given chunks. */
function streamingResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: status < 400,
    status,
    json: async () => JSON.parse(chunks.join('')),
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { value: encoder.encode(chunks[i++]), done: false }
            : { value: undefined, done: true },
      }),
    },
  };
}

const request = { message: 'hi', localDate: '2026-10-06', localTime: '09:00' };

beforeEach(() => {
  mockStreamingFetch.mockReset();
  mockToken = 'jwt-1';
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('streamCoach', () => {
  it('posts to the function with the member’s token and streams deltas', async () => {
    mockStreamingFetch.mockResolvedValue(
      streamingResponse([
        'event: delta\ndata: {"text":"Swap "}\n\nevent: del',
        'ta\ndata: {"text":"for leg press"}\n\n',
        'event: done\ndata: {"id":"m9"}\n\n',
      ]),
    );
    const deltas: string[] = [];
    await expect(streamCoach(request, (d) => deltas.push(d))).resolves.toEqual({ id: 'm9' });
    expect(deltas.join('')).toBe('Swap for leg press');
    const [url, init] = mockStreamingFetch.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/functions/v1/coach-chat');
    expect(init.headers.Authorization).toBe('Bearer jwt-1');
    expect(init.headers.apikey).toBe('anon');
    expect(JSON.parse(init.body)).toEqual(request);
  });

  it('turns an error event into an AiError', async () => {
    mockStreamingFetch.mockResolvedValue(
      streamingResponse(['event: error\ndata: {"code":"ai_refused"}\n\n']),
    );
    await expect(streamCoach(request, () => {})).rejects.toEqual(new AiError('ai_refused'));
  });

  it('reads the error code from a failed response', async () => {
    mockStreamingFetch.mockResolvedValue(
      streamingResponse([JSON.stringify({ error: { code: 'quota_exceeded', limit: 50 } })], 429),
    );
    const err = await streamCoach(request, () => {}).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe('quota_exceeded');
    expect(err.detail.limit).toBe(50);
  });

  it('reports a dropped stream and missing sign-in', async () => {
    mockStreamingFetch.mockResolvedValue(
      streamingResponse(['event: delta\ndata: {"text":"Hi"}\n\n']),
    );
    await expect(streamCoach(request, () => {})).rejects.toEqual(new AiError('ai_unavailable'));
    mockStreamingFetch.mockRejectedValue(new TypeError('Network request failed'));
    await expect(streamCoach(request, () => {})).rejects.toEqual(new AiError('network'));
    mockToken = null;
    await expect(streamCoach(request, () => {})).rejects.toEqual(new AiError('unauthorized'));
  });
});

describe('callFunction', () => {
  it('returns JSON and maps error codes', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ estimate: null }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { code: 'upgrade_required' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { code: 'something_new' } }),
      });
    await expect(callFunction('meal-estimate', { text: 'x' })).resolves.toEqual({ estimate: null });
    await expect(callFunction('meal-estimate', {})).rejects.toEqual(
      new AiError('upgrade_required'),
    );
    await expect(callFunction('meal-estimate', {})).rejects.toEqual(new AiError('internal'));
  });
});
