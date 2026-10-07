import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { activePlanKey, profileKey, type ActivePlan } from '@/features/profile/api';
import { supabase } from '@/lib/supabase';

import { buildRescanPayload, type BodyScan, type RescanDraft } from './rescan';

export const scansKey = (uid: string | undefined) => ['scans', uid] as const;

const num = (v: number | string | null) => (v == null ? null : Number(v));

/** Every body scan the member has saved, oldest first. */
export function useScans() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: scansKey(uid),
    enabled: !!uid,
    queryFn: async (): Promise<BodyScan[]> => {
      const { data, error } = await supabase
        .from('body_scans')
        .select('id, scanned_on, source, weight_kg, body_fat_pct, skeletal_muscle_kg, bmr_kcal')
        .eq('user_id', uid!)
        .order('scanned_on', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        scannedOn: r.scanned_on,
        source: r.source,
        weightKg: num(r.weight_kg),
        bodyFatPct: num(r.body_fat_pct),
        skeletalMuscleKg: num(r.skeletal_muscle_kg),
        bmrKcal: num(r.bmr_kcal),
      }));
    },
  });
}

/** Saves a rescan and switches to the plan rebuilt from it, keeping all history. */
export function useRecordScan() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ current, draft }: { current: ActivePlan; draft: RescanDraft }) => {
      const { args } = buildRescanPayload(current.input, draft);
      const { data, error } = await supabase.rpc('record_scan', args);
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: scansKey(uid) }),
        queryClient.invalidateQueries({ queryKey: activePlanKey(uid) }),
        queryClient.invalidateQueries({ queryKey: profileKey(uid) }),
      ]),
  });
}
