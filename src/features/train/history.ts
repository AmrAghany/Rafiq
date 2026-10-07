import type { WorkoutSession } from './api';

/** Heaviest completed set per exercise in a session (most reps breaks a tie). */
export function bestSets(session: WorkoutSession) {
  const best: Record<string, { kg: number; reps: number | null }> = {};
  for (const s of session.set_logs) {
    if (!s.completed || s.actual_weight_kg == null) continue;
    const prev = best[s.exercise_key];
    const better =
      !prev ||
      s.actual_weight_kg > prev.kg ||
      (s.actual_weight_kg === prev.kg && (s.actual_reps ?? 0) > (prev.reps ?? 0));
    if (better) best[s.exercise_key] = { kg: s.actual_weight_kg, reps: s.actual_reps };
  }
  return best;
}
