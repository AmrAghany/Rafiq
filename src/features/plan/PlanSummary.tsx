import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Notice, Panel, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import { SPLITS, weekdayIndex, type DayType, type Plan } from './engine';
import { WeekStrip } from './WeekStrip';

const DAY_TYPES: DayType[] = ['high', 'medium', 'low'];

/** The plan overview shown after onboarding and from the Me tab (prototype building()). */
export function PlanSummary({ plan }: { plan: Plan }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const split = SPLITS[`${plan.trainingDays}`];
  const splitName = i18n.language === 'ar' ? split.nameAr : split.nameEn;
  const { safety } = plan;

  return (
    <View style={{ gap: spacing.md }}>
      <Text color="muted">
        {safety.hideCalories
          ? t('plan.builtFromNoCalories', { bodyFat: plan.bodyFatPct, leanMass: plan.leanMassKg })
          : t('plan.builtFrom', {
              bodyFat: plan.bodyFatPct,
              leanMass: plan.leanMassKg,
              bmr: plan.bmrKcal,
            })}
      </Text>
      {plan.bodyFatAssumed && (
        <Notice tone="medium">{t('plan.bodyFatAssumed', { bodyFat: plan.bodyFatPct })}</Notice>
      )}
      {safety.noDeficit && <Notice>{t('plan.carefulNotice')}</Notice>}
      {safety.doctorNotice && <Notice>{t('plan.doctorNotice')}</Notice>}

      <Panel>
        <Text variant="heading" accessibilityRole="header">
          {t('plan.training')}
        </Text>
        <Text>
          {t('plan.trainingSummary', {
            split: splitName,
            sets: plan.schemes.main.sets,
            reps: plan.schemes.main.reps,
          })}
        </Text>
        <WeekStrip plan={plan} todayIndex={weekdayIndex(new Date())} />
      </Panel>

      <Panel>
        <Text variant="heading" accessibilityRole="header">
          {t('plan.carbCycle')}
        </Text>
        {safety.hideCalories ? (
          <Text testID="balanced-meals">{t('plan.balancedMeals')}</Text>
        ) : (
          <>
            {DAY_TYPES.map((type) => (
              <View
                key={type}
                accessible
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing.sm,
                  paddingVertical: spacing.xs,
                }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    marginTop: 6,
                    backgroundColor: colors[type],
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="label">{t(`dayType.${type}`)}</Text>
                  <Text>
                    {t('plan.dayMacros', {
                      kcal: plan.macros[type].kcal,
                      carbs: plan.macros[type].carbsG,
                    })}
                  </Text>
                </View>
              </View>
            ))}
            <Text variant="small" color="muted">
              {t('plan.proteinNote', { protein: plan.proteinG })}
            </Text>
          </>
        )}
      </Panel>
    </View>
  );
}
