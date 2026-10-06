// Rafiq plan engine: pure functions, no React or I/O. Ported from plan() in
// reference/rafiq-prototype.html. Any change to the numbers must bump ENGINE_VERSION
// so stored plans record which formulas produced them.

import exercisesData from './data/exercises.json';
import splitsData from './data/splits.json';
import workoutsData from './data/workouts.json';

export const ENGINE_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Sex = 'male' | 'female';
export type Goal = 'lose' | 'build' | 'recomp';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type TrainingDays = 3 | 4 | 5;
export type DayType = 'high' | 'medium' | 'low';
export type HealthFlag = 'injury' | 'heart' | 'diabetes' | 'pregnancy' | 'eating_disorder';

export interface PlanInput {
  sex: Sex;
  weightKg: number;
  goal: Goal;
  trainingDays: TrainingDays;
  experience: Experience;
  /** From the body scan. Missing body fat falls back to a sex-based default. */
  bodyFatPct?: number | null;
  bmrKcal?: number | null;
  healthFlags: readonly HealthFlag[];
}

export interface Exercise {
  key: string;
  nameEn: string;
  nameAr: string;
  bodyweightRatio: number;
  isMain?: boolean;
  perHand?: boolean;
  timedSeconds?: number;
  smartStation?: string;
  alternativeKey?: string;
}

export interface Workout {
  key: string;
  nameEn: string;
  nameAr: string;
  exerciseKeys: string[];
}

export interface Split {
  nameEn: string;
  nameAr: string;
  week: { workoutKey: string | null; dayType: DayType }[];
}

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface RepScheme {
  sets: number;
  reps: number;
}

export interface Safety {
  /** Eating disorder or pregnancy: eat at maintenance, never in a deficit. */
  noDeficit: boolean;
  /** Eating disorder or pregnancy: show balanced meals, never calorie numbers. */
  hideCalories: boolean;
  /** Heart, diabetes or injury: show a "check with your doctor" notice. */
  doctorNotice: boolean;
  /** Heart, diabetes or injury: keep starting loads and rep ranges moderate. */
  moderateTraining: boolean;
}

export interface PlanDay {
  dayType: DayType;
  workoutKey: string | null;
}

export interface Plan {
  engineVersion: string;
  bodyFatPct: number;
  bodyFatAssumed: boolean;
  leanMassKg: number;
  bmrKcal: number;
  bmrSource: 'scan' | 'katch_mcardle';
  tdeeKcal: number;
  targetKcal: number;
  proteinG: number;
  macros: Record<DayType, Macros>;
  trainingDays: TrainingDays;
  /** Monday first, seven entries. */
  week: PlanDay[];
  /** Rep schemes for main lifts and accessories. */
  schemes: { main: RepScheme; accessory: RepScheme };
  /** Multiplier applied to bodyweight × exercise ratio for starting weights. */
  loadFactor: number;
  weightKg: number;
  safety: Safety;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(
  (exercisesData as Exercise[]).map((e) => [e.key, e]),
);
export const WORKOUTS: Record<string, Workout> = Object.fromEntries(
  (workoutsData as Workout[]).map((w) => [w.key, w]),
);
export const SPLITS = splitsData as Record<`${TrainingDays}`, Split>;

// ---------------------------------------------------------------------------
// Constants (from the prototype)
// ---------------------------------------------------------------------------

export const ACTIVITY_FACTOR: Record<TrainingDays, number> = { 3: 1.45, 4: 1.55, 5: 1.65 };
export const GOAL_CALORIE_FACTOR: Record<Goal, number> = { lose: 0.8, build: 1.1, recomp: 0.95 };
export const DEFAULT_BODY_FAT_PCT: Record<Sex, number> = { male: 20, female: 28 };

export const DAY_TYPES: Record<DayType, { calorieFactor: number; fatPerKg: number }> = {
  high: { calorieFactor: 1.08, fatPerKg: 0.8 },
  medium: { calorieFactor: 1.0, fatPerKg: 0.9 },
  low: { calorieFactor: 0.82, fatPerKg: 1.15 },
};
export const MIN_CARBS_G = 50;

export const EXPERIENCE_LOAD_FACTOR: Record<Experience, number> = {
  beginner: 0.55,
  intermediate: 0.8,
  advanced: 1.0,
};
export const GOAL_LOAD_FACTOR: Record<Goal, number> = { lose: 0.85, build: 0.9, recomp: 1.0 };

export const REP_SCHEMES: Record<Goal, { main: RepScheme; accessory: RepScheme }> = {
  lose: { main: { sets: 3, reps: 10 }, accessory: { sets: 3, reps: 15 } },
  build: { main: { sets: 4, reps: 8 }, accessory: { sets: 3, reps: 12 } },
  recomp: { main: { sets: 4, reps: 6 }, accessory: { sets: 3, reps: 10 } },
};

/** Moderate training (health flags): 10% lighter starting loads, no low-rep main lifts. */
export const MODERATE_LOAD_FACTOR = 0.9;
export const MODERATE_MIN_MAIN_REPS = 8;

export const READINESS_LIGHT_THRESHOLD = 60;
export const LIGHT_DAY_LOAD_FACTOR = 0.9;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** Round to the nearest 2.5 kg plate step, never below 2.5 kg. */
export const roundToPlate = (kg: number) => Math.max(2.5, roundTo(kg, 2.5));

const round1 = (n: number) => Math.round(n * 10) / 10;

export function safetyFor(flags: readonly HealthFlag[]): Safety {
  const careful = flags.includes('eating_disorder') || flags.includes('pregnancy');
  const medical = flags.includes('heart') || flags.includes('diabetes') || flags.includes('injury');
  return {
    noDeficit: careful,
    hideCalories: careful,
    doctorNotice: medical,
    moderateTraining: medical,
  };
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export function buildPlan(input: PlanInput): Plan {
  const { weightKg, goal, trainingDays } = input;
  const safety = safetyFor(input.healthFlags);

  const bodyFatAssumed = !(input.bodyFatPct != null && input.bodyFatPct > 0);
  const bodyFatPct = bodyFatAssumed ? DEFAULT_BODY_FAT_PCT[input.sex] : input.bodyFatPct!;
  const bf = bodyFatPct / 100;
  const leanMass = weightKg * (1 - bf);

  const hasScanBmr = input.bmrKcal != null && input.bmrKcal > 0;
  const bmrKcal = Math.round(hasScanBmr ? input.bmrKcal! : 370 + 21.6 * leanMass);
  const tdeeKcal = Math.round(bmrKcal * ACTIVITY_FACTOR[trainingDays]);

  const goalFactor = safety.noDeficit ? 1 : GOAL_CALORIE_FACTOR[goal];
  const targetKcal = roundTo(tdeeKcal * goalFactor, 10);
  const proteinG = Math.round(bf > 0.3 ? leanMass * 2.4 : weightKg * 2.0);

  const macrosFor = (dayType: DayType): Macros => {
    const { calorieFactor, fatPerKg } = DAY_TYPES[dayType];
    const kcal = roundTo(targetKcal * calorieFactor, 10);
    const fatG = Math.round(weightKg * fatPerKg);
    const carbsG = Math.max(MIN_CARBS_G, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
    return { kcal, proteinG, carbsG, fatG };
  };

  const base = REP_SCHEMES[goal];
  const schemes = safety.moderateTraining
    ? {
        main: { ...base.main, reps: Math.max(base.main.reps, MODERATE_MIN_MAIN_REPS) },
        accessory: base.accessory,
      }
    : base;

  const loadFactor =
    EXPERIENCE_LOAD_FACTOR[input.experience] *
    GOAL_LOAD_FACTOR[goal] *
    (safety.moderateTraining ? MODERATE_LOAD_FACTOR : 1);

  return {
    engineVersion: ENGINE_VERSION,
    bodyFatPct,
    bodyFatAssumed,
    leanMassKg: round1(leanMass),
    bmrKcal,
    bmrSource: hasScanBmr ? 'scan' : 'katch_mcardle',
    tdeeKcal,
    targetKcal,
    proteinG,
    macros: { high: macrosFor('high'), medium: macrosFor('medium'), low: macrosFor('low') },
    trainingDays,
    week: SPLITS[`${trainingDays}`].week.map((d) => ({
      dayType: d.dayType,
      workoutKey: d.workoutKey,
    })),
    schemes,
    loadFactor,
    weightKg,
    safety,
  };
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export interface PrescribedExercise {
  exercise: Exercise;
  sets: number;
  /** Reps per set, or null for timed holds. */
  reps: number | null;
  /** Seconds per set for timed holds. */
  seconds: number | null;
  /** Starting weight in kg (per hand where perHand), or null for bodyweight/timed. */
  loadKg: number | null;
}

/**
 * The prescription for one exercise. A light day (readiness below 60) means one
 * less set and 10% less weight.
 */
export function prescribe(plan: Plan, exerciseKey: string, light = false): PrescribedExercise {
  const exercise = EXERCISES[exerciseKey];
  if (!exercise) throw new Error(`Unknown exercise: ${exerciseKey}`);
  const scheme = exercise.isMain ? plan.schemes.main : plan.schemes.accessory;
  const sets = Math.max(1, scheme.sets - (light ? 1 : 0));

  if (exercise.timedSeconds) {
    return { exercise, sets, reps: null, seconds: exercise.timedSeconds, loadKg: null };
  }
  const loadKg =
    exercise.bodyweightRatio > 0
      ? roundToPlate(
          plan.weightKg *
            exercise.bodyweightRatio *
            plan.loadFactor *
            (light ? LIGHT_DAY_LOAD_FACTOR : 1),
        )
      : null;
  return { exercise, sets, reps: scheme.reps, seconds: null, loadKg };
}

export function prescribeWorkout(plan: Plan, workoutKey: string, light = false) {
  const workout = WORKOUTS[workoutKey];
  if (!workout) throw new Error(`Unknown workout: ${workoutKey}`);
  return { workout, exercises: workout.exerciseKeys.map((k) => prescribe(plan, k, light)) };
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/** 1 = worst, 3 = best. Soreness 3 means no soreness. */
export type CheckinAnswer = 1 | 2 | 3;

export interface Checkin {
  sleep: CheckinAnswer;
  energy: CheckinAnswer;
  soreness: CheckinAnswer;
}

/** Morning check-in to a readiness score from 40 (all worst) to 100 (all best). */
export function readinessScore({ sleep, energy, soreness }: Checkin): number {
  return Math.round(40 + ((sleep + energy + soreness - 3) / 6) * 60);
}

export const isLightDay = (score: number | null | undefined) =>
  score != null && score < READINESS_LIGHT_THRESHOLD;

/** Monday = 0 … Sunday = 6, matching Plan.week. */
export const weekdayIndex = (date: Date) => (date.getDay() + 6) % 7;
