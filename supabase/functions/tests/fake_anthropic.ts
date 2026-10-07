// A minimal stand-in for the Messages API (non-streaming JSON and streaming SSE), so the
// functions can be tested end to end without a real key or network access.

export type FakeReply =
  | { kind: 'text'; text: string; stopReason?: 'end_turn' | 'max_tokens' | 'refusal' }
  | { kind: 'error'; status: number };

export interface RecordedRequest {
  path: string;
  headers: Headers;
  body: Record<string, unknown>;
}

export function startFakeAnthropic() {
  const requests: RecordedRequest[] = [];
  const queue: FakeReply[] = [];
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen() {} }, async (req) => {
    const url = new URL(req.url);
    const body = await req.json();
    requests.push({ path: url.pathname + url.search, headers: req.headers, body });
    const reply = queue.shift() ?? { kind: 'text', text: 'ok' };
    if (reply.kind === 'error') {
      return Response.json(
        { type: 'error', error: { type: 'api_error', message: 'fake' } },
        { status: reply.status },
      );
    }
    const stopReason = reply.stopReason ?? 'end_turn';
    const message = {
      id: 'msg_fake',
      type: 'message',
      role: 'assistant',
      model: body.model,
      content: stopReason === 'refusal' ? [] : [{ type: 'text', text: reply.text }],
      stop_reason: stopReason,
      stop_sequence: null,
      usage: { input_tokens: 120, output_tokens: 30 },
    };
    if (!body.stream) return Response.json(message);

    const events: [string, unknown][] = [
      [
        'message_start',
        {
          type: 'message_start',
          message: {
            ...message,
            content: [],
            stop_reason: null,
            usage: { input_tokens: 120, output_tokens: 1 },
          },
        },
      ],
    ];
    if (stopReason !== 'refusal') {
      events.push([
        'content_block_start',
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      ]);
      // Split into a few chunks like a real stream.
      for (const chunk of reply.text.match(/.{1,8}/gs) ?? []) {
        events.push([
          'content_block_delta',
          { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: chunk } },
        ]);
      }
      events.push(['content_block_stop', { type: 'content_block_stop', index: 0 }]);
    }
    events.push([
      'message_delta',
      {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: 30 },
      },
    ]);
    events.push(['message_stop', { type: 'message_stop' }]);
    const sse = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
    return new Response(sse, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const { port } = server.addr as Deno.NetAddr;
  return {
    baseURL: `http://127.0.0.1:${port}`,
    requests,
    reply: (...replies: FakeReply[]) => queue.push(...replies),
    reset: () => {
      requests.length = 0;
      queue.length = 0;
    },
    close: () => server.shutdown(),
  };
}
