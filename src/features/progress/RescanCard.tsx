import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Panel, Text } from '@/components/ui';
import { useTodayKey } from '@/features/today/api';

import { useScans } from './api';
import { latestScan, rescanStatus } from './rescan';
import { shortDate } from './TrendChart';

/**
 * Body scan status. On Today it only appears when a rescan is due or close; on Me
 * (`always`) it also shows when the next one is due.
 */
export function RescanCard({ always = false }: { always?: boolean }) {
  const { t, i18n } = useTranslation();
  const today = useTodayKey();
  const { data } = useScans();
  const last = latestScan(data ?? []);
  if (!last) return null;
  const status = rescanStatus(last.scannedOn, today);
  if (!always && status.state === 'ok') return null;

  const message =
    status.state === 'due'
      ? t('progress.due')
      : t('progress.dueOn', { date: shortDate(status.dueOn, i18n.language) });

  return (
    <Panel>
      <Text variant="heading" accessibilityRole="header">
        {t('progress.scanTitle')}
      </Text>
      <Text color={status.state === 'ok' ? 'muted' : 'ink'}>{message}</Text>
      <Text variant="small" color="muted">
        {t('progress.lastScan', { date: shortDate(last.scannedOn, i18n.language) })}
      </Text>
      {status.state === 'ok' ? (
        <Button
          testID="open-progress"
          variant="ghost"
          label={t('progress.open')}
          onPress={() => router.push('/progress')}
        />
      ) : (
        <Button
          testID="start-rescan"
          label={t('progress.newScan')}
          onPress={() => router.push('/rescan')}
        />
      )}
    </Panel>
  );
}
