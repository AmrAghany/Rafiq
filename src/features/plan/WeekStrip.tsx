import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import type { Plan } from './engine';
import { workoutName } from './names';

/** Seven-day strip: carb day type and training or rest (prototype weekStrip()). */
export function WeekStrip({
  plan,
  todayIndex,
  selectedIndex,
  onSelect,
}: {
  plan: Plan;
  todayIndex?: number;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const hideLetters = plan.safety.hideCalories;

  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
      {plan.week.map((day, i) => {
        const dayName = t(`days.short.${i}` as 'days.short.0');
        const name = day.workoutKey ? workoutName(day.workoutKey, i18n.language) : t('plan.rest');
        const isToday = i === todayIndex;
        const selected = i === (selectedIndex ?? todayIndex);
        const label = [
          dayName,
          name,
          hideLetters ? null : t(`dayType.${day.dayType}`),
          isToday ? t('plan.today') : null,
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <Pressable
            key={i}
            disabled={!onSelect}
            onPress={() => onSelect?.(i)}
            accessible
            accessibilityRole={onSelect ? 'button' : undefined}
            accessibilityState={onSelect ? { selected } : undefined}
            accessibilityLabel={label}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              borderWidth: selected ? 2 : 1.5,
              borderColor: selected ? colors.ink : colors.line,
              backgroundColor: colors.surface,
            }}>
            <Text variant="small" maxFontSizeMultiplier={1.3}>
              {dayName}
            </Text>
            <Text
              variant="heading"
              maxFontSizeMultiplier={1.3}
              style={{ color: colors[day.dayType] }}>
              {hideLetters ? '•' : t(`dayType.letter.${day.dayType}`)}
            </Text>
            <Text
              variant="small"
              color="muted"
              style={{ fontSize: 11 }}
              maxFontSizeMultiplier={1.3}>
              {day.workoutKey ? t('plan.train') : t('plan.rest')}
            </Text>
            {isToday ? (
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  marginTop: 2,
                  backgroundColor: colors.accent,
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
