import { renderHook, waitFor } from '@testing-library/react-native';

import { changeLanguage } from '@/i18n';
import { useSettings } from '@/stores/settings';

import { useReminderSync } from '../useReminderSync';

const mockSync = jest.fn();
const mockCancel = jest.fn();
let mockGranted = true;

jest.mock('../notifications', () => ({
  hasPermission: async () => mockGranted,
  syncReminders: (...a: unknown[]) => mockSync(...a),
  cancelReminders: () => mockCancel(),
}));
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
      dateKey: '2026-10-05',
      plan: { data: { plan } },
      schedule: { wakeTime: '06:30', workoutTime: '17:30' },
      ramadan: false,
      log: { data: { completed_items: ['dinner'] } },
    }),
  };
});

beforeEach(() => {
  // Freeze only Date: Monday 5 October 2026, 12:00 (Upper body A at 17:30).
  jest.useFakeTimers({
    now: new Date(2026, 9, 5, 12),
    doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'],
  });
  mockSync.mockReset();
  mockCancel.mockReset();
  mockGranted = true;
});
afterEach(() => {
  jest.useRealTimers();
  return changeLanguage('en');
});

describe('useReminderSync', () => {
  it('cancels everything while reminders are off', async () => {
    useSettings.setState({ remindersEnabled: false });
    await renderHook(() => useReminderSync());
    await waitFor(() => expect(mockCancel).toHaveBeenCalled());
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('does nothing without OS permission', async () => {
    useSettings.setState({ remindersEnabled: true });
    mockGranted = false;
    await renderHook(() => useReminderSync());
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('schedules reminders worded in the member’s language, without done items', async () => {
    useSettings.setState({ remindersEnabled: true });
    await changeLanguage('ar');
    await renderHook(() => useReminderSync());
    await waitFor(() => expect(mockSync).toHaveBeenCalled());
    const [reminders, textFor] = mockSync.mock.calls[0];
    expect(reminders.length).toBeGreaterThan(0);
    const workout = reminders.find((r: { id: string }) => r.id === '2026-10-05:workout');
    expect(reminders.some((r: { id: string }) => r.id === '2026-10-05:dinner')).toBe(false);
    expect(textFor(workout).title).toBe('التمرين: الجزء العلوي (أ)');
    expect(textFor(workout).body).toBe('6 تمارين، نحو 60 دقيقة.');
  });
});
