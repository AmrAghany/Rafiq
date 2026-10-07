import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Notice, Panel, Segmented, Text, TextField } from '@/components/ui';
import { useSchedule, useUpdateRamadan } from '@/features/today/api';
import { normaliseTime, validateRamadanTimes, type RamadanTimes } from '@/features/today/timeline';
import { useTheme } from '@/theme/ThemeProvider';

/** Ramadan mode switch and the suhoor and iftar times its day is built around. */
export function RamadanSettings() {
  const { ramadan, ramadanTimes } = useSchedule();
  const update = useUpdateRamadan();
  // The profile is loaded before any tab renders, so the fields can start from it.
  return <RamadanForm on={ramadan} saved={ramadanTimes} update={update} />;
}

function RamadanForm({
  on,
  saved,
  update,
}: {
  on: boolean;
  saved: RamadanTimes;
  update: ReturnType<typeof useUpdateRamadan>;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [suhoor, setSuhoor] = useState(saved.suhoorTime);
  const [iftar, setIftar] = useState(saved.iftarTime);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  function save() {
    const next = {
      suhoorTime: normaliseTime(suhoor) ?? suhoor,
      iftarTime: normaliseTime(iftar) ?? iftar,
    };
    const problem = validateRamadanTimes(next);
    setError(problem ? t(`ramadan.errors.${problem}`) : null);
    setJustSaved(false);
    if (problem) return;
    setSuhoor(next.suhoorTime);
    setIftar(next.iftarTime);
    update.mutate(
      { suhoor_time: next.suhoorTime, iftar_time: next.iftarTime },
      { onSuccess: () => setJustSaved(true) },
    );
  }

  return (
    <Panel style={{ gap: spacing.md }}>
      <Text variant="heading" accessibilityRole="header">
        {t('ramadan.title')}
      </Text>
      <Text variant="small" color="muted">
        {t('ramadan.body')}
      </Text>
      <Segmented<'on' | 'off'>
        label={t('ramadan.toggle')}
        value={on ? 'on' : 'off'}
        onChange={(v) => update.mutate({ ramadan_mode: v === 'on' })}
        options={[
          { value: 'on', label: t('reminders.on') },
          { value: 'off', label: t('reminders.off') },
        ]}
      />
      {on ? (
        <>
          <Text variant="small" color="muted">
            {t('ramadan.timesHint')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                testID="suhoor-time"
                label={t('ramadan.suhoor')}
                value={suhoor}
                onChangeText={setSuhoor}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                testID="iftar-time"
                label={t('ramadan.iftar')}
                value={iftar}
                onChangeText={setIftar}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>
          {error ? <Notice tone="warn">{error}</Notice> : null}
          <Button
            testID="save-ramadan"
            variant="ghost"
            label={justSaved && !error ? t('common.saved') : t('ramadan.save')}
            loading={update.isPending}
            onPress={save}
          />
        </>
      ) : null}
      {update.isError ? <Notice tone="warn">{t('auth.errors.generic')}</Notice> : null}
    </Panel>
  );
}
