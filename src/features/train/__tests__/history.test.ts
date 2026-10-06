import { exerciseHistory, type WorkoutSession } from '../api';
import { summariseSession } from '../components';
import { bestSets } from '../history';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const set = (
  exercise_key: string,
  set_number: number,
  kg: number | null,
  reps: number,
  completed = true,
) => ({
  exercise_key,
  swapped_from_key: null,
  set_number,
  target_reps: 6,
  target_weight_kg: kg,
  actual_reps: reps,
  actual_weight_kg: kg,
  completed,
});

const sessions: WorkoutSession[] = [
  {
    id: 's2',
    workout_key: 'lower_a',
    log_date: '2026-10-03',
    readiness_score: 80,
    completed_at: '2026-10-03T18:30:00Z',
    swaps: {},
    set_logs: [set('back_squat', 2, 70, 5), set('back_squat', 1, 70, 6), set('plank', 1, null, 0)],
  },
  {
    id: 's1',
    workout_key: 'lower_a',
    log_date: '2026-09-30',
    readiness_score: null,
    completed_at: null,
    swaps: {},
    set_logs: [set('back_squat', 1, 65, 6), set('back_squat', 2, 75, 3, false)],
  },
];

describe('exerciseHistory', () => {
  it('groups sets by exercise, newest session first, sets in order', () => {
    const h = exerciseHistory(sessions);
    expect(h.back_squat.map((s) => s.date)).toEqual(['2026-10-03', '2026-09-30']);
    expect(h.back_squat[0].sets.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(h.plank).toHaveLength(1);
  });
});

describe('bestSets', () => {
  it('keeps the heaviest completed set per exercise and ignores bodyweight', () => {
    expect(bestSets(sessions[0])).toEqual({ back_squat: { kg: 70, reps: 6 } });
    expect(bestSets(sessions[1])).toEqual({ back_squat: { kg: 65, reps: 6 } }); // 75 kg set not completed
  });
});

describe('summariseSession', () => {
  it('shows weight and reps, or reps only', () => {
    const h = exerciseHistory(sessions);
    expect(summariseSession(h.back_squat[0], 'kg')).toBe('70 kg × 6, 5');
    expect(
      summariseSession(
        {
          date: 'x',
          sets: [
            { setNumber: 1, targetReps: 12, actualReps: 12, actualWeightKg: null, completed: true },
          ],
        },
        'kg',
      ),
    ).toBe('12');
  });
});
