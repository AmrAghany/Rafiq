// Rescans and body-composition progress. Pure: no I/O.

import { buildPlan, ENGINE_VERSION, type Plan, type PlanInput } from '@/features/plan/engine';
import { LIMITS, parseNumber } from '@/features/onboarding/validation';
import type { Json } from '@/lib/database.types';

/** Members are asked to rescan every 4 weeks. */
export const RESCAN_INTERVAL_DAYS = 28;
/** The reminder card shows up this many days before a rescan is due. */
export const RESCAN_SOON_DAYS = 3;

export interface BodyScan {
  id: string;
  /** YYYY-MM-DD */
  scannedOn: string;
  source: 'photo' | 'manual';
  weightKg: number | null;
  bodyFatPct: number | null;
  skeletalMuscleKg: number | null;
  bmrKcal: number | null;
}

export type Metric = 'weightKg' | 'bodyFatPct' | 'skeletalMuscleKg';
export const METRICS: Metric[] = ['weightKg', 'bodyFatPct', 'skeletalMuscleKg'];

const DAY_MS = 86_400_000;
const dayNumber = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};
const isoFromDayNumber = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** Whole days from one YYYY-MM-DD date to another. */
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

export interface RescanStatus {
  /** YYYY-MM-DD the next scan is due. */
  dueOn: string;
  /** Days until due; 0 or less means due now. */
  daysLeft: number;
  state: 'ok' | 'soon' | 'due';
}

/** When the next scan is due, from the latest scan date and today's local date key. */
export function rescanStatus(lastScannedOn: string, today: string): RescanStatus {
  const dueOn = isoFromDayNumber(dayNumber(lastScannedOn) + RESCAN_INTERVAL_DAYS);
  const daysLeft = daysBetween(today, dueOn);
  return {
    dueOn,
    daysLeft,
    state: daysLeft <= 0 ? 'due' : daysLeft <= RESCAN_SOON_DAYS ? 'soon' : 'ok',
  };
}

/** The latest scan by date (newest saved last when two share a day). */
export const latestScan = (scans: readonly BodyScan[]) =>
  scans.length ? scans[scans.length - 1] : null;

export interface SeriesPoint {
  date: string;
  value: number;
}

/** One metric over time, oldest first, skipping scans that didn't record it. */
export function seriesFor(scans: readonly BodyScan[], metric: Metric): SeriesPoint[] {
  return scans
    .filter((s) => s.scannedOn && s[metric] != null)
    .map((s) => ({ date: s.scannedOn, value: s[metric] as number }));
}

/** Change from the first to the latest point, rounded to 0.1. Null with fewer than two. */
export function change(series: readonly SeriesPoint[]): number | null {
  if (series.length < 2) return null;
  return Math.round((series[series.length - 1].value - series[0].value) * 10) / 10;
}

// ---------------------------------------------------------------------------
// The rescan form
// ---------------------------------------------------------------------------

export interface RescanDraft {
  weightKg: string;
  bodyFatPct: string;
  skeletalMuscleKg: string;
  bmrKcal: string;
  photoPath: string | null;
  aiReading: Record<string, number | null> | null;
}

export const emptyRescan: RescanDraft = {
  weightKg: '',
  bodyFatPct: '',
  skeletalMuscleKg: '',
  bmrKcal: '',
  photoPath: null,
  aiReading: null,
};

export type RescanField = 'weightKg' | 'bodyFatPct' | 'skeletalMuscleKg' | 'bmrKcal';
export type RescanErrors = Partial<Record<RescanField, 'required' | 'outOfRange'>>;

const inRange = (n: number | null, { min, max }: { min: number; max: number }) =>
  n != null && n >= min && n <= max;

/** Weight is required (the plan is rebuilt from it); the scan numbers are optional. */
export function validateRescan(draft: RescanDraft): RescanErrors {
  const errors: RescanErrors = {};
  if (!draft.weightKg.trim()) errors.weightKg = 'required';
  else if (!inRange(parseNumber(draft.weightKg), LIMITS.weightKg)) errors.weightKg = 'outOfRange';
  for (const field of ['bodyFatPct', 'skeletalMuscleKg', 'bmrKcal'] as const) {
    if (!draft[field].trim()) continue;
    if (!inRange(parseNumber(draft[field]), LIMITS[field])) errors[field] = 'outOfRange';
  }
  return errors;
}

/**
 * The plan input after a rescan: the new body numbers with the member's goal, training
 * days, experience and health answers carried over from the current plan.
 */
export function rescanInput(current: PlanInput, draft: RescanDraft): PlanInput {
  return {
    ...current,
    weightKg: parseNumber(draft.weightKg)!,
    bodyFatPct: parseNumber(draft.bodyFatPct),
    bmrKcal: parseNumber(draft.bmrKcal),
  };
}

/** Arguments for public.record_scan(), built from a validated draft. */
export function buildRescanPayload(current: PlanInput, draft: RescanDraft) {
  const input = rescanInput(current, draft);
  const plan = buildPlan(input);
  return {
    plan,
    args: {
      p_scan: {
        source: draft.photoPath ? 'photo' : 'manual',
        photo_path: draft.photoPath,
        ai_extracted: draft.aiReading,
        weight_kg: input.weightKg,
        body_fat_pct: input.bodyFatPct ?? null,
        skeletal_muscle_kg: parseNumber(draft.skeletalMuscleKg),
        bmr_kcal: input.bmrKcal ?? null,
      } as Json,
      p_plan_inputs: input as unknown as Json,
      p_plan: plan as unknown as Json,
      p_engine_version: ENGINE_VERSION,
    },
  };
}

export interface PlanChange {
  key: 'targetKcal' | 'proteinG' | 'bmrKcal' | 'leanMassKg';
  before: number;
  after: number;
}

/**
 * What a new plan changes, for the "your new plan" preview. Calorie lines are left out
 * when the plan must not show calorie numbers.
 */
export function planChanges(before: Plan, after: Plan): PlanChange[] {
  const keys: PlanChange['key'][] = after.safety.hideCalories
    ? ['leanMassKg']
    : ['targetKcal', 'proteinG', 'bmrKcal', 'leanMassKg'];
  return keys.map((key) => ({ key, before: before[key], after: after[key] }));
}

/**
 * When to remind the member to rescan: two hours after waking on the day it's due, as a
 * local Date. Null if that moment has passed (the in-app card covers an overdue scan).
 */
export function rescanReminderAt(dueOn: string, wakeTime: string, now: Date): Date | null {
  const [y, m, d] = dueOn.split('-').map(Number);
  const [h, min] = wakeTime.split(':').map(Number);
  const at = new Date(y, m - 1, d, h + 2, min);
  return at > now ? at : null;
}
