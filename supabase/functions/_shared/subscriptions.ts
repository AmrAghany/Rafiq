import type { Deps } from './context.ts';
import { HttpError } from './http.ts';
import { toSubscriptionRow, type SubscriptionRow } from './revenuecat.ts';

/**
 * Fetches the member's current state from RevenueCat and mirrors it into
 * public.subscriptions. Always reads the latest state, so webhook order doesn't matter.
 */
export async function syncMember(deps: Deps, userId: string): Promise<SubscriptionRow> {
  const rc = deps.revenuecat();
  if (!rc) throw new HttpError('internal', { reason: 'revenuecat_not_configured' });
  const now = deps.now();
  const row = toSubscriptionRow(await rc.getSubscriber(userId), now);
  const { error } = await deps
    .serviceClient()
    .from('subscriptions')
    .update({ ...row, revenuecat_app_user_id: userId, synced_at: now.toISOString() })
    .eq('user_id', userId);
  if (error) throw new HttpError('internal');
  return row;
}
