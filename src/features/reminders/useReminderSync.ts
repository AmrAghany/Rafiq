import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useToday } from '@/features/today/api';
import { timelineText } from '@/features/today/timelineText';
import { useSettings } from '@/stores/settings';

import { cancelReminders, hasPermission, syncReminders } from './notifications';
import { buildReminders } from './schedule';

/**
 * Keeps scheduled reminders in step with the plan, schedule, language and what's already
 * done today. Runs whenever any of those change (and on each new day).
 */
export function useReminderSync() {
  const { t, i18n } = useTranslation();
  const enabled = useSettings((s) => s.remindersEnabled);
  const { dateKey, plan, schedule, ramadan, log } = useToday();
  const { wakeTime, workoutTime } = schedule;
  const planData = plan.data?.plan;
  const done = log.data?.completed_items.join(',') ?? '';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!enabled) return cancelReminders();
      if (!planData || !(await hasPermission()) || cancelled) return;
      const reminders = buildReminders({
        plan: planData,
        now: new Date(),
        schedule: { wakeTime, workoutTime },
        ramadan,
        doneToday: done ? done.split(',') : [],
      });
      await syncReminders(reminders, (r) => timelineText(r.item, t, i18n.language));
    })().catch(() => {
      // Scheduling is best-effort; the in-app timeline still works.
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, planData, wakeTime, workoutTime, ramadan, done, dateKey, t, i18n.language]);
}
