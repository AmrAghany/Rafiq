// POST /delete-account { confirm: "DELETE" }
// Removes the member's photos from Storage, then deletes the auth user. Every table row
// cascades from auth.users, so this deletes all of their data.

import { authenticate, type Deps } from '../_shared/context.ts';
import { HttpError, json, readJson, route } from '../_shared/http.ts';

const BUCKETS = ['scan-photos', 'meal-photos'] as const;

export function createHandler(deps: Deps) {
  return route('POST', async (req) => {
    const { user } = await authenticate(req, deps);
    const body = await readJson(req);
    if (body.confirm !== 'DELETE') throw new HttpError('bad_request', { reason: 'confirm' });

    const service = deps.serviceClient();
    for (const bucket of BUCKETS) {
      // Paginate in case a member has many photos.
      for (;;) {
        const { data, error } = await service.storage.from(bucket).list(user.id, { limit: 100 });
        if (error) throw new HttpError('internal');
        if (!data?.length) break;
        const { error: removeError } = await service.storage
          .from(bucket)
          .remove(data.map((f) => `${user.id}/${f.name}`));
        if (removeError) throw new HttpError('internal');
      }
    }

    // Remove the member's purchase history from RevenueCat too (best effort; this does not
    // cancel a store subscription, which only the member can do in their store settings).
    try {
      await deps.revenuecat()?.deleteSubscriber(user.id);
    } catch {
      console.error('revenuecat_delete_failed');
    }

    const { error } = await service.auth.admin.deleteUser(user.id);
    if (error) throw new HttpError('internal');
    return json({ deleted: true });
  });
}
