// The one place that decides which tier unlocks what (brief: "gate features through one
// entitlements helper"). The tier comes from public.subscriptions, which only the server
// writes from RevenueCat; Edge Functions check it again before any AI call.

export type Tier = 'free' | 'pro' | 'elite';

export type Feature =
  | 'ai_coach' // coach chat
  | 'scan_photo' // read InBody sheets from a photo; program from InBody
  | 'meal_plans' // carb cycle targets and meal plans (Food tab)
  | 'meal_ai' // meal logging by photo or text
  | 'coach_review'; // monthly review by a human coach (later phase)

const FEATURES: Record<Tier, readonly Feature[]> = {
  free: [],
  pro: ['ai_coach', 'scan_photo', 'meal_plans', 'meal_ai'],
  elite: ['ai_coach', 'scan_photo', 'meal_plans', 'meal_ai', 'coach_review'],
};

export const can = (tier: Tier, feature: Feature) => FEATURES[tier].includes(feature);

export interface SubscriptionRow {
  tier: Tier;
  status: string;
  is_trial: boolean;
  current_period_ends_at: string | null;
  will_renew: boolean;
  management_url: string | null;
}

/** Effective tier: a paid period that has ended counts as free (mirrors public.current_tier). */
export function effectiveTier(
  row: Pick<SubscriptionRow, 'tier' | 'current_period_ends_at'> | null,
  now = new Date(),
): Tier {
  if (!row || row.tier === 'free') return 'free';
  if (row.current_period_ends_at && new Date(row.current_period_ends_at) <= now) return 'free';
  return row.tier;
}
