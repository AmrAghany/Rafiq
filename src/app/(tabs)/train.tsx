import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LinkButton, Notice, Panel, ProgressBar, Screen, Text } from '@/components/ui';
import { EXERCISES, isLightDay, prescribe, WORKOUTS, type Plan } from '@/features/plan/engine';
import { workoutName } from '@/features/plan/names';
import { useToday, useUpdateDailyLog } from '@/features/today/api';
import {
  exerciseHistory,
  useSessionActions,
  useTodaySession,
  useWorkoutHistory,
} from '@/features/train/api';
import { useStationPairing } from '@/features/stations/api';
import { StationCard } from '@/features/stations/StationCard';
import { ExerciseCard, RestTimer } from '@/features/train/components';
import { DEFAULT_INCREMENT_KG, nextTarget } from '@/features/train/progression';
import { useTheme } from '@/theme/ThemeProvider';

function nextWorkout(plan: Plan, from: number) {
  for (let i = 1; i <= 7; i++) {
    const idx = (from + i) % 7;
    const key = plan.week[idx].workoutKey;
    if (key) return { idx, key };
  }
  return null;
}

export default function TrainScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { dateKey, todayIndex, plan, log } = useToday();
  const updateLog = useUpdateDailyLog(dateKey);
  const p = plan.data?.plan;
  const workoutKey = p?.week[todayIndex].workoutKey ?? null;
  const readiness = log.data?.readiness_score ?? null;
  const light = isLightDay(readiness);

  const hasStationLifts =
    !!workoutKey && WORKOUTS[workoutKey].exerciseKeys.some((k) => EXERCISES[k].smartStation);
  const pairing = useStationPairing({ enabled: hasStationLifts });
  const sessionQuery = useTodaySession(dateKey, workoutKey, { poll: !!pairing.data });
  const historyQuery = useWorkoutHistory(dateKey);
  const actions = useSessionActions({
    date: dateKey,
    workoutKey: workoutKey ?? '',
    planId: plan.data?.id ?? null,
    readinessScore: readiness,
  });
  const [accepted, setAccepted] = useState<Record<string, number>>({});
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);

  const history = useMemo(() => exerciseHistory(historyQuery.data ?? []), [historyQuery.data]);
  const session = sessionQuery.data ?? null;
  const swaps = useMemo(() => session?.swaps ?? {}, [session?.swaps]);

  const exercises = useMemo(() => {
    if (!p || !workoutKey) return [];
    return WORKOUTS[workoutKey].exerciseKeys.map((plannedKey) => {
      const key = swaps[plannedKey] ?? plannedKey;
      const normal = prescribe(p, key, false);
      const today = prescribe(p, key, light);
      const target = nextTarget({
        startKg: normal.loadKg,
        lightStartKg: today.loadKg,
        history: history[key] ?? [],
        prescribedSets: normal.sets,
        incrementKg: EXERCISES[key]?.progressionKg ?? DEFAULT_INCREMENT_KG,
        light,
      });
      const targetKg = accepted[key] ?? target.targetKg;
      return {
        plannedKey,
        key,
        prescription: today,
        targetKg,
        suggestedKg: accepted[key] != null ? null : target.suggestedKg,
        sets: (session?.set_logs ?? []).filter((s) => s.exercise_key === key),
        lastSession: history[key]?.[0],
      };
    });
  }, [p, workoutKey, swaps, light, history, accepted, session?.set_logs]);

  const total = exercises.reduce((a, e) => a + e.prescription.sets, 0);
  const done = exercises.reduce(
    (a, e) => a + e.sets.filter((s) => s.completed && s.set_number <= e.prescription.sets).length,
    0,
  );
  const allDone = total > 0 && done >= total;

  // Finishing the last set completes the session and ticks the workout on the timeline.
  useEffect(() => {
    if (!allDone || !session?.id || session.completed_at || actions.complete.isPending) return;
    actions.complete.mutate();
    const items = log.data?.completed_items ?? [];
    if (!items.includes('workout')) updateLog.mutate({ completed_items: [...items, 'workout'] });
  }, [allDone, session?.id, session?.completed_at]); // eslint-disable-line react-hooks/exhaustive-deps

  if (plan.isPending || log.isPending) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (!p) {
    return (
      <Screen>
        <Notice tone="warn">{t('auth.errors.generic')}</Notice>
        <Button label={t('common.retry')} onPress={() => void plan.refetch()} />
      </Screen>
    );
  }

  const historyLink = (
    <LinkButton label={t('train.history')} onPress={() => router.push('/history')} />
  );

  if (!workoutKey) {
    const next = nextWorkout(p, todayIndex);
    return (
      <Screen>
        <Text variant="small" color="muted">
          {t('train.today')}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {t('train.restTitle')}
        </Text>
        <Panel>
          <Text>{t('train.restBody')}</Text>
          {next ? (
            <Text color="muted">
              {t('train.nextWorkout', {
                day: t(`days.short.${next.idx}` as 'days.short.0'),
                workout: workoutName(next.key, i18n.language),
              })}
            </Text>
          ) : null}
        </Panel>
        {historyLink}
      </Screen>
    );
  }

  const tomorrowType = p.week[(todayIndex + 1) % 7].dayType;

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Text variant="small" color="muted">
          {t('train.today')}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {workoutName(workoutKey, i18n.language)}
        </Text>
        {light ? <Notice>{t('train.lightNotice')}</Notice> : null}
        {readiness == null ? <Notice tone="medium">{t('train.checkinNudge')}</Notice> : null}
        {hasStationLifts && !pairing.isPending ? (
          <StationCard pairing={pairing.data ?? null} />
        ) : null}

        <Panel>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text testID="sets-progress" variant="label">
              {t('train.progress', { done, total })}
            </Text>
            <Text variant="label">{`${Math.round((done / total) * 100)}%`}</Text>
          </View>
          <ProgressBar value={done / total} label={t('train.progress', { done, total })} />
          {sessionQuery.isPending ? <ActivityIndicator /> : null}
          {exercises.map((e) => (
            <ExerciseCard
              key={e.plannedKey}
              plannedKey={e.plannedKey}
              prescription={e.prescription}
              targetKg={e.targetKg}
              suggestedKg={e.suggestedKg}
              onAcceptSuggestion={(kg) => setAccepted((a) => ({ ...a, [e.key]: kg }))}
              lastSession={e.lastSession}
              sets={e.sets}
              swappedFrom={e.key !== e.plannedKey ? e.plannedKey : null}
              onSaveSet={(set) => actions.saveSet.mutate(set)}
              onSetCompleted={() => setRestStartedAt(Date.now())}
              onToggleSwap={() => {
                const next = { ...swaps };
                if (next[e.plannedKey]) delete next[e.plannedKey];
                else next[e.plannedKey] = EXERCISES[e.plannedKey].alternativeKey!;
                actions.setSwaps.mutate(next);
              }}
            />
          ))}
        </Panel>

        {allDone ? (
          <Panel>
            <Text variant="heading" accessibilityRole="header">
              {t('train.completeTitle')}
            </Text>
            <Text>
              {t('train.completeBody', {
                dayType: p.safety.hideCalories
                  ? t('today.balancedDay')
                  : t(`dayType.${tomorrowType}`),
              })}
            </Text>
          </Panel>
        ) : null}

        {historyLink}
        {/* Room for the floating rest timer. */}
        <View style={{ height: restStartedAt ? 60 : 0 }} />
      </Screen>
      {restStartedAt && !allDone ? (
        <RestTimer startedAt={restStartedAt} onDone={() => setRestStartedAt(null)} />
      ) : null}
    </SafeAreaView>
  );
}
