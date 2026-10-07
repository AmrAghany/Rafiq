import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  cancelRescanReminder,
  hasPermission,
  scheduleRescanReminder,
} from '@/features/reminders/notifications';
import { useSchedule } from '@/features/today/api';
import { localDateKey } from '@/features/today/timeline';
import { useSettings } from '@/stores/settings';

import { useScans } from './api';
import { latestScan, rescanReminderAt, rescanStatus } from './rescan';

/** Keeps one local reminder scheduled for the day the next body scan is due. */
export function useRescanReminder() {
  const { t, i18n } = useTranslation();
  const enabled = useSettings((s) => s.remindersEnabled);
  const scans = useScans();
  const { schedule } = useSchedule();
  const last = latestScan(scans.data ?? [])?.scannedOn ?? null;
  const wake = schedule.wakeTime;

  useEffect(() => {
    void (async () => {
      if (!enabled || !last) return cancelRescanReminder();
      if (!(await hasPermission())) return;
      const { dueOn } = rescanStatus(last, localDateKey(new Date()));
      const at = rescanReminderAt(dueOn, wake, new Date());
      if (!at) return cancelRescanReminder();
      // No body numbers in the text: it can show on a locked screen.
      await scheduleRescanReminder(at, {
        title: t('progress.reminderTitle'),
        body: t('progress.reminderBody'),
      });
    })().catch(() => {
      // Best-effort; the card on Today still shows when a scan is due.
    });
  }, [enabled, last, wake, t, i18n.language]);
}
