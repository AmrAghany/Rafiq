import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Button,
  CheckButton,
  LinkButton,
  Notice,
  Panel,
  Pill,
  ProgressBar,
  Segmented,
  Stat,
  Text,
} from '@/components/ui';
import {
  isLightDay,
  readinessScore,
  type Checkin,
  type CheckinAnswer,
  type Plan,
} from '@/features/plan/engine';
import { workoutName } from '@/features/plan/names';
import { requestPermission } from '@/features/reminders/notifications';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

import type { DailyLog } from './api';
import { waterGoal, type TimelineItem } from './timeline';
import { timelineText } from './timelineText';

export function DayCard({ plan, dayIndex }: { plan: Plan; dayIndex: number }) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const day = plan.week[dayIndex];
  const macros = plan.macros[day.dayType];
  return (
    <Panel>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: spacing.sm,
          flexWrap: 'wrap',
        }}>
        <Pill
          dot={day.dayType}
          label={plan.safety.hideCalories ? t('today.balancedDay') : t(`dayType.${day.dayType}`)}
        />
        <Text variant="label">
          {day.workoutKey ? workoutName(day.workoutKey, i18n.language) : t('today.restDay')}
        </Text>
      </View>
      {plan.safety.hideCalories ? null : (
        <View style={{ flexDirection: 'row', marginTop: spacing.sm, gap: spacing.lg }}>
          <Stat value={macros.kcal} label={t('today.kcal')} />
          <Stat value={`${macros.proteinG} ${t('common.g')}`} label={t('today.protein')} />
          <Stat value={`${macros.carbsG} ${t('common.g')}`} label={t('today.carbs')} />
        </View>
      )}
    </Panel>
  );
}

type Answers = Partial<Checkin>;

export function CheckinCard({
  log,
  onSave,
}: {
  log: DailyLog;
  onSave: (checkin: (Checkin & { score: number }) | null) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [answers, setAnswers] = useState<Answers>({});

  if (log.checkin) {
    const score = log.checkin.score;
    const color = score >= 80 ? colors.ok : score >= 60 ? colors.medium : colors.high;
    return (
      <Panel>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading" accessibilityRole="header">
            {t('checkin.readiness')}
          </Text>
          <Text testID="readiness-score" variant="title" style={{ color }}>
            {score}
          </Text>
        </View>
        <Text>
          {isLightDay(score)
            ? t('checkin.light')
            : score >= 85
              ? t('checkin.fresh')
              : t('checkin.normal')}
        </Text>
        <LinkButton label={t('checkin.redo')} onPress={() => onSave(null)} />
      </Panel>
    );
  }

  const question = (field: keyof Checkin, label: 'sleep' | 'energy' | 'soreness') => (
    <Segmented<`${CheckinAnswer}`>
      label={t(`checkin.${label}`)}
      value={answers[field] ? (`${answers[field]}` as const) : null}
      onChange={(v) => setAnswers((a) => ({ ...a, [field]: Number(v) as CheckinAnswer }))}
      options={(['1', '2', '3'] as const).map((v) => ({
        value: v,
        label: t(`checkin.${label}${v}` as 'checkin.sleep1'),
      }))}
    />
  );

  const complete = answers.sleep && answers.energy && answers.soreness;
  return (
    <Panel style={{ gap: spacing.md }}>
      <Text variant="heading" accessibilityRole="header">
        {t('checkin.title')}
      </Text>
      {question('sleep', 'sleep')}
      {question('energy', 'energy')}
      {question('soreness', 'soreness')}
      <Button
        testID="checkin-submit"
        label={t('checkin.submit')}
        disabled={!complete}
        onPress={() => {
          const c = answers as Checkin;
          onSave({ ...c, score: readinessScore(c) });
          setAnswers({});
        }}
      />
    </Panel>
  );
}

export function WaterCard({
  glasses,
  ramadan,
  onChange,
}: {
  glasses: number;
  ramadan: boolean;
  onChange: (glasses: number) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const goal = waterGoal(ramadan);
  return (
    <Panel>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="heading" accessibilityRole="header">
          {t('water.title')}
        </Text>
        <Text testID="water-count" variant="label">
          {t('water.count', { count: glasses, goal })}
        </Text>
      </View>
      <ProgressBar value={glasses / goal} color="medium" height={12} label={t('water.title')} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            variant="ghost"
            label="−1"
            accessibilityLabel={t('water.remove')}
            disabled={glasses === 0}
            onPress={() => onChange(Math.max(0, glasses - 1))}
          />
        </View>
        <View style={{ flex: 2 }}>
          <Button testID="water-add" label={t('water.add')} onPress={() => onChange(glasses + 1)} />
        </View>
      </View>
    </Panel>
  );
}

export function RemindersCard() {
  const { t } = useTranslation();
  const setEnabled = useSettings((s) => s.setRemindersEnabled);
  const [denied, setDenied] = useState(false);
  return (
    <Panel>
      <Text variant="heading" accessibilityRole="header">
        {t('reminders.title')}
      </Text>
      <Text>{t('reminders.body')}</Text>
      {denied ? <Notice tone="warn">{t('reminders.denied')}</Notice> : null}
      <Button
        testID="enable-reminders"
        label={t('reminders.enable')}
        onPress={async () => {
          const granted = await requestPermission();
          setDenied(!granted);
          if (granted) setEnabled(true);
        }}
      />
    </Panel>
  );
}

export function Timeline({
  items,
  currentIndex,
  done,
  interactive,
  onToggle,
}: {
  items: TimelineItem[];
  currentIndex: number;
  done: readonly string[];
  interactive: boolean;
  onToggle: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View>
      {items.map((item, i) => {
        const { title, body } = timelineText(item, t, i18n.language);
        const isDone = interactive && done.includes(item.id);
        const isNow = interactive && i === currentIndex;
        return (
          <View
            key={item.id}
            testID={`timeline-${item.id}`}
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              paddingVertical: spacing.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.line,
              alignItems: 'flex-start',
            }}>
            <Text
              variant="label"
              color={isNow ? 'accent' : 'muted'}
              maxFontSizeMultiplier={1.5}
              style={{ minWidth: 52, fontSize: 17, writingDirection: 'ltr' }}>
              {item.time}
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                variant="label"
                color={isDone ? 'muted' : 'ink'}
                style={isDone ? { textDecorationLine: 'line-through' } : undefined}>
                {title}
                {isNow ? (
                  <Text variant="small" color="accent">{`  ${t('timeline.now')}`}</Text>
                ) : null}
              </Text>
              <Text variant="small" color="muted" style={{ fontSize: 14 }}>
                {body}
              </Text>
              {item.kind === 'train' ? (
                <LinkButton
                  label={t('timeline.openWorkout')}
                  onPress={() => router.navigate('/train')}
                />
              ) : item.kind === 'meal' ? (
                <LinkButton
                  label={t('timeline.seeMeal')}
                  onPress={() => router.navigate('/food')}
                />
              ) : null}
            </View>
            {interactive ? (
              <CheckButton
                testID={`done-${item.id}`}
                checked={isDone}
                label={t('timeline.markDone', { item: title })}
                onPress={() => onToggle(item.id)}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
