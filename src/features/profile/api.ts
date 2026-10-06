import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';

import { useAuth } from '@/features/auth/AuthProvider';
import { buildOnboardingPayload } from '@/features/onboarding/payload';
import type { OnboardingDraft } from '@/features/onboarding/validation';
import type { Plan, PlanInput } from '@/features/plan/engine';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/stores/settings';

export const profileKey = (uid: string | undefined) => ['profile', uid] as const;
export const activePlanKey = (uid: string | undefined) => ['plan', 'active', uid] as const;

export function useProfile() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: profileKey(uid),
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, display_name, onboarding_completed_at, health_flags, wake_time, workout_time, ramadan_mode, locale',
        )
        .eq('id', uid!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export interface ActivePlan {
  id: string;
  version: number;
  createdAt: string;
  input: PlanInput;
  plan: Plan;
}

export function useActivePlan() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: activePlanKey(uid),
    enabled: !!uid,
    queryFn: async (): Promise<ActivePlan | null> => {
      const { data, error } = await supabase
        .from('plans')
        .select('id, version, created_at, inputs, plan')
        .eq('user_id', uid!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        version: data.version,
        createdAt: data.created_at,
        input: data.inputs as unknown as PlanInput,
        plan: data.plan as unknown as Plan,
      };
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const language = useSettings((s) => s.language);
  return useMutation({
    mutationFn: async (draft: OnboardingDraft) => {
      const timezone = getCalendars()[0]?.timeZone ?? 'UTC';
      const { data, error } = await supabase.rpc(
        'complete_onboarding',
        buildOnboardingPayload(draft, { locale: language, timezone }),
      );
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      const uid = session?.user.id;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKey(uid) }),
        queryClient.invalidateQueries({ queryKey: activePlanKey(uid) }),
      ]);
    },
  });
}
