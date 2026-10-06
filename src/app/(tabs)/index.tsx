import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, LinkButton, Notice, Panel, Pill, Screen, Text } from '@/components/ui';
import { WeekStrip } from '@/features/plan/WeekStrip';
import { useProfile } from '@/features/profile/api';
import { useToday, useUpdateDailyLog } from '@/features/today/api';
import {
  CheckinCard,
  DayCard,
  RemindersCard,
  Timeline,
  WaterCard,
} from '@/features/today/components';
import { buildTimeline, currentItemIndex, greetingFor } from '@/features/today/timeline';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

/** Re-render every minute so "now" moves along the timeline. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const now = useNow();
  const { data: profile } = useProfile();
  const { dateKey, todayIndex, plan, schedule, ramadan, log } = useToday();
  const updateLog = useUpdateDailyLog(dateKey);
  const remindersEnabled = useSettings((s) => s.remindersEnabled);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  if (plan.isPending || log.isPending) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (plan.isError || log.isError || !plan.data) {
    return (
      <Screen>
        <Notice tone="warn">{t('auth.errors.generic')}</Notice>
        <Button
          label={t('common.retry')}
          onPress={() => {
            void plan.refetch();
            void log.refetch();
          }}
        />
      </Screen>
    );
  }

  const p = plan.data.plan;
  const dayIndex = viewIndex ?? todayIndex;
  const isToday = dayIndex === todayIndex;
  const daily = log.data!;
  const items = buildTimeline(p, dayIndex, schedule, ramadan);
  const current = currentItemIndex(items, now, schedule.wakeTime);
  const name = profile?.display_name?.split(' ')[0] ?? '';

  const toggleDone = (id: string) => {
    const done = daily.completed_items.includes(id)
      ? daily.completed_items.filter((x) => x !== id)
      : [...daily.completed_items, id];
    updateLog.mutate({ completed_items: done });
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="small" color="muted">
          {isToday
            ? now.toLocaleDateString(i18n.language, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
            : t('today.preview', { day: t(`days.short.${dayIndex}` as 'days.short.0') })}
        </Text>
        <Text variant="title" accessibilityRole="header">
          {t(`today.greeting.${greetingFor(now)}`, { name })}
        </Text>
        {ramadan ? <Pill label={t('today.ramadanMode')} /> : null}
      </View>

      <WeekStrip
        plan={p}
        todayIndex={todayIndex}
        selectedIndex={dayIndex}
        onSelect={(i) => setViewIndex(i === todayIndex ? null : i)}
      />
      {!isToday ? (
        <LinkButton label={t('today.backToToday')} onPress={() => setViewIndex(null)} />
      ) : null}

      <DayCard plan={p} dayIndex={dayIndex} />

      {isToday ? (
        <>
          <CheckinCard
            log={daily}
            onSave={(checkin) => {
              const done = daily.completed_items.filter((x) => x !== 'checkin');
              updateLog.mutate({
                checkin,
                readiness_score: checkin?.score ?? null,
                completed_items: checkin ? [...done, 'checkin'] : done,
              });
            }}
          />
          <WaterCard
            glasses={daily.water_glasses}
            ramadan={ramadan}
            onChange={(water_glasses) => updateLog.mutate({ water_glasses })}
          />
          {remindersEnabled ? null : <RemindersCard />}
        </>
      ) : null}

      <Panel>
        <Text variant="heading" accessibilityRole="header">
          {isToday ? t('today.yourDay') : t('today.thatDay')}
        </Text>
        <Timeline
          items={items}
          currentIndex={current}
          done={daily.completed_items}
          interactive={isToday}
          onToggle={toggleDone}
        />
      </Panel>
    </Screen>
  );
}
