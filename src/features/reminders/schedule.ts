// Which local reminders to schedule for the coming days. Pure: the native scheduling
// lives in ./notifications.ts.

import type { Plan } from '@/features/plan/engine';
import { weekdayIndex } from '@/features/plan/engine';
import {
  buildTimeline,
  localDateKey,
  toMinutes,
  type DaySchedule,
  type RamadanTimes,
  type TimelineItem,
  type TimelineItemId,
} from '@/features/today/timeline';

/** iOS keeps at most 64 pending local notifications per app. */
export const MAX_PENDING = 60;
export const DAYS_AHEAD = 6;

/** Timeline items that get a reminder. Sleep is left out on purpose: no 23:00 buzz. */
export const REMINDED: ReadonlySet<TimelineItemId> = new Set([
  'checkin',
  'breakfast',
  'move',
  'lunch',
  'pre_workout',
  'snack',
  'workout',
  'active_recovery',
  'dinner',
  'wind_down',
  'suhoor',
  'iftar',
  'recovery_meal',
]);

export interface Reminder {
  /** Stable id: "<YYYY-MM-DD>:<item id>". */
  id: string;
  date: Date;
  item: TimelineItem;
  dayIndex: number;
}

export function buildReminders(opts: {
  plan: Plan;
  now: Date;
  schedule: DaySchedule;
  /** The fasting times in Ramadan (true uses the defaults), otherwise false. */
  ramadan?: boolean | RamadanTimes;
  /** Item ids already ticked off today; no reminder for those. */
  doneToday?: readonly string[];
  days?: number;
}): Reminder[] {
  const { plan, now, schedule, ramadan = false, doneToday = [], days = DAYS_AHEAD } = opts;
  const reminders: Reminder[] = [];

  for (let d = 0; d <= days; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const dayIndex = weekdayIndex(day);
    const items = buildTimeline(plan, dayIndex, schedule, ramadan);
    // The day starts at its first item (wake-up, or suhoor in Ramadan).
    const dayStart = toMinutes(items[0].time);
    for (const item of items) {
      if (!REMINDED.has(item.id)) continue;
      if (d === 0 && doneToday.includes(item.id)) continue;
      const mins = toMinutes(item.time);
      // Items before the day starts (e.g. a late wind-down past midnight) belong to the
      // next calendar day.
      const rollsOver = mins < dayStart;
      const date = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate() + (rollsOver ? 1 : 0),
        Math.floor(mins / 60),
        mins % 60,
      );
      if (date <= now) continue;
      reminders.push({ id: `${localDateKey(day)}:${item.id}`, date, item, dayIndex });
    }
  }
  return reminders.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_PENDING);
}
