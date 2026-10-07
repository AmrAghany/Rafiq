import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, Notice, Panel, Screen, Text } from '@/components/ui';
import { useScans } from '@/features/progress/api';
import { RescanCard } from '@/features/progress/RescanCard';
import { METRICS, seriesFor, type BodyScan, type Metric } from '@/features/progress/rescan';
import { shortDate, TrendChart } from '@/features/progress/TrendChart';
import { useActivePlan } from '@/features/profile/api';
import { useTheme } from '@/theme/ThemeProvider';

const dash = (v: number | null, unit: string) => (v == null ? '–' : `${v} ${unit}`);

export default function ProgressScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const scans = useScans();
  const plan = useActivePlan();
  // Body-number charts can feed an eating disorder, so they're left out for that answer.
  const careful = !!plan.data?.input.healthFlags.includes('eating_disorder');

  if (scans.isPending) {
    return (
      <Screen edges={[]}>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (scans.isError) {
    return (
      <Screen edges={[]}>
        <Notice tone="warn">{t('auth.errors.generic')}</Notice>
        <Button label={t('common.retry')} onPress={() => void scans.refetch()} />
      </Screen>
    );
  }

  const data = scans.data;
  const kg = t('common.kg');
  const units: Record<Metric, string> = { weightKg: kg, bodyFatPct: '%', skeletalMuscleKg: kg };
  const rowLabel = (s: BodyScan) =>
    [
      shortDate(s.scannedOn, i18n.language),
      `${t('progress.metric.weightKg')} ${dash(s.weightKg, kg)}`,
      `${t('progress.metric.bodyFatPct')} ${dash(s.bodyFatPct, '%')}`,
      `${t('progress.metric.skeletalMuscleKg')} ${dash(s.skeletalMuscleKg, kg)}`,
    ].join(', ');

  return (
    <Screen edges={[]}>
      <RescanCard always />

      {careful ? (
        <Notice tone="medium">{t('progress.carefulNotice')}</Notice>
      ) : (
        METRICS.map((metric) => {
          const points = seriesFor(data, metric);
          return (
            <TrendChart
              // A new scan starts the chart on the latest point again.
              key={`${metric}-${points.length}`}
              testID={`chart-${metric}`}
              title={t(`progress.metric.${metric}`)}
              unit={units[metric]}
              points={points}
            />
          );
        })
      )}

      {!careful ? (
        <Panel>
          <Text variant="heading" accessibilityRole="header">
            {t('progress.history')}
          </Text>
          {[...data].reverse().map((s) => (
            <View
              key={s.id}
              testID="scan-row"
              accessible
              accessibilityLabel={rowLabel(s)}
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                columnGap: spacing.md,
                rowGap: 2,
                paddingVertical: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}>
              <Text variant="label" style={{ minWidth: 64 }}>
                {shortDate(s.scannedOn, i18n.language)}
              </Text>
              <Text>{dash(s.weightKg, kg)}</Text>
              <Text color="muted">{`${t('progress.fatShort')} ${dash(s.bodyFatPct, '%')}`}</Text>
              <Text color="muted">
                {`${t('progress.muscleShort')} ${dash(s.skeletalMuscleKg, kg)}`}
              </Text>
            </View>
          ))}
        </Panel>
      ) : null}

      <Button
        testID="progress-rescan"
        variant="ghost"
        label={t('progress.newScan')}
        onPress={() => router.push('/rescan')}
      />
    </Screen>
  );
}
