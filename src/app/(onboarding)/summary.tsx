import { Redirect, router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, LinkButton, Notice, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/store';
import {
  hasErrors,
  toPlanInput,
  validateAbout,
  validateScan,
} from '@/features/onboarding/validation';
import { buildPlan } from '@/features/plan/engine';
import { PlanSummary } from '@/features/plan/PlanSummary';
import { useCompleteOnboarding } from '@/features/profile/api';

export default function SummaryStep() {
  const { t } = useTranslation();
  const draft = useOnboarding((s) => s.draft);
  const complete = useCompleteOnboarding();

  const valid =
    !!draft.medicalNoticeAcceptedAt &&
    !hasErrors(validateAbout(draft)) &&
    !hasErrors(validateScan(draft));
  const plan = useMemo(() => (valid ? buildPlan(toPlanInput(draft)) : null), [draft, valid]);

  // The draft lives in memory only; if the app was restarted mid-flow, start again.
  if (!plan) return <Redirect href="/welcome" />;

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {t('plan.readyTitle', { name: draft.name.trim() })}
      </Text>
      <PlanSummary plan={plan} />
      {complete.isError && <Notice tone="warn">{t('onboarding.errors.saveFailed')}</Notice>}
      <Button
        testID="start-my-day"
        label={t('plan.start')}
        loading={complete.isPending}
        onPress={() => complete.mutate(draft)}
      />
      <LinkButton label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
