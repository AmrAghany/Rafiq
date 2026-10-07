import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { dailyLogKey, useTodayKey } from '@/features/today/api';
import { useSettings } from '@/stores/settings';

import { healthSource } from './source';
import { shouldSync } from './summary';
import { readHealthDay, saveHealthDay } from './sync';

/**
 * While Health is connected, reads last night's sleep and today's steps when the app
 * opens and again when it comes back to the foreground (at most every 15 minutes).
 */
export function useHealthSync() {
  const enabled = useSettings((s) => s.healthEnabled);
  const uid = useAuth().session?.user.id;
  const dateKey = useTodayKey();
  const queryClient = useQueryClient();
  const lastSync = useRef<number | null>(null);

  useEffect(() => {
    const source = healthSource();
    if (!enabled || !uid || !source) return;
    let cancelled = false;
    lastSync.current = null;

    const run = async () => {
      if (!shouldSync(lastSync.current, Date.now())) return;
      lastSync.current = Date.now();
      const reading = await readHealthDay(source, dateKey, new Date());
      if (cancelled) return;
      if (await saveHealthDay(uid, dateKey, reading, source.provider)) {
        await queryClient.invalidateQueries({ queryKey: dailyLogKey(uid, dateKey) });
      }
    };
    // Best-effort: the app works the same without Health data.
    const attempt = () => void run().catch(() => undefined);

    attempt();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') attempt();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [enabled, uid, dateKey, queryClient]);
}
