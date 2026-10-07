import * as Notifications from 'expo-notifications';

import { buildPlan } from '@/features/plan/engine';
import { DEFAULT_SCHEDULE } from '@/features/today/timeline';

import { REMINDER_PREFIX, REST_TIMER_ID, syncReminders } from '../notifications';
import { buildReminders } from '../schedule';

const N = Notifications as jest.Mocked<typeof Notifications>;

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

beforeEach(() => jest.clearAllMocks());

describe('syncReminders', () => {
  it('replaces our reminders but leaves the rest timer alone', async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: `${REMINDER_PREFIX}old` },
      { identifier: REST_TIMER_ID },
    ] as never);
    const reminders = buildReminders({
      plan,
      now: new Date(2026, 9, 5, 12),
      schedule: DEFAULT_SCHEDULE,
      days: 0,
    });

    await syncReminders(reminders, (r) => ({ title: `T ${r.item.id}`, body: 'B' }));

    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(`${REMINDER_PREFIX}old`);
    expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(REST_TIMER_ID);
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(reminders.length);
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: `${REMINDER_PREFIX}2026-10-05:workout`,
      content: { title: 'T workout', body: 'B', data: { url: '/train' } },
      trigger: { type: 'date', date: new Date(2026, 9, 5, 17, 30), channelId: 'daily' },
    });
  });
});
