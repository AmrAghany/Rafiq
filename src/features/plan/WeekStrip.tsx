import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import { WORKOUTS, type Plan } from './engine';

const DAY_COLOR = { high: 'high', medium: 'medium', low: 'low' } as const;

/** Seven-day strip: carb day type and training or rest (prototype weekStrip()). */
export function WeekStrip({ plan, todayIndex }: { plan: Plan; todayIndex?: number }) {
  const { t, i18n } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const hideLetters = plan.safety.hideCalories;

  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      {plan.week.map((day, i) => {
        const dayName = t(`days.short.${i}` as 'days.short.0');
        const workout = day.workoutKey ? WORKOUTS[day.workoutKey] : null;
        const workoutName = workout
          ? i18n.language === 'ar'
            ? workout.nameAr
            : workout.nameEn
          : t('plan.rest');
        const isToday = i === todayIndex;
        return (
          <View
            key={i}
            accessible
            accessibilityLabel={`${dayName}, ${workoutName}${hideLetters ? '' : `, ${t(`dayType.${day.dayType}`)}`}${isToday ? `, ${t('plan.today')}` : ''}`}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              borderWidth: isToday ? 2 : 1.5,
              borderColor: isToday ? colors.ink : colors.line,
              backgroundColor: colors.surface,
            }}>
            <Text variant="small" maxFontSizeMultiplier={1.3}>
              {dayName}
            </Text>
            <Text
              variant="heading"
              maxFontSizeMultiplier={1.3}
              style={{ color: colors[DAY_COLOR[day.dayType]] }}>
              {hideLetters ? '•' : t(`dayType.letter.${day.dayType}`)}
            </Text>
            <Text
              variant="small"
              color="muted"
              style={{ fontSize: 11 }}
              maxFontSizeMultiplier={1.3}>
              {day.workoutKey ? t('plan.train') : t('plan.rest')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
