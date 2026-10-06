import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  LinkButton,
  Notice,
  Panel,
  Screen,
  StepHeader,
  Text,
  TextField,
} from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/store';
import {
  hasErrors,
  LIMITS,
  validateScan,
  type ScanErrors,
  type ScanField,
} from '@/features/onboarding/validation';
import { useTheme } from '@/theme/ThemeProvider';

const FIELDS: {
  field: ScanField;
  label: 'bodyFat' | 'muscle' | 'bmr';
  keyboard: 'decimal-pad' | 'number-pad';
}[] = [
  { field: 'bodyFatPct', label: 'bodyFat', keyboard: 'decimal-pad' },
  { field: 'skeletalMuscleKg', label: 'muscle', keyboard: 'decimal-pad' },
  { field: 'bmrKcal', label: 'bmr', keyboard: 'number-pad' },
];

export default function ScanStep() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { draft, update } = useOnboarding();
  const [submitted, setSubmitted] = useState(false);
  const errors: ScanErrors = submitted ? validateScan(draft) : {};

  function next() {
    setSubmitted(true);
    if (!hasErrors(validateScan(draft))) router.push('/health');
  }

  return (
    <Screen>
      <StepHeader current={2} total={3} label={t('onboarding.step', { current: 2, total: 3 })} />
      <Text variant="title" accessibilityRole="header">
        {t('onboarding.scan.title')}
      </Text>
      <Text color="muted">{t('onboarding.scan.subtitle')}</Text>
      <Panel style={{ gap: spacing.md }}>
        {FIELDS.map(({ field, label, keyboard }) => (
          <TextField
            key={field}
            testID={`scan-${field}`}
            label={`${t(`onboarding.scan.${label}`)} · ${t('common.optional')}`}
            value={draft[field]}
            onChangeText={(value) => update({ [field]: value })}
            error={errors[field] ? t('onboarding.errors.outOfRange', LIMITS[field]) : undefined}
            keyboardType={keyboard}
          />
        ))}
        <Notice tone="medium">{t('onboarding.scan.noScan')}</Notice>
        <Button testID="scan-next" label={t('onboarding.scan.next')} onPress={next} />
        <LinkButton label={t('common.back')} onPress={() => router.back()} />
      </Panel>
    </Screen>
  );
}
