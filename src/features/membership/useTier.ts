import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export type Tier = 'free' | 'pro' | 'elite';

/** Effective tier: a paid period that has ended counts as free (mirrors public.current_tier). */
export function effectiveTier(
  row: { tier: Tier; current_period_ends_at: string | null } | null,
  now = new Date(),
): Tier {
  if (!row || row.tier === 'free') return 'free';
  if (row.current_period_ends_at && new Date(row.current_period_ends_at) <= now) return 'free';
  return row.tier;
}

/**
 * The member's tier, for showing or hiding paid features. Display only: the Edge Functions
 * check the tier again on the server before any AI call.
 */
export function useTier() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const query = useQuery({
    queryKey: ['subscription', uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier, current_period_ends_at')
        .eq('user_id', uid!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const tier = effectiveTier(query.data ?? null);
  return { tier, isPaid: tier !== 'free', isLoading: query.isPending };
}
