import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

import type { ExerciseSession } from './progression';
import { SESSION_COLUMNS } from './queries';

export interface SetLog {
  id?: string;
  exercise_key: string;
  swapped_from_key: string | null;
  set_number: number;
  target_reps: number | null;
  target_weight_kg: number | null;
  actual_reps: number | null;
  actual_weight_kg: number | null;
  completed: boolean;
  /** 'station' when a partner smart station logged the set. */
  source?: 'app' | 'station';
}

export interface WorkoutSession {
  id: string;
  workout_key: string;
  log_date: string;
  readiness_score: number | null;
  completed_at: string | null;
  swaps: Record<string, string>;
  set_logs: SetLog[];
}

export const sessionKey = (uid: string | undefined, date: string, workoutKey: string | null) =>
  ['session', uid, date, workoutKey] as const;
export const historyKey = (uid: string | undefined) => ['history', uid] as const;

export function useTodaySession(
  date: string,
  workoutKey: string | null,
  /** While paired with a smart station, sets arrive from the server: poll for them. */
  { poll = false }: { poll?: boolean } = {},
) {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: sessionKey(uid, date, workoutKey),
    enabled: !!uid && !!workoutKey,
    refetchInterval: poll ? 10_000 : false,
    queryFn: async (): Promise<WorkoutSession | null> => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(SESSION_COLUMNS)
        .eq('user_id', uid!)
        .eq('log_date', date)
        .eq('workout_key', workoutKey!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as WorkoutSession) ?? null;
    },
  });
}

/** Past sessions (not today), newest first, with their sets. */
export function useWorkoutHistory(today: string, limit = 60) {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: [...historyKey(uid), today, limit],
    enabled: !!uid,
    queryFn: async (): Promise<WorkoutSession[]> => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(SESSION_COLUMNS)
        .eq('user_id', uid!)
        .lt('log_date', today)
        .order('log_date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as unknown as WorkoutSession[]) ?? [];
    },
  });
}

/** Per-exercise history (newest first) from past sessions, for progression. */
export function exerciseHistory(
  sessions: readonly WorkoutSession[],
): Record<string, ExerciseSession[]> {
  const byExercise: Record<string, ExerciseSession[]> = {};
  for (const s of sessions) {
    const groups: Record<string, ExerciseSession> = {};
    for (const set of s.set_logs) {
      groups[set.exercise_key] ??= { date: s.log_date, sets: [] };
      groups[set.exercise_key].sets.push({
        setNumber: set.set_number,
        targetReps: set.target_reps,
        actualReps: set.actual_reps,
        actualWeightKg: set.actual_weight_kg,
        completed: set.completed,
      });
    }
    for (const [key, group] of Object.entries(groups)) {
      group.sets.sort((a, b) => a.setNumber - b.setNumber);
      (byExercise[key] ??= []).push(group);
    }
  }
  return byExercise;
}

interface SessionContext {
  date: string;
  workoutKey: string;
  planId: string | null;
  readinessScore: number | null;
}

/**
 * Mutations on today's session. The session row is created on the first logged set,
 * so opening the Train tab alone never writes anything.
 */
export function useSessionActions(ctx: SessionContext) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const queryClient = useQueryClient();
  const key = sessionKey(uid, ctx.date, ctx.workoutKey);

  async function ensureSession(): Promise<WorkoutSession> {
    const cached = queryClient.getQueryData<WorkoutSession | null>(key);
    if (cached?.id) return cached;
    const { data, error } = await supabase
      .from('workout_sessions')
      .upsert(
        {
          user_id: uid!,
          log_date: ctx.date,
          workout_key: ctx.workoutKey,
          plan_id: ctx.planId,
          readiness_score: ctx.readinessScore,
        },
        { onConflict: 'user_id,log_date,workout_key' },
      )
      .select(SESSION_COLUMNS)
      .single();
    if (error) throw error;
    const created = data as unknown as WorkoutSession;
    // Keep optimistic sets and swaps already on screen; the refetch afterwards reconciles.
    queryClient.setQueryData<WorkoutSession | null>(key, (prev) => ({
      ...created,
      set_logs: prev?.set_logs ?? created.set_logs,
      swaps: prev?.swaps ?? created.swaps,
    }));
    return created;
  }

  const optimistic = async (update: (s: WorkoutSession) => WorkoutSession) => {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<WorkoutSession | null>(key) ?? null;
    const base: WorkoutSession = previous ?? {
      id: '',
      workout_key: ctx.workoutKey,
      log_date: ctx.date,
      readiness_score: ctx.readinessScore,
      completed_at: null,
      swaps: {},
      set_logs: [],
    };
    queryClient.setQueryData(key, update(base));
    return { previous };
  };
  const rollback = (_e: unknown, _v: unknown, c?: { previous: WorkoutSession | null }) =>
    queryClient.setQueryData(key, c?.previous ?? null);
  const settle = () => queryClient.invalidateQueries({ queryKey: key });

  const saveSet = useMutation({
    mutationFn: async (set: SetLog) => {
      const s = await ensureSession();
      const { error } = await supabase.from('set_logs').upsert(
        {
          session_id: s.id,
          user_id: uid!,
          exercise_key: set.exercise_key,
          swapped_from_key: set.swapped_from_key,
          set_number: set.set_number,
          target_reps: set.target_reps,
          target_weight_kg: set.target_weight_kg,
          actual_reps: set.actual_reps,
          actual_weight_kg: set.actual_weight_kg,
          completed: set.completed,
          completed_at: set.completed ? new Date().toISOString() : null,
        },
        { onConflict: 'session_id,exercise_key,set_number' },
      );
      if (error) throw error;
    },
    onMutate: (set) =>
      optimistic((s) => ({
        ...s,
        set_logs: [
          ...s.set_logs.filter(
            (x) => !(x.exercise_key === set.exercise_key && x.set_number === set.set_number),
          ),
          set,
        ],
      })),
    onError: rollback,
    onSettled: settle,
  });

  const setSwaps = useMutation({
    mutationFn: async (swaps: Record<string, string>) => {
      const s = await ensureSession();
      const { error } = await supabase.from('workout_sessions').update({ swaps }).eq('id', s.id);
      if (error) throw error;
    },
    onMutate: (swaps) => optimistic((s) => ({ ...s, swaps })),
    onError: rollback,
    onSettled: settle,
  });

  const complete = useMutation({
    mutationFn: async () => {
      const s = await ensureSession();
      const { error } = await supabase
        .from('workout_sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', s.id);
      if (error) throw error;
    },
    onMutate: () => optimistic((s) => ({ ...s, completed_at: new Date().toISOString() })),
    onError: rollback,
    onSettled: () => {
      void settle();
      void queryClient.invalidateQueries({ queryKey: historyKey(uid) });
    },
  });

  return { saveSet, setSwaps, complete };
}
