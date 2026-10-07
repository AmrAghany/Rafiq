// POST /revenuecat-webhook  (called by RevenueCat, not the app; deployed with --no-verify-jwt)
// Authenticated by the shared secret configured as the webhook's Authorization header.
// Each event triggers a fresh sync of the members it mentions.

import type { Deps } from '../_shared/context.ts';
import { HttpError, json, readJson, route } from '../_shared/http.ts';
import { memberIdsFromEvent, safeEqual } from '../_shared/revenuecat.ts';
import { syncMember } from '../_shared/subscriptions.ts';

export function createHandler(
  deps: Deps,
  webhookToken = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_TOKEN') ?? '',
) {
  return route('POST', async (req) => {
    const header = req.headers.get('Authorization') ?? '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : header;
    if (!webhookToken || !safeEqual(presented, webhookToken)) throw new HttpError('unauthorized');

    const body = await readJson(req, 65_536);
    const event = (body.event ?? {}) as Record<string, unknown>;
    if (event.type === 'TEST') return json({ ok: true, synced: 0 });

    const ids = memberIdsFromEvent(event);
    for (const id of ids) {
      // A non-2xx reply makes RevenueCat retry later, which is what we want if the sync fails.
      await syncMember(deps, id);
    }
    return json({ ok: true, synced: ids.length });
  });
}
