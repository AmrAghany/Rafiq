import { fireEvent, render, screen, within } from '@testing-library/react-native';

import TodayScreen from '@/app/(tabs)/index';
import type { HealthFlag } from '@/features/plan/engine';

import type { DailyLog } from '../api';

const mockUpdate = jest.fn();
let mockLog: DailyLog;
let mockFlags: HealthFlag[] = [];

jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), push: jest.fn() } }));
jest.mock('@/features/reminders/notifications', () => ({ requestPermission: jest.fn() }));
jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: { display_name: 'Sam Haddad' } }),
}));
jest.mock('../api', () => {
  const { buildPlan: build } = jest.requireActual('@/features/plan/engine');
  return {
    useToday: () => ({
      dateKey: '2026-10-05',
      todayIndex: 0, // Monday: Upper body A, medium-carb day
      plan: {
        isPending: false,
        isError: false,
        data: {
          id: 'p1',
          plan: build({
            sex: 'male',
            weightKg: 82,
            goal: 'recomp',
            trainingDays: 4,
            experience: 'intermediate',
            bodyFatPct: 18.4,
            bmrKcal: 1810,
            healthFlags: mockFlags,
          }),
        },
      },
      schedule: { wakeTime: '06:30', workoutTime: '17:30' },
      ramadan: false,
      log: { isPending: false, isError: false, data: mockLog },
    }),
    useUpdateDailyLog: () => ({ mutate: mockUpdate }),
  };
});

beforeEach(() => {
  mockUpdate.mockReset();
  mockFlags = [];
  mockLog = { checkin: null, readiness_score: null, water_glasses: 2, completed_items: [] };
});

describe('Today screen', () => {
  it('greets the member and shows today’s targets', async () => {
    await render(<TodayScreen />);
    expect(screen.getByText(/, Sam$/)).toBeTruthy();
    expect(screen.getByText('Medium-carb day')).toBeTruthy();
    expect(screen.getByText('2670')).toBeTruthy();
    expect(screen.getByText('Workout: Upper body A')).toBeTruthy();
  });

  it('turns the morning check-in into a readiness score and ticks it off', async () => {
    await render(<TodayScreen />);
    await fireEvent.press(
      within(screen.getByText('How did you sleep?').parent!.parent!).getByLabelText('Badly'),
    );
    await fireEvent.press(screen.getByLabelText('Low'));
    await fireEvent.press(screen.getByLabelText('A little'));
    await fireEvent.press(screen.getByTestId('checkin-submit'));
    expect(mockUpdate).toHaveBeenCalledWith({
      checkin: { sleep: 1, energy: 1, soreness: 2, score: 50 },
      readiness_score: 50,
      completed_items: ['checkin'],
    });
  });

  it('shows the light-day message for a low score', async () => {
    mockLog = {
      ...mockLog,
      checkin: { sleep: 1, energy: 1, soreness: 2, score: 50 },
      readiness_score: 50,
    };
    await render(<TodayScreen />);
    expect(screen.getByTestId('readiness-score')).toHaveTextContent('50');
    expect(screen.getByText(/Light day: one less set/)).toBeTruthy();
  });

  it('tracks water', async () => {
    await render(<TodayScreen />);
    expect(screen.getByTestId('water-count')).toHaveTextContent('2 / 10 glasses');
    await fireEvent.press(screen.getByTestId('water-add'));
    expect(mockUpdate).toHaveBeenCalledWith({ water_glasses: 3 });
  });

  it('ticks timeline items on and off', async () => {
    mockLog = { ...mockLog, completed_items: ['breakfast'] };
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByTestId('done-lunch'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ completed_items: ['breakfast', 'lunch'] });
    await fireEvent.press(screen.getByTestId('done-breakfast'));
    expect(mockUpdate).toHaveBeenLastCalledWith({ completed_items: [] });
  });

  it('previews another day without check-in or tick boxes', async () => {
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByLabelText(/^Wed, Rest/));
    expect(screen.getByText('Wed preview')).toBeTruthy();
    expect(screen.getByText('Active recovery')).toBeTruthy();
    expect(screen.queryByTestId('checkin-submit')).toBeNull();
    expect(screen.queryByTestId('done-lunch')).toBeNull();
    await fireEvent.press(screen.getByText('Back to today'));
    expect(screen.getByTestId('checkin-submit')).toBeTruthy();
  });

  it('hides calorie numbers for careful health flags', async () => {
    mockFlags = ['eating_disorder'];
    await render(<TodayScreen />);
    expect(screen.getByText('Balanced eating day')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/kcal|2670/);
  });
});
