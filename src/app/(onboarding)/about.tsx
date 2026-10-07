import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Button,
  LinkButton,
  Panel,
  Screen,
  Segmented,
  StepHeader,
  Text,
  TextField,
} from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/store';
import {
  hasErrors,
  LIMITS,
  validateAbout,
  type AboutErrors,
} from '@/features/onboarding/validation';
import type { Experience, Goal, Sex, TrainingDays } from '@/features/plan/engine';
import { useTheme } from '@/theme/ThemeProvider';

export default function AboutStep() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { draft, update } = useOnboarding();
  // Errors appear after the first Next press, then update live as the member fixes them.
  const [submitted, setSubmitted] = useState(false);
  const errors: AboutErrors = submitted ? validateAbout(draft) : {};

  const err = (key: keyof AboutErrors) => {
    const code = errors[key];
    if (!code) return undefined;
    const limits =
      code === 'heightInvalid'
        ? LIMITS.heightCm
        : code === 'weightInvalid'
          ? LIMITS.weightKg
          : undefined;
    return t(`onboarding.errors.${code}`, limits ?? {});
  };

  function next() {
    setSubmitted(true);
    if (!hasErrors(validateAbout(draft))) router.push('/scan');
  }

  return (
    <Screen>
      <StepHeader current={1} total={3} label={t('onboarding.step', { current: 1, total: 3 })} />
      <Text variant="title" accessibilityRole="header">
        {t('onboarding.about.title')}
      </Text>
      <Text color="muted">{t('onboarding.about.subtitle')}</Text>
      <Panel style={{ gap: spacing.md }}>
        <TextField
          testID="name-input"
          label={t('onboarding.about.name')}
          value={draft.name}
          onChangeText={(name) => update({ name })}
          error={err('name')}
          autoComplete="given-name"
          textContentType="givenName"
        />
        <Segmented<Sex>
          label={t('onboarding.about.sex')}
          value={draft.sex}
          onChange={(sex) => update({ sex })}
          error={err('sex')}
          options={[
            { value: 'male', label: t('onboarding.about.male') },
            { value: 'female', label: t('onboarding.about.female') },
          ]}
        />
        <View style={{ gap: spacing.xs }}>
          <Text variant="label">{t('onboarding.about.birthDate')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                testID="birth-day"
                label={t('onboarding.about.day')}
                value={draft.birthDay}
                onChangeText={(birthDay) => update({ birthDay })}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                testID="birth-month"
                label={t('onboarding.about.month')}
                value={draft.birthMonth}
                onChangeText={(birthMonth) => update({ birthMonth })}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View style={{ flex: 1.4 }}>
              <TextField
                testID="birth-year"
                label={t('onboarding.about.year')}
                value={draft.birthYear}
                onChangeText={(birthYear) => update({ birthYear })}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>
          {err('birthDate') ? (
            <Text
              testID="birth-error"
              variant="small"
              color="warn"
              accessibilityLiveRegion="polite">
              {err('birthDate')}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField
              testID="height-input"
              label={t('onboarding.about.height')}
              value={draft.heightCm}
              onChangeText={(heightCm) => update({ heightCm })}
              error={err('height')}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              testID="weight-input"
              label={t('onboarding.about.weight')}
              value={draft.weightKg}
              onChangeText={(weightKg) => update({ weightKg })}
              error={err('weight')}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Segmented<Goal>
          label={t('onboarding.about.goal')}
          value={draft.goal}
          onChange={(goal) => update({ goal })}
          error={err('goal')}
          options={[
            { value: 'lose', label: t('onboarding.about.goalLose') },
            { value: 'build', label: t('onboarding.about.goalBuild') },
            { value: 'recomp', label: t('onboarding.about.goalRecomp') },
          ]}
        />
        <Segmented<`${TrainingDays}`>
          label={t('onboarding.about.days')}
          value={draft.trainingDays ? (`${draft.trainingDays}` as const) : null}
          onChange={(d) => update({ trainingDays: Number(d) as TrainingDays })}
          error={err('days')}
          options={(['3', '4', '5'] as const).map((d) => ({
            value: d,
            label: t('onboarding.about.daysOption', { count: Number(d) }),
          }))}
        />
        <Segmented<Experience>
          label={t('onboarding.about.experience')}
          value={draft.experience}
          onChange={(experience) => update({ experience })}
          error={err('experience')}
          options={[
            { value: 'beginner', label: t('onboarding.about.beginner') },
            { value: 'intermediate', label: t('onboarding.about.intermediate') },
            { value: 'advanced', label: t('onboarding.about.advanced') },
          ]}
        />
        <Button testID="about-next" label={t('onboarding.about.next')} onPress={next} />
        <LinkButton label={t('common.back')} onPress={() => router.back()} />
      </Panel>
    </Screen>
  );
}
