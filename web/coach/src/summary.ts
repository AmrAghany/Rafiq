// Turns a review bundle into the few numbers a coach scans first. Pure.

import exercises from '../../../src/features/plan/data/exercises.json';
import workouts from '../../../src/features/plan/data/workouts.json';

import type { Bundle } from './types';

type Named = { key: string; nameEn: string; nameAr: string };

const byKey = (list: Named[]) => new Map(list.map((x) => [x.key, x]));
const EXERCISES = byKey(exercises as Named[]);
const WORKOUTS = byKey(workouts as Named[]);

const name = (map: Map<string, Named>, key: string, language: string) => {
  const item = map.get(key);
  if (!item) return key;
  return language === 'ar' ? item.nameAr : item.nameEn;
};
export const exerciseName = (key: string, language: string) => name(EXERCISES, key, language);
export const workoutName = (key: string, language: string) => name(WORKOUTS, key, language);

const avg = (values: (number | null | undefined)[]) => {
  const xs = values.filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};
const round = (v: number | null, step = 1) => (v == null ? null : Math.round(v / step) * step);

export interface WeekSummary {
  /** Monday of the week, YYYY-MM-DD. */
  week: string;
  readiness: number | null;
  sleepMinutes: number | null;
  steps: number | null;
  workoutsDone: number;
  setsDone: number;
  mealsLogged: number;
  /** Average kcal over days with at least one meal that had kcal. */
  kcalPerDay: number | null;
}

/** Monday on or before a YYYY-MM-DD date. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

export function weeklySummary(bundle: Bundle): WeekSummary[] {
  const weeks = new Map<string, WeekSummary & { kcalDays: Map<string, number> }>();
  const get = (date: string) => {
    const week = mondayOf(date);
    let w = weeks.get(week);
    if (!w) {
      w = {
        week,
        readiness: null,
        sleepMinutes: null,
        steps: null,
        workoutsDone: 0,
        setsDone: 0,
        mealsLogged: 0,
        kcalPerDay: null,
        kcalDays: new Map(),
      };
      weeks.set(week, w);
    }
    return w;
  };

  const daysByWeek = new Map<string, Bundle['days']>();
  for (const day of bundle.days) {
    get(day.date);
    const list = daysByWeek.get(mondayOf(day.date)) ?? [];
    list.push(day);
    daysByWeek.set(mondayOf(day.date), list);
  }
  for (const [week, days] of daysByWeek) {
    const w = weeks.get(week)!;
    w.readiness = round(avg(days.map((d) => d.readiness)));
    w.sleepMinutes = round(avg(days.map((d) => d.sleep_minutes)));
    w.steps = round(avg(days.map((d) => d.steps)), 10);
  }
  for (const s of bundle.workouts) {
    const w = get(s.date);
    if (s.completed) w.workoutsDone++;
    w.setsDone += s.sets.filter((x) => x.completed).length;
  }
  for (const meal of bundle.meals) {
    const w = get(meal.date);
    w.mealsLogged++;
    if (meal.kcal != null) w.kcalDays.set(meal.date, (w.kcalDays.get(meal.date) ?? 0) + meal.kcal);
  }
  return [...weeks.values()]
    .map(({ kcalDays, ...w }) => ({ ...w, kcalPerDay: round(avg([...kcalDays.values()]), 10) }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export interface LiftProgress {
  exerciseKey: string;
  first: { date: string; weightKg: number; reps: number };
  best: { date: string; weightKg: number; reps: number };
  sessions: number;
}

/** Per exercise: the first and the heaviest completed set in the period. */
export function liftProgress(bundle: Bundle): LiftProgress[] {
  const out = new Map<string, LiftProgress & { dates: Set<string> }>();
  for (const s of bundle.workouts) {
    for (const set of s.sets) {
      if (!set.completed || set.weight_kg == null || set.reps == null) continue;
      const entry = { date: s.date, weightKg: Number(set.weight_kg), reps: set.reps };
      const p = out.get(set.exercise_key);
      if (!p) {
        out.set(set.exercise_key, {
          exerciseKey: set.exercise_key,
          first: entry,
          best: entry,
          sessions: 1,
          dates: new Set([s.date]),
        });
        continue;
      }
      p.dates.add(s.date);
      p.sessions = p.dates.size;
      if (
        entry.weightKg > p.best.weightKg ||
        (entry.weightKg === p.best.weightKg && entry.reps > p.best.reps)
      ) {
        p.best = entry;
      }
    }
  }
  return [...out.values()].map(({ dates: _dates, ...p }) => p);
}

/** Plan workouts in the period's weeks versus workouts finished. */
export function adherence(bundle: Bundle): { planned: number; done: number } | null {
  if (!bundle.plan) return null;
  const perWeek = bundle.plan.plan.week.filter((d) => d.workoutKey).length;
  const weeks = weeklySummary(bundle).length;
  return { planned: perWeek * weeks, done: bundle.workouts.filter((w) => w.completed).length };
}

/** Members whose plan must not show calorie numbers (eating disorder or pregnancy). */
export const isCareful = (bundle: Bundle) =>
  bundle.profile.health_flags.some((f) => f === 'eating_disorder' || f === 'pregnancy');
