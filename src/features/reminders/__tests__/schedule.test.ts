import { buildPlan } from '@/features/plan/engine';
import { DEFAULT_SCHEDULE } from '@/features/today/timeline';

import { buildReminders, MAX_PENDING } from '../schedule';

const plan = buildPlan({
  sex: 'female',
  weightKg: 64,
  goal: 'lose',
  trainingDays: 3,
  experience: 'beginner',
  bodyFatPct: 27,
  bmrKcal: null,
  healthFlags: [],
});

// Monday 5 October 2026, 12:00 local time.
const now = new Date(2026, 9, 5, 12, 0);

describe('buildReminders', () => {
  const reminders = buildReminders({ plan, now, schedule: DEFAULT_SCHEDULE });

  it('only schedules future reminders, in order, under the iOS limit', () => {
    expect(reminders.length).toBeGreaterThan(0);
    expect(reminders.length).toBeLessThanOrEqual(MAX_PENDING);
    for (const r of reminders) expect(r.date.getTime()).toBeGreaterThan(now.getTime());
    const times = reminders.map((r) => r.date.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('starts with this afternoon and never reminds about sleep', () => {
    expect(reminders.slice(0, 4).map((r) => r.id)).toEqual([
      '2026-10-05:lunch',
      '2026-10-05:pre_workout',
      '2026-10-05:workout',
      '2026-10-05:dinner',
    ]);
    expect(reminders.some((r) => r.item.id === 'sleep')).toBe(false);
  });

  it('skips items already done today', () => {
    const ids = buildReminders({ plan, now, schedule: DEFAULT_SCHEDULE, doneToday: ['lunch'] }).map(
      (r) => r.id,
    );
    expect(ids).not.toContain('2026-10-05:lunch');
  });

  it('uses each day’s own workout', () => {
    const tuesday = reminders.filter((r) => r.id.startsWith('2026-10-06'));
    expect(tuesday.map((r) => r.item.id)).toContain('active_recovery'); // 3-day split: Tuesday is rest
    const wednesday = reminders.find((r) => r.id === '2026-10-07:workout');
    expect(wednesday?.item.workoutKey).toBe('full_body_b');
  });

  it('puts items after midnight on the next calendar day', () => {
    const late = buildReminders({
      plan,
      now,
      schedule: { wakeTime: '10:00', workoutTime: '20:00' },
      days: 0,
    });
    const windDown = late.find((r) => r.item.id === 'wind_down')!;
    expect(windDown.date).toEqual(new Date(2026, 9, 6, 1, 30));
  });
});
