import { buildPlan, type PlanInput } from '@/features/plan/engine';

import {
  buildTimeline,
  currentItemIndex,
  DEFAULT_SCHEDULE,
  fromMinutes,
  greetingFor,
  localDateKey,
  normaliseTime,
  validateRamadanTimes,
  validateSchedule,
  waterGoal,
} from '../timeline';

const input: PlanInput = {
  sex: 'male',
  weightKg: 82,
  goal: 'recomp',
  trainingDays: 4,
  experience: 'intermediate',
  bodyFatPct: 18.4,
  bmrKcal: 1810,
  healthFlags: [],
};
const plan = buildPlan(input); // Mon upper_a, Tue lower_a, Wed rest, ...

const view = (items: ReturnType<typeof buildTimeline>) => items.map((i) => `${i.time} ${i.id}`);

describe('buildTimeline', () => {
  it('matches the prototype for a training day with default times', () => {
    expect(view(buildTimeline(plan, 0))).toEqual([
      '06:30 checkin',
      '07:00 breakfast',
      '10:00 move',
      '13:00 lunch',
      '16:00 pre_workout',
      '17:30 workout',
      '19:30 dinner',
      '22:00 wind_down',
      '23:00 sleep',
    ]);
    expect(buildTimeline(plan, 0).find((i) => i.id === 'workout')?.workoutKey).toBe('upper_a');
  });

  it('matches the prototype for a rest day', () => {
    expect(view(buildTimeline(plan, 2))).toEqual([
      '06:30 checkin',
      '07:00 breakfast',
      '10:00 move',
      '13:00 lunch',
      '16:00 snack',
      '17:30 active_recovery',
      '19:30 dinner',
      '22:00 wind_down',
      '23:00 sleep',
    ]);
  });

  it('tells the wind-down item what tomorrow holds', () => {
    expect(buildTimeline(plan, 0).find((i) => i.id === 'wind_down')?.workoutKey).toBe('lower_a');
    expect(buildTimeline(plan, 1).find((i) => i.id === 'wind_down')?.workoutKey).toBeNull();
  });

  it('follows the member’s wake-up and workout times', () => {
    expect(view(buildTimeline(plan, 0, { wakeTime: '05:00', workoutTime: '07:30' }))).toEqual([
      '05:00 checkin',
      '05:30 breakfast',
      '06:00 pre_workout',
      '07:30 workout',
      '08:30 move',
      '11:30 lunch',
      '18:00 dinner',
      '20:30 wind_down',
      '21:30 sleep',
    ]);
  });

  it('drops the pre-workout snack when the workout is right after breakfast', () => {
    const items = buildTimeline(plan, 0, { wakeTime: '06:00', workoutTime: '07:00' });
    expect(items.map((i) => i.id)).not.toContain('pre_workout');
    expect(items.map((i) => i.id)).toContain('snack');
  });

  it('keeps a late day in order past midnight', () => {
    const items = buildTimeline(plan, 0, { wakeTime: '10:00', workoutTime: '20:00' });
    expect(view(items).slice(-2)).toEqual(['01:30 wind_down', '02:30 sleep']);
  });

  it('uses the Ramadan timeline', () => {
    expect(view(buildTimeline(plan, 0, DEFAULT_SCHEDULE, true))).toEqual([
      '03:45 suhoor',
      '09:00 checkin',
      '13:00 walk',
      '18:05 iftar',
      '21:00 workout',
      '22:30 recovery_meal',
      '23:30 sleep',
    ]);
    expect(buildTimeline(plan, 2, DEFAULT_SCHEDULE, true).map((i) => i.id)).toContain('stretch');
  });

  it("builds the Ramadan day around the member's suhoor and iftar times", () => {
    const defaults = { suhoorTime: '03:45', iftarTime: '18:05' };
    expect(buildTimeline(plan, 0, DEFAULT_SCHEDULE, defaults)).toEqual(
      buildTimeline(plan, 0, DEFAULT_SCHEDULE, true),
    );
    // A summer fast further north: late iftar pushes the evening past midnight.
    expect(
      view(buildTimeline(plan, 0, DEFAULT_SCHEDULE, { suhoorTime: '02:50', iftarTime: '20:40' })),
    ).toEqual([
      '02:50 suhoor',
      '08:05 checkin',
      '15:35 walk',
      '20:40 iftar',
      '23:35 workout',
      '01:05 recovery_meal',
      '02:05 sleep',
    ]);
  });
});

describe('validateRamadanTimes', () => {
  it('accepts a 10–18 hour fast and rejects anything else', () => {
    expect(validateRamadanTimes({ suhoorTime: '03:45', iftarTime: '18:05' })).toBeNull();
    expect(validateRamadanTimes({ suhoorTime: '3:45', iftarTime: '18:05' })).toBe('suhoorInvalid');
    expect(validateRamadanTimes({ suhoorTime: '03:45', iftarTime: '' })).toBe('iftarInvalid');
    expect(validateRamadanTimes({ suhoorTime: '03:45', iftarTime: '12:00' })).toBe(
      'fastOutOfRange',
    );
    expect(validateRamadanTimes({ suhoorTime: '03:45', iftarTime: '22:30' })).toBe(
      'fastOutOfRange',
    );
  });
});

describe('currentItemIndex', () => {
  const items = buildTimeline(plan, 0);
  const at = (h: number, m = 0) => new Date(2026, 9, 5, h, m);

  it('highlights the last item that has started', () => {
    expect(currentItemIndex(items, at(6, 0), '06:30')).toBe(-1 + items.length); // before wake = still last night
    expect(currentItemIndex(items, at(6, 30), '06:30')).toBe(0);
    expect(currentItemIndex(items, at(12, 59), '06:30')).toBe(2);
    expect(currentItemIndex(items, at(17, 30), '06:30')).toBe(5);
    expect(currentItemIndex(items, at(23, 30), '06:30')).toBe(8);
  });
});

describe('time helpers', () => {
  it.each([
    ['6:5', '06:05'],
    ['06:30', '06:30'],
    ['0630', '06:30'],
    ['06:30:00', '06:30'],
    [' 23:59 ', '23:59'],
    ['24:00', null],
    ['7', null],
    ['ab:cd', null],
  ])('normaliseTime(%j) → %j', (raw, expected) => expect(normaliseTime(raw)).toBe(expected));

  it('wraps minutes around midnight', () => {
    expect(fromMinutes(-30)).toBe('23:30');
    expect(fromMinutes(1440 + 75)).toBe('01:15');
  });

  it('validates the schedule', () => {
    expect(validateSchedule(DEFAULT_SCHEDULE)).toBeNull();
    expect(validateSchedule({ wakeTime: '6:30', workoutTime: '17:30' })).toBe('wakeInvalid');
    expect(validateSchedule({ wakeTime: '06:30', workoutTime: '06:45' })).toBe('workoutOutsideDay');
    expect(validateSchedule({ wakeTime: '06:30', workoutTime: '23:00' })).toBe('workoutOutsideDay');
  });

  it('uses the local calendar date', () => {
    expect(localDateKey(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });

  it('greets by time of day', () => {
    expect(greetingFor(new Date(2026, 0, 1, 11, 59))).toBe('morning');
    expect(greetingFor(new Date(2026, 0, 1, 12))).toBe('afternoon');
    expect(greetingFor(new Date(2026, 0, 1, 18))).toBe('evening');
  });

  it('sets the water goal', () => {
    expect(waterGoal(false)).toBe(10);
    expect(waterGoal(true)).toBe(8);
  });
});
