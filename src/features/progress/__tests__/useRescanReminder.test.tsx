import { renderHook, waitFor } from '@testing-library/react-native';

import { useSettings } from '@/stores/settings';

import { useRescanReminder } from '../useRescanReminder';

const mockSchedule = jest.fn();
const mockCancel = jest.fn();
let mockLast: string | null = '2026-10-01';

jest.mock('@/features/reminders/notifications', () => ({
  hasPermission: async () => true,
  scheduleRescanReminder: (...a: unknown[]) => mockSchedule(...a),
  cancelRescanReminder: () => mockCancel(),
}));
jest.mock('@/features/today/api', () => ({
  useSchedule: () => ({ schedule: { wakeTime: '06:30', workoutTime: '17:30' } }),
}));
jest.mock('../api', () => ({
  useScans: () => ({
    data: mockLast ? [{ id: 's', scannedOn: mockLast, source: 'manual', weightKg: 80 }] : [],
  }),
}));

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 7, 12, 0),
    doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'],
  });
  mockSchedule.mockReset().mockResolvedValue(undefined);
  mockCancel.mockReset().mockResolvedValue(undefined);
  mockLast = '2026-10-01';
  useSettings.setState({ remindersEnabled: true });
});
afterEach(() => jest.useRealTimers());

describe('useRescanReminder', () => {
  it('schedules one reminder for the morning the next scan is due, without body numbers', async () => {
    await renderHook(() => useRescanReminder());
    await waitFor(() => expect(mockSchedule).toHaveBeenCalled());
    const [date, text] = mockSchedule.mock.calls[0];
    expect(date).toEqual(new Date(2026, 9, 29, 8, 30));
    expect(text.title).toBe('Time for your monthly body scan');
    expect(`${text.title} ${text.body}`).not.toMatch(/\d/);
  });

  it('cancels it when reminders are off or there is no scan', async () => {
    useSettings.setState({ remindersEnabled: false });
    await renderHook(() => useRescanReminder());
    await waitFor(() => expect(mockCancel).toHaveBeenCalled());
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
