import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TrainScreen from '@/app/(tabs)/train';

import type { SetLog, WorkoutSession } from '../api';

const mockSaveSet = jest.fn();
const mockSetSwaps = jest.fn();
const mockComplete = jest.fn();
const mockUpdateLog = jest.fn();
let mockReadiness: number | null = null;
let mockTodayIndex = 1; // Tuesday: Lower body A
let mockSession: WorkoutSession | null = null;
let mockHistory: WorkoutSession[] = [];

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/today/api', () => {
  const { buildPlan } = jest.requireActual('@/features/plan/engine');
  const plan = buildPlan({
    sex: 'male',
    weightKg: 82,
    goal: 'recomp',
    trainingDays: 4,
    experience: 'intermediate',
    bodyFatPct: 18.4,
    bmrKcal: 1810,
    healthFlags: [],
  });
  return {
    useToday: () => ({
      dateKey: '2026-10-06',
      todayIndex: mockTodayIndex,
      plan: { isPending: false, isError: false, data: { id: 'p1', plan } },
      log: {
        isPending: false,
        data: {
          readiness_score: mockReadiness,
          completed_items: [],
          water_glasses: 0,
          checkin: null,
        },
      },
    }),
    useUpdateDailyLog: () => ({ mutate: mockUpdateLog }),
  };
});
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  useTodaySession: () => ({ data: mockSession, isPending: false }),
  useWorkoutHistory: () => ({ data: mockHistory }),
  useSessionActions: () => ({
    saveSet: { mutate: mockSaveSet },
    setSwaps: { mutate: mockSetSwaps },
    complete: { mutate: mockComplete, isPending: false },
  }),
}));

const squatSets = (date: string, kg: number): WorkoutSession => ({
  id: date,
  workout_key: 'lower_a',
  log_date: date,
  readiness_score: 80,
  completed_at: date,
  swaps: {},
  set_logs: [1, 2, 3, 4].map((n) => ({
    exercise_key: 'back_squat',
    swapped_from_key: null,
    set_number: n,
    target_reps: 6,
    target_weight_kg: kg,
    actual_reps: 6,
    actual_weight_kg: kg,
    completed: true,
  })),
});

beforeEach(() => {
  jest.useFakeTimers();
  [mockSaveSet, mockSetSwaps, mockComplete, mockUpdateLog].forEach((m) => m.mockReset());
  mockReadiness = null;
  mockTodayIndex = 1;
  mockSession = null;
  mockHistory = [];
});
afterEach(() => jest.useRealTimers());

describe('Train screen', () => {
  it('shows today’s workout from the plan', async () => {
    await render(<TrainScreen />);
    expect(screen.getByText('Lower body A')).toBeTruthy();
    expect(screen.getByText('4 × 6 reps, 65 kg')).toBeTruthy(); // back squat
    expect(screen.getByText('Auto-tracked at Rack 3')).toBeTruthy();
    expect(screen.getByText('3 × 45 s')).toBeTruthy(); // plank
    expect(screen.getByTestId('sets-progress')).toHaveTextContent('0 of 21 sets done');
    expect(screen.getByText(/Do your morning check-in/)).toBeTruthy();
  });

  it('makes a low-readiness day lighter', async () => {
    mockReadiness = 50;
    await render(<TrainScreen />);
    expect(screen.getByText(/Low readiness this morning/)).toBeTruthy();
    expect(screen.getByText('3 × 6 reps, 60 kg')).toBeTruthy();
    expect(screen.getByTestId('sets-progress')).toHaveTextContent('0 of 15 sets done');
  });

  it('logs a set with the edited weight and reps, then starts the rest timer', async () => {
    await render(<TrainScreen />);
    await fireEvent.changeText(screen.getByTestId('weight-back_squat-1'), '67,5');
    await fireEvent.changeText(screen.getByTestId('reps-back_squat-1'), '5');
    await fireEvent.press(screen.getByTestId('set-back_squat-1'));
    expect(mockSaveSet).toHaveBeenCalledWith({
      exercise_key: 'back_squat',
      swapped_from_key: null,
      set_number: 1,
      target_reps: 6,
      target_weight_kg: 65,
      actual_reps: 5,
      actual_weight_kg: 67.5,
      completed: true,
    });
    expect(screen.getByTestId('rest-timer')).toHaveTextContent('Rest 1:30');
    await act(async () => jest.advanceTimersByTime(30_000));
    expect(screen.getByTestId('rest-timer')).toHaveTextContent('Rest 1:00');
    await act(async () => jest.advanceTimersByTime(61_000));
    expect(screen.queryByTestId('rest-timer')).toBeNull();
  });

  it('carries on from last time and suggests more weight after two complete sessions', async () => {
    mockHistory = [squatSets('2026-10-03', 70), squatSets('2026-09-29', 70)];
    await render(<TrainScreen />);
    expect(screen.getByText('4 × 6 reps, 70 kg')).toBeTruthy();
    expect(screen.getByText('Last time: 70 kg × 6, 6, 6, 6')).toBeTruthy();
    expect(screen.getByText(/Ready for 75 kg\?/)).toBeTruthy(); // squat steps up 5 kg
    await fireEvent.press(screen.getByTestId('accept-back_squat'));
    expect(screen.getByText('4 × 6 reps, 75 kg')).toBeTruthy();
    expect(screen.queryByText(/Ready for 75 kg\?/)).toBeNull();
  });

  it('swaps a busy machine for its alternative', async () => {
    await render(<TrainScreen />);
    await fireEvent.press(screen.getAllByText('Machine busy? Swap for Leg press')[0]);
    expect(mockSetSwaps).toHaveBeenCalledWith({ back_squat: 'leg_press' });
  });

  it('shows a swapped exercise and the way back', async () => {
    mockSession = {
      ...squatSets('2026-10-06', 0),
      set_logs: [],
      completed_at: null,
      swaps: { back_squat: 'leg_press' },
    };
    await render(<TrainScreen />);
    expect(screen.getByText('Back to Back squat')).toBeTruthy();
    expect(screen.getByTestId('exercise-leg_press')).toBeTruthy();
  });

  it('completes the session when every set is done', async () => {
    const all: SetLog[] = [];
    const { WORKOUTS, buildPlan, prescribe } = jest.requireActual('@/features/plan/engine');
    const plan = buildPlan({
      sex: 'male',
      weightKg: 82,
      goal: 'recomp',
      trainingDays: 4,
      experience: 'intermediate',
      bodyFatPct: 18.4,
      bmrKcal: 1810,
      healthFlags: [],
    });
    for (const key of WORKOUTS.lower_a.exerciseKeys) {
      for (let n = 1; n <= prescribe(plan, key).sets; n++) {
        all.push({
          exercise_key: key,
          swapped_from_key: null,
          set_number: n,
          target_reps: 6,
          target_weight_kg: null,
          actual_reps: 6,
          actual_weight_kg: null,
          completed: true,
        });
      }
    }
    mockSession = {
      id: 's',
      workout_key: 'lower_a',
      log_date: '2026-10-06',
      readiness_score: null,
      completed_at: null,
      swaps: {},
      set_logs: all,
    };
    await render(<TrainScreen />);
    expect(screen.getByText('Workout complete')).toBeTruthy();
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockUpdateLog).toHaveBeenCalledWith({ completed_items: ['workout'] });
  });

  it('shows a rest day with the next workout', async () => {
    mockTodayIndex = 2; // Wednesday
    await render(<TrainScreen />);
    expect(screen.getByText('Rest day')).toBeTruthy();
    expect(screen.getByText('Next workout: Thu, Upper body B')).toBeTruthy();
  });
});
