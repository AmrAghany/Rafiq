// Stand-in for RevenueCat's v1 subscribers API.

import type { RcSubscriber } from '../_shared/revenuecat.ts';

export function startFakeRevenueCat(secret = 'sk_test') {
  const subscribers = new Map<string, RcSubscriber>();
  const deleted: string[] = [];
  const calls: string[] = [];
  let failNext = false;
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, onListen() {} }, (req) => {
    const url = new URL(req.url);
    calls.push(`${req.method} ${url.pathname}`);
    if (req.headers.get('Authorization') !== `Bearer ${secret}`)
      return new Response('unauthorized', { status: 401 });
    if (failNext) {
      failNext = false;
      return new Response('boom', { status: 500 });
    }
    const id = decodeURIComponent(url.pathname.split('/').pop()!);
    if (req.method === 'DELETE') {
      deleted.push(id);
      subscribers.delete(id);
      return Response.json({ app_user_id: id, deleted: true });
    }
    const subscriber = subscribers.get(id) ?? {
      entitlements: {},
      subscriptions: {},
      management_url: null,
    };
    return Response.json({ request_date: new Date().toISOString(), subscriber });
  });
  const { port } = server.addr as Deno.NetAddr;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    secret,
    subscribers,
    deleted,
    calls,
    failNext: () => {
      failNext = true;
    },
    close: () => server.shutdown(),
  };
}
