import { describe, expect, it } from 'vitest';

import {
  adherence,
  exerciseName,
  isCareful,
  liftProgress,
  mondayOf,
  weeklySummary,
  workoutName,
} from '../summary';
import { bundle } from './fixtures';

describe('coach summary', () => {
  it('groups days by the Monday of their week', () => {
    expect(mondayOf('2026-10-07')).toBe('2026-10-05');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
    expect(mondayOf('2026-10-04')).toBe('2026-09-28');
  });

  it('averages each week and counts workouts, sets and meals', () => {
    expect(weeklySummary(bundle)).toEqual([
      {
        week: '2026-09-28',
        readiness: 80,
        sleepMinutes: 420,
        steps: 7010,
        workoutsDone: 1,
        setsDone: 2,
        mealsLogged: 3,
        kcalPerDay: 900,
      },
      {
        week: '2026-10-05',
        readiness: 50,
        sleepMinutes: 300,
        steps: null,
        workoutsDone: 0,
        setsDone: 1,
        mealsLogged: 1,
        kcalPerDay: null,
      },
    ]);
  });

  it('tracks the first and heaviest completed set per lift', () => {
    expect(liftProgress(bundle)).toEqual([
      {
        exerciseKey: 'bench_press',
        first: { date: '2026-09-28', weightKg: 30, reps: 8 },
        best: { date: '2026-10-05', weightKg: 32.5, reps: 5 },
        sessions: 2,
      },
    ]);
  });

  it('compares planned and finished workouts', () => {
    expect(adherence(bundle)).toEqual({ planned: 6, done: 1 });
    expect(adherence({ ...bundle, plan: null })).toBeNull();
  });

  it('names lifts and workouts in either language, and spots careful members', () => {
    expect(exerciseName('bench_press', 'en')).toBe('Flat bench press');
    expect(exerciseName('bench_press', 'ar')).toBe('ضغط البنش المستوي');
    expect(workoutName('full_body_a', 'en')).toBe('Full body A');
    expect(exerciseName('unknown_key', 'en')).toBe('unknown_key');
    expect(isCareful(bundle)).toBe(false);
    expect(
      isCareful({ ...bundle, profile: { ...bundle.profile, health_flags: ['pregnancy'] } }),
    ).toBe(true);
  });
});
