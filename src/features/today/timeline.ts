// The member's day, from wake-up to sleep (prototype timeline()). Pure: times are
// "HH:MM" strings in the member's local time, built from their wake-up and workout times.

import type { Plan } from '@/features/plan/engine';

export type TimelineKind = 'checkin' | 'meal' | 'move' | 'train' | 'recovery' | 'rest';

export type TimelineItemId =
  | 'checkin'
  | 'breakfast'
  | 'move'
  | 'lunch'
  | 'pre_workout'
  | 'snack'
  | 'workout'
  | 'active_recovery'
  | 'dinner'
  | 'wind_down'
  | 'sleep'
  | 'suhoor'
  | 'walk'
  | 'iftar'
  | 'stretch'
  | 'recovery_meal';

export interface TimelineItem {
  id: TimelineItemId;
  time: string;
  kind: TimelineKind;
  /** Workout key for 'workout', the next day's workout key (or null) for 'wind_down'. */
  workoutKey?: string | null;
}

export interface DaySchedule {
  /** "HH:MM", default 06:30 */
  wakeTime: string;
  /** "HH:MM", default 17:30 */
  workoutTime: string;
}

export const DEFAULT_SCHEDULE: DaySchedule = { wakeTime: '06:30', workoutTime: '17:30' };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isValidTime = (t: string) => TIME_RE.test(t);

/** "6:5", "0630", "06:30:00" → "06:30"; null when it can't be read. */
export function normaliseTime(raw: string): string | null {
  const s = raw.trim();
  let h: number;
  let m: number;
  const colon = /^(\d{1,2}):(\d{1,2})(?::\d{2})?$/.exec(s);
  const compact = /^(\d{2})(\d{2})$/.exec(s);
  if (colon) [h, m] = [Number(colon[1]), Number(colon[2])];
  else if (compact) [h, m] = [Number(compact[1]), Number(compact[2])];
  else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const offset = (base: string, mins: number) => fromMinutes(toMinutes(base) + mins);

/** Minutes after waking, for sorting a day that may run past midnight. */
const sinceWake = (time: string, wake: string) => (toMinutes(time) - toMinutes(wake) + 1440) % 1440;

/**
 * The day's timeline. Offsets from wake-up reproduce the prototype exactly for the
 * default 06:30 wake-up and 17:30 workout.
 */
export function buildTimeline(
  plan: Plan,
  dayIndex: number,
  schedule: DaySchedule = DEFAULT_SCHEDULE,
  ramadan = false,
): TimelineItem[] {
  const day = plan.week[dayIndex];
  const trains = !!day.workoutKey;

  if (ramadan) {
    // Fixed times from the prototype. Phase 6 replaces these with local prayer times.
    return [
      { id: 'suhoor', time: '03:45', kind: 'meal' },
      { id: 'checkin', time: '09:00', kind: 'checkin' },
      { id: 'walk', time: '13:00', kind: 'move' },
      { id: 'iftar', time: '18:05', kind: 'meal' },
      trains
        ? { id: 'workout', time: '21:00', kind: 'train', workoutKey: day.workoutKey }
        : { id: 'stretch', time: '21:00', kind: 'recovery' },
      { id: 'recovery_meal', time: '22:30', kind: 'meal' },
      { id: 'sleep', time: '23:30', kind: 'rest' },
    ];
  }

  const { wakeTime: wake, workoutTime: workout } = schedule;
  const nextDay = plan.week[(dayIndex + 1) % 7];
  // An early workout leaves no room for a pre-workout snack after breakfast; keep the
  // afternoon snack instead.
  const preWorkoutTime = offset(workout, -90);
  const preSinceWake = sinceWake(preWorkoutTime, wake);
  const hasPreWorkout = trains && preSinceWake >= 60 && preSinceWake < sinceWake(workout, wake);
  const items: TimelineItem[] = [
    { id: 'checkin', time: wake, kind: 'checkin' },
    { id: 'breakfast', time: offset(wake, 30), kind: 'meal' },
    { id: 'move', time: offset(wake, 210), kind: 'move' },
    { id: 'lunch', time: offset(wake, 390), kind: 'meal' },
    hasPreWorkout
      ? { id: 'pre_workout', time: preWorkoutTime, kind: 'meal' }
      : { id: 'snack', time: offset(wake, 570), kind: 'meal' },
    trains
      ? { id: 'workout', time: workout, kind: 'train', workoutKey: day.workoutKey }
      : { id: 'active_recovery', time: workout, kind: 'recovery' },
    { id: 'dinner', time: offset(wake, 780), kind: 'meal' },
    { id: 'wind_down', time: offset(wake, 930), kind: 'rest', workoutKey: nextDay.workoutKey },
    { id: 'sleep', time: offset(wake, 990), kind: 'rest' },
  ];
  return items.sort((a, b) => sinceWake(a.time, wake) - sinceWake(b.time, wake));
}

export type ScheduleError = 'wakeInvalid' | 'workoutInvalid' | 'workoutOutsideDay';

/** Workouts must start 1–15 hours after waking, so the day still runs in order. */
export function validateSchedule(schedule: DaySchedule): ScheduleError | null {
  if (!isValidTime(schedule.wakeTime)) return 'wakeInvalid';
  if (!isValidTime(schedule.workoutTime)) return 'workoutInvalid';
  const gap = sinceWake(schedule.workoutTime, schedule.wakeTime);
  return gap < 60 || gap > 900 ? 'workoutOutsideDay' : null;
}

/** Index of the item happening now: the last one whose time has passed (or -1). */
export function currentItemIndex(items: TimelineItem[], now: Date, wakeTime: string): number {
  const nowSinceWake = sinceWake(fromMinutes(now.getHours() * 60 + now.getMinutes()), wakeTime);
  let current = -1;
  items.forEach((item, i) => {
    if (sinceWake(item.time, wakeTime) <= nowSinceWake) current = i;
  });
  return current;
}

/** Local calendar date as YYYY-MM-DD (not UTC), used as daily_logs.log_date. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type Greeting = 'morning' | 'afternoon' | 'evening';

export function greetingFor(date: Date): Greeting {
  const h = date.getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

/** Daily water goal in glasses (prototype: 10, or 8 in Ramadan). */
export const waterGoal = (ramadan: boolean) => (ramadan ? 8 : 10);
