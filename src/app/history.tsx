import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, Notice, Panel, Screen, Text } from '@/components/ui';
import { exerciseName, workoutName } from '@/features/plan/names';
import { useTodayKey } from '@/features/today/api';
import { localDateKey } from '@/features/today/timeline';
import { useWorkoutHistory } from '@/features/train/api';
import { bestSets } from '@/features/train/history';
import { useTheme } from '@/theme/ThemeProvider';

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const today = useTodayKey();
  // Include today's session too: "before tomorrow".
  const [y, m, d] = today.split('-').map(Number);
  const until = localDateKey(new Date(y, m - 1, d + 1));
  const { data, isPending, isError, refetch } = useWorkoutHistory(until);

  return (
    <Screen edges={[]}>
      {isPending ? (
        <ActivityIndicator />
      ) : isError ? (
        <>
          <Notice tone="warn">{t('auth.errors.generic')}</Notice>
          <Button label={t('common.retry')} onPress={() => void refetch()} />
        </>
      ) : !data?.length ? (
        <Text color="muted">{t('history.empty')}</Text>
      ) : (
        data.map((session) => {
          const [sy, sm, sd] = session.log_date.split('-').map(Number);
          const date = new Date(sy, sm - 1, sd).toLocaleDateString(i18n.language, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
          const sets = session.set_logs.filter((s) => s.completed).length;
          return (
            <Panel key={session.id}>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text variant="label" style={{ flexShrink: 1 }}>
                  {workoutName(session.workout_key, i18n.language)}
                </Text>
                <Text variant="small" color="muted">
                  {date}
                </Text>
              </View>
              <Text variant="small" color={session.completed_at ? 'ok' : 'muted'}>
                {`${session.completed_at ? t('history.completed') : t('history.unfinished')} · ${t('history.sets', { count: sets })}`}
              </Text>
              {Object.entries(bestSets(session)).map(([key, best]) => (
                <Text key={key} variant="small">
                  {t('history.best', {
                    exercise: exerciseName(key, i18n.language),
                    kg: best.kg,
                    reps: best.reps ?? '–',
                  })}
                </Text>
              ))}
            </Panel>
          );
        })
      )}
    </Screen>
  );
}
