import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export interface StationPairing {
  station_id: string;
  label: string;
  gym_name: string;
  exercise_keys: string[];
  ends_at: string;
}

export const pairingKey = (uid: string | undefined) => ['station_pairing', uid] as const;

/** The smart station the member is paired with right now, if any. */
export function useStationPairing({ enabled = true }: { enabled?: boolean } = {}) {
  const uid = useAuth().session?.user.id;
  return useQuery({
    queryKey: pairingKey(uid),
    enabled: !!uid && enabled,
    // A pairing ends on its own after 20 idle minutes, or when the station logs out.
    refetchInterval: (q) => (q.state.data ? 30_000 : false),
    queryFn: async (): Promise<StationPairing | null> => {
      const { data, error } = await supabase.rpc('my_station_pairing');
      if (error) throw error;
      return (data as unknown as StationPairing | null) ?? null;
    },
  });
}

export type PairError = 'invalid_code' | 'failed';

/** "123 456", "١٢٣٤٥٦" or "123456" → "123456"; null unless it's 6 digits. */
export function normaliseCode(raw: string): string | null {
  const digits = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s-]/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

export function usePairStation() {
  const uid = useAuth().session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('pair_station', { p_code: code });
      if (error) throw new Error(error.message === 'invalid_code' ? 'invalid_code' : 'failed');
      return data as unknown as StationPairing;
    },
    onSuccess: (pairing) => queryClient.setQueryData(pairingKey(uid), pairing),
  });
}

export function useEndPairing() {
  const uid = useAuth().session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('end_station_pairing');
      if (error) throw error;
    },
    onSuccess: () => queryClient.setQueryData(pairingKey(uid), null),
  });
}
