import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import {
  Button,
  LinkButton,
  Notice,
  Panel,
  ProgressBar,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import { useMealActions, useMealLogs, type MealLog } from '@/features/food/api';
import { MealEstimate, type Estimate } from '@/features/food/MealEstimate';
import { mealsForDay, progress, sumMeals } from '@/features/food/meals';
import { parseNumber } from '@/features/onboarding/validation';
import { localName } from '@/features/plan/names';
import { WeekStrip } from '@/features/plan/WeekStrip';
import { LockedCard } from '@/features/membership/LockedCard';
import { useEntitlements } from '@/features/membership/useTier';
import { useToday } from '@/features/today/api';
import { useTheme } from '@/theme/ThemeProvider';

type Field = 'kcal' | 'protein' | 'carbs' | 'fat';
const EMPTY_FORM = { name: '', kcal: '', protein: '', carbs: '', fat: '' };

/** Blank is fine (unknown); anything typed must be a number. */
const optionalNumber = (raw: string): number | null | 'invalid' =>
  raw.trim() === '' ? null : (parseNumber(raw) ?? 'invalid');

export default function FoodScreen() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const { dateKey, todayIndex, plan, ramadan } = useToday();
  const meals = useMealLogs(dateKey);
  const { add, remove } = useMealActions(dateKey);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<'name' | Field, string>>>({});
  // Set when the form was pre-filled by an AI estimate, so the log records where it came from.
  const [origin, setOrigin] = useState<{
    source: 'text' | 'photo';
    photoPath: string | null;
    estimate: Estimate;
  } | null>(null);
  const { can } = useEntitlements();

  if (plan.isPending || meals.isPending) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }
  const p = plan.data?.plan;
  if (!p || meals.isError) {
    return (
      <Screen>
        <Notice tone="warn">{t('auth.errors.generic')}</Notice>
        <Button
          label={t('common.retry')}
          onPress={() => {
            void plan.refetch();
            void meals.refetch();
          }}
        />
      </Screen>
    );
  }

  const careful = p.safety.hideCalories;
  // Carb cycling and meal plans are Pro. Members whose plan is "balanced meals, no numbers"
  // keep the simple version for free (as in the prototype).
  if (!can('meal_plans') && !careful) {
    return (
      <Screen>
        <Text variant="title" accessibilityRole="header">
          {t('tabs.food')}
        </Text>
        <LockedCard title={t('food.lockedTitle')} body={t('food.lockedBody')} />
      </Screen>
    );
  }
  const dayType = p.week[todayIndex].dayType;
  const target = p.macros[dayType];
  const logged = meals.data ?? [];
  const eaten = sumMeals(logged);
  const planned = mealsForDay(p, dayType, ramadan);

  function submit() {
    const found: typeof errors = {};
    if (!form.name.trim()) found.name = t('food.nameRequired');
    const values = {} as Record<Field, number | null>;
    for (const f of ['kcal', 'protein', 'carbs', 'fat'] as const) {
      const v = careful ? null : optionalNumber(form[f]);
      if (v === 'invalid') found[f] = t('food.numberInvalid');
      else values[f] = v;
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    add.mutate({
      name: form.name.trim(),
      kcal: values.kcal == null ? null : Math.round(values.kcal),
      protein_g: values.protein,
      carbs_g: values.carbs,
      fat_g: values.fat,
      source: origin?.source ?? 'manual',
      template_key: null,
      photo_path: origin?.photoPath ?? null,
      ai_estimate: origin?.estimate ?? null,
    });
    setForm(EMPTY_FORM);
    setOrigin(null);
  }

  const bars = [
    { label: t('food.protein'), eaten: eaten.proteinG, target: target.proteinG, color: 'warn' },
    { label: t('food.carbs'), eaten: eaten.carbsG, target: target.carbsG, color: dayType },
    { label: t('food.fat'), eaten: eaten.fatG, target: target.fatG, color: 'muted' },
  ] as const;

  return (
    <Screen>
      <Text variant="small" color="muted">
        {t('train.today')}
      </Text>
      <Text variant="title" accessibilityRole="header">
        {careful ? t('today.balancedDay') : t(`dayType.${dayType}`)}
      </Text>
      <WeekStrip plan={p} todayIndex={todayIndex} />

      {careful ? (
        <Notice>{t('food.carefulNotice')}</Notice>
      ) : (
        <Panel>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="heading" accessibilityRole="header">
              {t('food.eatenToday')}
            </Text>
            <Text testID="kcal-progress" variant="label">
              {t('food.kcalProgress', { eaten: eaten.kcal, target: target.kcal })}
            </Text>
          </View>
          {bars.map((b) => (
            <View key={b.label} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small">{b.label}</Text>
                <Text variant="small">
                  {t('food.gramsProgress', { eaten: b.eaten, target: b.target })}
                </Text>
              </View>
              <ProgressBar value={progress(b.eaten, b.target)} color={b.color} label={b.label} />
            </View>
          ))}
          <Text variant="small" color="muted">
            {t(`food.dayNote.${dayType}`)}
          </Text>
        </Panel>
      )}

      <Panel style={{ gap: spacing.md }}>
        <Text variant="heading" accessibilityRole="header">
          {t('food.logTitle')}
        </Text>
        {can('meal_ai') ? (
          <MealEstimate
            onEstimate={(estimate, o) => {
              const n = (v: number | null) => (v == null ? '' : String(v));
              setForm({
                name: estimate.name,
                kcal: n(estimate.kcal),
                protein: n(estimate.protein_g),
                carbs: n(estimate.carbs_g),
                fat: n(estimate.fat_g),
              });
              setErrors({});
              setOrigin({ ...o, estimate });
            }}
          />
        ) : null}
        <TextField
          testID="meal-name"
          label={t('food.mealName')}
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          error={errors.name}
        />
        {careful ? null : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {(
              [
                ['kcal', 'food.kcal'],
                ['protein', 'food.proteinG'],
                ['carbs', 'food.carbsG'],
                ['fat', 'food.fatG'],
              ] as const
            ).map(([f, label]) => (
              <View key={f} style={{ flexBasis: '47%', flexGrow: 1 }}>
                <TextField
                  testID={`meal-${f}`}
                  label={t(label)}
                  value={form[f]}
                  onChangeText={(v) => setForm((x) => ({ ...x, [f]: v }))}
                  error={errors[f]}
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </View>
        )}
        <Button testID="meal-add" label={t('food.add')} onPress={submit} />
        {can('meal_ai') ? null : (
          <Text variant="small" color="muted">
            {t('food.aiLocked')}
          </Text>
        )}
        {logged.map((m) => (
          <LoggedMealRow
            key={m.id}
            meal={m}
            careful={careful}
            onRemove={() => !m.id.startsWith('pending-') && remove.mutate(m.id)}
          />
        ))}
      </Panel>

      <Panel>
        <Text variant="heading" accessibilityRole="header">
          {t('food.mealPlan')}
        </Text>
        {planned.map(({ template, slot, macros }) => {
          const already = logged.some((m) => m.template_key === template.key);
          const name = localName(template, i18n.language);
          return (
            <View key={template.key} style={{ paddingVertical: spacing.sm, gap: 2 }}>
              <Text variant="label">{t(`food.slots.${slot}`)}</Text>
              <Text>{name}</Text>
              {careful ? null : (
                <Text variant="small" color="muted">
                  {t('food.mealAbout', {
                    kcal: macros.kcal,
                    protein: macros.proteinG,
                    carbs: macros.carbsG,
                  })}
                </Text>
              )}
              <LinkButton
                label={already ? t('food.loggedThis') : t('food.logThis')}
                accessibilityLabel={`${name}: ${already ? t('food.loggedThis') : t('food.logThis')}`}
                onPress={() =>
                  !already &&
                  add.mutate({
                    name,
                    kcal: careful ? null : macros.kcal,
                    protein_g: careful ? null : macros.proteinG,
                    carbs_g: careful ? null : macros.carbsG,
                    fat_g: careful ? null : macros.fatG,
                    source: 'plan',
                    template_key: template.key,
                  })
                }
              />
            </View>
          );
        })}
      </Panel>
    </Screen>
  );
}

function LoggedMealRow({
  meal,
  careful,
  onRemove,
}: {
  meal: MealLog;
  careful: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const n = (v: number | null) => v ?? '–';
  return (
    <View
      testID="logged-meal"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingTop: spacing.sm,
      }}>
      <View style={{ flex: 1 }}>
        <Text variant="label">{meal.name}</Text>
        {careful ? null : (
          <Text variant="small" color="muted">
            {t('food.loggedMacros', {
              kcal: n(meal.kcal),
              protein: n(meal.protein_g),
              carbs: n(meal.carbs_g),
              fat: n(meal.fat_g),
            })}
          </Text>
        )}
      </View>
      <LinkButton
        label={t('common.remove')}
        accessibilityLabel={`${t('common.remove')}: ${meal.name}`}
        onPress={onRemove}
      />
    </View>
  );
}
