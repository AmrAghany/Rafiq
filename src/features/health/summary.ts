// Sleep and steps from Apple Health / Health Connect, reduced to the two numbers the app
// uses. Pure: the native reads live in ./source.ts.

import type { CheckinAnswer } from '@/features/plan/engine';

export interface SleepInterval {
  start: Date;
  end: Date;
}

/**
 * The window that counts as "last night" for a local date: 18:00 the evening before to
 * 14:00 that day, so late sleepers and night-shift naps still land on the right morning.
 */
export function nightWindow(dateKey: string): { from: Date; to: Date } {
  const [y, m, d] = dateKey.split('-').map(Number);
  return { from: new Date(y, m - 1, d - 1, 18), to: new Date(y, m - 1, d, 14) };
}

/** Local midnight of a date key, the start of "today" for steps. */
export function dayStart(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Minutes asleep inside the window. Overlapping intervals (a watch and a phone both
 * recording the same night) are merged so they count once. Null when nothing was recorded.
 */
export function sleepMinutes(
  intervals: readonly SleepInterval[],
  window: { from: Date; to: Date },
): number | null {
  const clipped = intervals
    .map((i) => ({
      start: Math.max(i.start.getTime(), window.from.getTime()),
      end: Math.min(i.end.getTime(), window.to.getTime()),
    }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  if (!clipped.length) return null;

  let total = 0;
  let { start, end } = clipped[0];
  for (const i of clipped.slice(1)) {
    if (i.start <= end) {
      end = Math.max(end, i.end);
    } else {
      total += end - start;
      ({ start, end } = i);
    }
  }
  total += end - start;
  return Math.round(total / 60_000);
}

/**
 * The check-in's sleep answer suggested from the recorded night: 7 h or more is "great",
 * 5½ h or more "OK", less is "badly". The member can always change it.
 */
export function sleepAnswer(minutes: number): CheckinAnswer {
  return minutes >= 7 * 60 ? 3 : minutes >= 5.5 * 60 ? 2 : 1;
}

/** Hours and minutes, e.g. { h: 7, m: 20 }. */
export const hoursAndMinutes = (minutes: number) => ({
  h: Math.floor(minutes / 60),
  m: minutes % 60,
});

/** A plausible number of steps for one day, or null. */
export function cleanSteps(steps: number | null | undefined): number | null {
  if (steps == null || !Number.isFinite(steps) || steps < 0) return null;
  return Math.min(Math.round(steps), 200_000);
}

/** Steps are re-read at most this often while the app is open. */
export const STEPS_REFRESH_MS = 15 * 60_000;

/** Whether enough time has passed since the last sync to read Health again. */
export const shouldSync = (lastSyncedAt: number | null, now: number) =>
  lastSyncedAt == null || now - lastSyncedAt >= STEPS_REFRESH_MS;
