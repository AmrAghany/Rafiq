// Native side of reminders: permissions, the Android channel, and (re)scheduling.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder } from './schedule';

export const REMINDER_PREFIX = 'reminder:';
export const REST_TIMER_ID = 'rest-timer';
const CHANNEL_ID = 'daily';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let channelReady: Promise<unknown> | null = null;
function ensureChannel() {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily plan',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  return channelReady;
}

export async function hasPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

export async function requestPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export interface ReminderText {
  title: string;
  body: string;
}

/** Cancels our pending reminders and schedules the given ones. The rest timer is left alone. */
export async function syncReminders(
  reminders: readonly Reminder[],
  textFor: (r: Reminder) => ReminderText,
): Promise<void> {
  await ensureChannel();
  await cancelReminders();
  for (const r of reminders) {
    const { title, body } = textFor(r);
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_PREFIX + r.id,
      content: { title, body, data: { url: r.item.kind === 'train' ? '/train' : '/' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.date,
        channelId: CHANNEL_ID,
      },
    });
  }
}

export async function cancelReminders(): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((n) => n.identifier.startsWith(REMINDER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Buzz when rest is over, in case the member has left the app. */
export async function scheduleRestEnd(seconds: number, text: ReminderText): Promise<void> {
  if (!(await hasPermission())) return;
  await ensureChannel();
  await Notifications.cancelScheduledNotificationAsync(REST_TIMER_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: REST_TIMER_ID,
    content: { ...text, data: { url: '/train' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId: CHANNEL_ID,
    },
  });
}

export function cancelRestEnd(): Promise<void> {
  return Notifications.cancelScheduledNotificationAsync(REST_TIMER_ID);
}
