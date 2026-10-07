import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

import {
  can as canUse,
  effectiveTier,
  type Feature,
  type SubscriptionRow,
  type Tier,
} from './entitlements';

export type { Tier };

export const subscriptionKey = (uid: string | undefined) => ['subscription', uid] as const;

/**
 * The member's tier and what it unlocks. Display only: the server re-checks before any
 * paid action.
 */
export function useEntitlements() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: subscriptionKey(uid),
    enabled: !!uid,
    queryFn: async (): Promise<SubscriptionRow | null> => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier, status, is_trial, current_period_ends_at, will_renew, management_url')
        .eq('user_id', uid!)
        .maybeSingle();
      if (error) throw error;
      return data as SubscriptionRow | null;
    },
  });
  const row = query.data ?? null;
  const tier = effectiveTier(row);
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: subscriptionKey(uid) }),
    [queryClient, uid],
  );
  return {
    tier,
    isPaid: tier !== 'free',
    can: (feature: Feature) => canUse(tier, feature),
    subscription: tier === 'free' ? null : row,
    isLoading: query.isPending,
    refresh,
  };
}

/** @deprecated use useEntitlements */
export const useTier = useEntitlements;
