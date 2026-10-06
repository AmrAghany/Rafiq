// POST /sync-subscription
// Called by the app right after a purchase or restore so the new tier applies at once,
// without waiting for the webhook. Returns the mirrored subscription.

import { authenticate, type Deps } from '../_shared/context.ts';
import { json, route } from '../_shared/http.ts';
import { syncMember } from '../_shared/subscriptions.ts';

export function createHandler(deps: Deps) {
  return route('POST', async (req) => {
    const { user } = await authenticate(req, deps);
    const subscription = await syncMember(deps, user.id);
    return json({ subscription });
  });
}
