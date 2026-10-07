import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Notice, Panel, Segmented, Text, TextField } from '@/components/ui';
import { requestPermission } from '@/features/reminders/notifications';
import { useSchedule, useUpdateSchedule } from '@/features/today/api';
import { normaliseTime, validateSchedule, type DaySchedule } from '@/features/today/timeline';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

/** Wake-up and workout times (stored on the profile) and the reminders switch. */
export function ScheduleSettings() {
  const { schedule } = useSchedule();
  const update = useUpdateSchedule();
  // Remount the form when the saved times arrive or change, so its fields start from them.
  return (
    <ScheduleForm
      key={`${schedule.wakeTime}-${schedule.workoutTime}`}
      saved={schedule}
      update={update}
    />
  );
}

function ScheduleForm({
  saved,
  update,
}: {
  saved: DaySchedule;
  update: ReturnType<typeof useUpdateSchedule>;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const remindersEnabled = useSettings((s) => s.remindersEnabled);
  const setRemindersEnabled = useSettings((s) => s.setRemindersEnabled);
  const [wake, setWake] = useState(saved.wakeTime);
  const [workout, setWorkout] = useState(saved.workoutTime);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  function save() {
    const next = {
      wakeTime: normaliseTime(wake) ?? wake,
      workoutTime: normaliseTime(workout) ?? workout,
    };
    const problem = validateSchedule(next);
    setError(problem ? t(`me.scheduleErrors.${problem}`) : null);
    if (problem) return;
    setWake(next.wakeTime);
    setWorkout(next.workoutTime);
    update.mutate(next);
  }

  return (
    <Panel style={{ gap: spacing.md }}>
      <Text variant="heading" accessibilityRole="header">
        {t('me.schedule')}
      </Text>
      <Text variant="small" color="muted">
        {t('me.scheduleHint')}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField
            testID="wake-time"
            label={t('me.wake')}
            value={wake}
            onChangeText={setWake}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            testID="workout-time"
            label={t('me.workout')}
            value={workout}
            onChangeText={setWorkout}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
      </View>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Button
        testID="save-schedule"
        variant="ghost"
        label={update.isSuccess && !error ? t('common.saved') : t('me.saveSchedule')}
        loading={update.isPending}
        onPress={save}
      />
      <Segmented<'on' | 'off'>
        label={t('reminders.toggle')}
        value={remindersEnabled ? 'on' : 'off'}
        onChange={async (v) => {
          if (v === 'off') return setRemindersEnabled(false);
          const granted = await requestPermission();
          setDenied(!granted);
          setRemindersEnabled(granted);
        }}
        options={[
          { value: 'on', label: t('reminders.on') },
          { value: 'off', label: t('reminders.off') },
        ]}
      />
      {denied ? <Notice tone="warn">{t('reminders.denied')}</Notice> : null}
    </Panel>
  );
}
