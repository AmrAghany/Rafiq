// Tier checks and daily AI limits. The server is the only place these are enforced.

import type { Deps } from './context.ts';
import { HttpError } from './http.ts';

export type Tier = 'free' | 'pro' | 'elite';
export type AiFeature = 'coach_chat' | 'meal_estimate' | 'scan_read';

/** Requests per member per UTC day. Free has no AI features. */
export const DAILY_LIMITS: Record<Tier, Record<AiFeature, number>> = {
  free: { coach_chat: 0, meal_estimate: 0, scan_read: 0 },
  pro: { coach_chat: 50, meal_estimate: 20, scan_read: 5 },
  elite: { coach_chat: 150, meal_estimate: 50, scan_read: 10 },
};

export async function tierOf(deps: Deps, userId: string): Promise<Tier> {
  const { data, error } = await deps.serviceClient().rpc('current_tier', { p_user_id: userId });
  if (error) throw new HttpError('internal');
  return (data as Tier) ?? 'free';
}

/**
 * Checks the tier and takes one unit of today's quota. Returns a refund function to call
 * if the AI request then fails, so members aren't charged for our errors.
 */
export async function consumeQuota(
  deps: Deps,
  userId: string,
  feature: AiFeature,
): Promise<{ tier: Tier; used: number; limit: number; refund: () => Promise<void> }> {
  const tier = await tierOf(deps, userId);
  const limit = DAILY_LIMITS[tier][feature];
  if (limit <= 0) throw new HttpError('upgrade_required', { feature });

  const service = deps.serviceClient();
  const { data, error } = await service.rpc('consume_ai_quota', {
    p_user_id: userId,
    p_feature: feature,
    p_limit: limit,
  });
  if (error) throw new HttpError('internal');
  if (data == null) throw new HttpError('quota_exceeded', { feature, limit });

  return {
    tier,
    used: data as number,
    limit,
    refund: async () => {
      await service.rpc('refund_ai_quota', { p_user_id: userId, p_feature: feature });
    },
  };
}
