import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { weekdayIndex, type Checkin } from '@/features/plan/engine';
import { profileKey, useActivePlan, useProfile } from '@/features/profile/api';
import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

import {
  DEFAULT_RAMADAN,
  DEFAULT_SCHEDULE,
  localDateKey,
  normaliseTime,
  type DaySchedule,
  type RamadanTimes,
} from './timeline';

export interface DailyLog {
  checkin: (Checkin & { score: number }) | null;
  readiness_score: number | null;
  water_glasses: number;
  completed_items: string[];
}

export const emptyDailyLog: DailyLog = {
  checkin: null,
  readiness_score: null,
  water_glasses: 0,
  completed_items: [],
};

export const dailyLogKey = (uid: string | undefined, date: string) =>
  ['daily_log', uid, date] as const;

/** Today's date key, refreshed when the app returns to the foreground (e.g. after midnight). */
export function useTodayKey() {
  const [key, setKey] = useState(() => localDateKey(new Date()));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setKey(localDateKey(new Date()));
    });
    return () => sub.remove();
  }, []);
  return key;
}

export function useDailyLog(date: string) {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: dailyLogKey(uid, date),
    enabled: !!uid,
    queryFn: async (): Promise<DailyLog> => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('checkin, readiness_score, water_glasses, completed_items')
        .eq('user_id', uid!)
        .eq('log_date', date)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...emptyDailyLog, ...(data as unknown as DailyLog) } : emptyDailyLog;
    },
  });
}

/** Patches today's log (creating it if needed), updating the screen before the server replies. */
export function useUpdateDailyLog(date: string) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const queryClient = useQueryClient();
  const key = dailyLogKey(uid, date);

  return useMutation({
    mutationFn: async (patch: Partial<DailyLog>) => {
      // The cache already holds the optimistic state (including earlier quick taps), so
      // send the whole row rather than only this patch.
      const merged = { ...(queryClient.getQueryData<DailyLog>(key) ?? emptyDailyLog), ...patch };
      const { error } = await supabase
        .from('daily_logs')
        .upsert(
          { user_id: uid!, log_date: date, ...merged, checkin: merged.checkin as unknown as Json },
          { onConflict: 'user_id,log_date' },
        );
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DailyLog>(key);
      queryClient.setQueryData<DailyLog>(key, { ...(previous ?? emptyDailyLog), ...patch });
      return { previous };
    },
    onError: (_e, _patch, ctx) => queryClient.setQueryData(key, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

const timeOr = (raw: string | null | undefined, fallback: string) =>
  (raw && normaliseTime(raw)) || fallback;

/** The member's schedule and Ramadan setting, with defaults while loading. */
export function useSchedule(): {
  schedule: DaySchedule;
  ramadan: boolean;
  ramadanTimes: RamadanTimes;
} {
  const { data } = useProfile();
  return {
    schedule: {
      wakeTime: (data?.wake_time && normaliseTime(data.wake_time)) || DEFAULT_SCHEDULE.wakeTime,
      workoutTime:
        (data?.workout_time && normaliseTime(data.workout_time)) || DEFAULT_SCHEDULE.workoutTime,
    },
    ramadan: !!data?.ramadan_mode,
    ramadanTimes: {
      suhoorTime: timeOr(data?.suhoor_time, DEFAULT_RAMADAN.suhoorTime),
      iftarTime: timeOr(data?.iftar_time, DEFAULT_RAMADAN.iftarTime),
    },
  };
}

/** Turns Ramadan mode on or off and/or saves the suhoor and iftar times. */
export function useUpdateRamadan() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const queryClient = useQueryClient();
  const key = profileKey(uid);
  type Patch = { ramadan_mode?: boolean; suhoor_time?: string; iftar_time?: string };
  return useMutation({
    mutationFn: async (patch: Patch) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', uid!);
      if (error) throw error;
    },
    // The switch flips at once; it goes back if the save fails.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: object | undefined) =>
        old ? { ...old, ...patch } : old,
      );
      return { previous };
    },
    onError: (_e, _patch, ctx) => queryClient.setQueryData(key, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateSchedule() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schedule: DaySchedule) => {
      const { error } = await supabase
        .from('profiles')
        .update({ wake_time: schedule.wakeTime, workout_time: schedule.workoutTime })
        .eq('id', uid!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey(uid) }),
  });
}

/** Everything a daily screen needs about "today". */
export function useToday() {
  const dateKey = useTodayKey();
  const plan = useActivePlan();
  const { schedule, ramadan, ramadanTimes } = useSchedule();
  const log = useDailyLog(dateKey);
  const [y, m, d] = dateKey.split('-').map(Number);
  const todayIndex = weekdayIndex(new Date(y, m - 1, d));
  /** What buildTimeline() takes: the fasting times in Ramadan, otherwise false. */
  const fasting = ramadan ? ramadanTimes : (false as const);
  return { dateKey, todayIndex, plan, schedule, ramadan, fasting, log };
}
