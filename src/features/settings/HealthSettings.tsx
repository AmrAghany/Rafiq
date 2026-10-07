import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { Button, Notice, Panel, Segmented, Text } from '@/components/ui';
import { healthSource, type HealthUnavailable } from '@/features/health/source';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Connect Apple Health (iOS) or Health Connect (Android) for sleep and steps. Read-only;
 * turning it off stops reading, and the phone's settings remove the permission.
 */
export function HealthSettings() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const enabled = useSettings((s) => s.healthEnabled);
  const setEnabled = useSettings((s) => s.setHealthEnabled);
  const [problem, setProblem] = useState<HealthUnavailable | 'denied' | null>(null);
  const [busy, setBusy] = useState(false);
  const source = healthSource();
  if (!source) return null;
  const name = t(`health.provider.${source.provider}`);

  async function connect() {
    if (!source) return;
    setProblem(null);
    setBusy(true);
    try {
      const unavailable = await source.unavailable();
      if (unavailable) return setProblem(unavailable);
      const granted = await source.requestAccess();
      if (!granted) return setProblem('denied');
      setEnabled(true);
    } catch {
      setProblem('denied');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel style={{ gap: spacing.md }}>
      <Text variant="heading" accessibilityRole="header">
        {name}
      </Text>
      <Text variant="small" color="muted">
        {t('health.body', { source: name })}
      </Text>
      {enabled ? (
        <>
          <Segmented<'on' | 'off'>
            label={t('health.toggle', { source: name })}
            value="on"
            onChange={(v) => v === 'off' && setEnabled(false)}
            options={[
              { value: 'on', label: t('reminders.on') },
              { value: 'off', label: t('reminders.off') },
            ]}
          />
          <Text variant="small" color="muted">
            {t(Platform.OS === 'ios' ? 'health.manageIos' : 'health.manageAndroid')}
          </Text>
        </>
      ) : (
        <Button
          testID="connect-health"
          label={t('health.connect', { source: name })}
          loading={busy}
          onPress={() => void connect()}
        />
      )}
      {problem ? (
        <Notice tone="warn">{t(`health.problems.${problem}`, { source: name })}</Notice>
      ) : null}
    </Panel>
  );
}
