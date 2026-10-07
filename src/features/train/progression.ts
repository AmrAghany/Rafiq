// Working weights and progression for the Train tab. Pure.
//
// Rule from the brief: suggest a weight increase when all reps were completed for two
// sessions in a row (at the current working weight).

import { LIGHT_DAY_LOAD_FACTOR, roundToPlate } from '@/features/plan/engine';

export const DEFAULT_INCREMENT_KG = 2.5;

export interface LoggedSet {
  setNumber: number;
  targetReps: number | null;
  actualReps: number | null;
  actualWeightKg: number | null;
  completed: boolean;
}

/** One past session of a single exercise. */
export interface ExerciseSession {
  date: string;
  sets: LoggedSet[];
}

/** Heaviest completed weight in a session, or null if nothing with a weight was completed. */
export function workingWeight(session: ExerciseSession): number | null {
  const weights = session.sets
    .filter((s) => s.completed && s.actualWeightKg != null)
    .map((s) => s.actualWeightKg!);
  return weights.length ? Math.max(...weights) : null;
}

/** Every prescribed set was completed with at least the target reps, at `atKg` or heavier. */
export function hitAllReps(
  session: ExerciseSession,
  prescribedSets: number,
  atKg: number,
): boolean {
  const done = session.sets.filter((s) => s.completed);
  if (done.length < prescribedSets) return false;
  return done.every(
    (s) =>
      s.actualReps != null &&
      s.targetReps != null &&
      s.actualReps >= s.targetReps &&
      s.actualWeightKg != null &&
      s.actualWeightKg >= atKg,
  );
}

export interface TargetInput {
  /** Starting weight from the plan, or null for bodyweight/timed exercises. */
  startKg: number | null;
  /**
   * The plan's light-day starting weight. The engine takes 10% off before rounding, so
   * this can differ from rounding startKg × 0.9.
   */
  lightStartKg?: number | null;
  /** Past sessions of this exercise, newest first, excluding today. */
  history: readonly ExerciseSession[];
  /** Sets prescribed on a normal (not light) day. */
  prescribedSets: number;
  incrementKg?: number;
  light?: boolean;
}

export interface Target {
  /** Weight to use today (already reduced on a light day). */
  targetKg: number | null;
  /** Suggested heavier weight, when the member has earned it. */
  suggestedKg: number | null;
}

export function nextTarget({
  startKg,
  lightStartKg,
  history,
  prescribedSets,
  incrementKg = DEFAULT_INCREMENT_KG,
  light = false,
}: TargetInput): Target {
  if (startKg == null) return { targetKg: null, suggestedKg: null };

  const last = history[0] ? workingWeight(history[0]) : null;
  const base = last ?? startKg;

  const earned =
    !light &&
    history.length >= 2 &&
    hitAllReps(history[0], prescribedSets, base) &&
    hitAllReps(history[1], prescribedSets, base);

  return {
    targetKg: !light
      ? base
      : last == null && lightStartKg != null
        ? lightStartKg
        : roundToPlate(base * LIGHT_DAY_LOAD_FACTOR),
    suggestedKg: earned ? base + incrementKg : null,
  };
}
