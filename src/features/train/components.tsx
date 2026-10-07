import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { Button, CheckButton, LinkButton, Pill, Text } from '@/components/ui';
import { parseNumber } from '@/features/onboarding/validation';
import { EXERCISES, type PrescribedExercise } from '@/features/plan/engine';
import { exerciseName } from '@/features/plan/names';
import { cancelRestEnd, scheduleRestEnd } from '@/features/reminders/notifications';
import { useTheme } from '@/theme/ThemeProvider';

import type { SetLog } from './api';
import type { ExerciseSession } from './progression';

export const REST_SECONDS = 90;

/** "65 kg × 6, 6, 5" or "12, 12, 10" for bodyweight. */
export function summariseSession(session: ExerciseSession, kgUnit: string): string {
  const done = session.sets.filter((s) => s.completed);
  const reps = done.map((s) => s.actualReps ?? '–').join(', ');
  const kg = Math.max(0, ...done.map((s) => s.actualWeightKg ?? 0));
  return kg > 0 ? `${kg} ${kgUnit} × ${reps}` : reps;
}

function NumberCell({
  value,
  onChange,
  onCommit,
  label,
  testID,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  label: string;
  testID?: string;
}) {
  const { colors, radius, typography } = useTheme();
  return (
    <TextInput
      testID={testID}
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      onEndEditing={onCommit}
      keyboardType="decimal-pad"
      selectTextOnFocus
      maxFontSizeMultiplier={1.5}
      style={[
        typography.body,
        {
          minWidth: 64,
          textAlign: 'center',
          color: colors.ink,
          borderWidth: 1.5,
          borderColor: colors.line,
          borderRadius: radius.sm,
          paddingVertical: 6,
          backgroundColor: colors.surface,
        },
      ]}
    />
  );
}

interface ExerciseCardProps {
  plannedKey: string;
  prescription: PrescribedExercise;
  /** Weight to use for sets not logged yet. */
  targetKg: number | null;
  suggestedKg: number | null;
  onAcceptSuggestion: (kg: number) => void;
  lastSession?: ExerciseSession;
  sets: SetLog[];
  swappedFrom: string | null;
  onSaveSet: (set: SetLog) => void;
  onSetCompleted: () => void;
  onToggleSwap: () => void;
}

export function ExerciseCard({
  plannedKey,
  prescription,
  targetKg,
  suggestedKg,
  onAcceptSuggestion,
  lastSession,
  sets,
  swappedFrom,
  onSaveSet,
  onSetCompleted,
  onToggleSwap,
}: ExerciseCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const { exercise } = prescription;
  const lang = i18n.language;
  const kg = t('common.kg');
  const [drafts, setDrafts] = useState<Record<number, { weight?: string; reps?: string }>>({});

  const name = exerciseName(exercise.key, lang);
  const line = exercise.timedSeconds
    ? t('train.prescriptionTimed', { sets: prescription.sets, seconds: exercise.timedSeconds })
    : targetKg == null
      ? t('train.prescriptionBodyweight', { sets: prescription.sets, reps: prescription.reps })
      : t('train.prescription', { sets: prescription.sets, reps: prescription.reps, kg: targetKg });

  const plannedAlt = EXERCISES[plannedKey]?.alternativeKey;

  function valuesFor(n: number) {
    const logged = sets.find((s) => s.set_number === n);
    const draft = drafts[n] ?? {};
    return {
      logged,
      weight: draft.weight ?? String(logged?.actual_weight_kg ?? targetKg ?? ''),
      reps: draft.reps ?? String(logged?.actual_reps ?? prescription.reps ?? ''),
    };
  }

  function save(n: number, completed: boolean) {
    const { weight, reps } = valuesFor(n);
    onSaveSet({
      exercise_key: exercise.key,
      swapped_from_key: swappedFrom,
      set_number: n,
      target_reps: prescription.reps,
      target_weight_kg: targetKg,
      actual_reps: exercise.timedSeconds ? null : parseNumber(reps),
      actual_weight_kg: targetKg == null ? null : parseNumber(weight),
      completed,
    });
  }

  return (
    <View
      testID={`exercise-${exercise.key}`}
      style={{
        paddingVertical: spacing.md,
        gap: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: spacing.sm,
          flexWrap: 'wrap',
        }}>
        <Text variant="label" style={{ fontSize: 17, flexShrink: 1 }}>
          {name}
          {exercise.perHand ? (
            <Text variant="small" color="muted">{`  (${t('train.perHand')})`}</Text>
          ) : null}
        </Text>
        {exercise.smartStation ? (
          <Pill label={t('train.smartStation', { station: exercise.smartStation })} />
        ) : null}
      </View>
      <Text color="muted" style={{ fontSize: 15 }}>
        {line}
      </Text>
      {lastSession ? (
        <Text variant="small" color="muted">
          {t('train.lastTime', { summary: summariseSession(lastSession, kg) })}
        </Text>
      ) : null}
      {suggestedKg != null ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="small" color="ok">
            {t('train.suggestion', { kg: suggestedKg })}
          </Text>
          <Button
            testID={`accept-${exercise.key}`}
            variant="ghost"
            label={t('train.useSuggestion', { kg: suggestedKg })}
            onPress={() => onAcceptSuggestion(suggestedKg)}
          />
        </View>
      ) : null}

      {Array.from({ length: prescription.sets }, (_, i) => i + 1).map((n) => {
        const { logged, weight, reps } = valuesFor(n);
        const done = !!logged?.completed;
        return (
          <View
            key={n}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 }}>
            <Text variant="label" style={{ flex: 1 }}>
              {t('train.set', { n })}
            </Text>
            {targetKg != null ? (
              <>
                <NumberCell
                  testID={`weight-${exercise.key}-${n}`}
                  label={t('train.weightLabel', { n })}
                  value={weight}
                  onChange={(v) => setDrafts((d) => ({ ...d, [n]: { ...d[n], weight: v } }))}
                  onCommit={() => done && save(n, true)}
                />
                <Text variant="small" color="muted">
                  {kg}
                </Text>
              </>
            ) : null}
            {exercise.timedSeconds ? (
              <Text color="muted">{`${exercise.timedSeconds} s`}</Text>
            ) : (
              <>
                <Text color="muted">×</Text>
                <NumberCell
                  testID={`reps-${exercise.key}-${n}`}
                  label={t('train.repsLabel', { n })}
                  value={reps}
                  onChange={(v) => setDrafts((d) => ({ ...d, [n]: { ...d[n], reps: v } }))}
                  onCommit={() => done && save(n, true)}
                />
              </>
            )}
            <CheckButton
              testID={`set-${exercise.key}-${n}`}
              checked={done}
              label={`${name}: ${t('train.markSet', { n })}`}
              onPress={() => {
                save(n, !done);
                if (!done) onSetCompleted();
              }}
            />
          </View>
        );
      })}

      {plannedAlt || swappedFrom ? (
        <LinkButton
          label={
            swappedFrom
              ? t('train.swapBack', { name: exerciseName(swappedFrom, lang) })
              : t('train.swap', { name: exerciseName(plannedAlt!, lang) })
          }
          onPress={onToggleSwap}
        />
      ) : null}
    </View>
  );
}

/** Floating rest countdown (prototype startTimer()). Also buzzes if the app is in the background. */
export function RestTimer({ startedAt, onDone }: { startedAt: number; onDone: () => void }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const [left, setLeft] = useState(REST_SECONDS);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    void scheduleRestEnd(REST_SECONDS, {
      title: t('train.restOverTitle'),
      body: t('train.restOverBody'),
    }).catch(() => {});
    const tick = () => {
      const remaining = REST_SECONDS - Math.floor((Date.now() - startedAt) / 1000);
      if (remaining <= 0) doneRef.current();
      else setLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => {
      clearInterval(id);
      void cancelRestEnd().catch(() => {});
    };
  }, [startedAt, t]);

  const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <View
      accessibilityRole="timer"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        bottom: spacing.lg,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.ink,
        borderRadius: radius.pill,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.lg + 2,
      }}>
      <Text
        testID="rest-timer"
        variant="label"
        style={{ color: colors.bg, writingDirection: 'ltr' }}>
        {t('train.rest', { time })}
      </Text>
      <Pressable accessibilityRole="button" onPress={onDone} hitSlop={8}>
        <Text variant="label" style={{ color: colors.bg, textDecorationLine: 'underline' }}>
          {t('train.skip')}
        </Text>
      </Pressable>
    </View>
  );
}
