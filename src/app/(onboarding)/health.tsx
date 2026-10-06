import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Checkbox, LinkButton, Panel, Screen, StepHeader, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/store';
import type { HealthFlag } from '@/features/plan/engine';

const FLAGS: HealthFlag[] = ['injury', 'heart', 'diabetes', 'pregnancy', 'eating_disorder'];

export default function HealthStep() {
  const { t } = useTranslation();
  const { draft, update } = useOnboarding();

  const toggle = (flag: HealthFlag, on: boolean) =>
    update({
      healthFlags: on ? [...draft.healthFlags, flag] : draft.healthFlags.filter((f) => f !== flag),
    });

  return (
    <Screen>
      <StepHeader current={3} total={3} label={t('onboarding.step', { current: 3, total: 3 })} />
      <Text variant="title" accessibilityRole="header">
        {t('onboarding.health.title')}
      </Text>
      <Text color="muted">{t('onboarding.health.subtitle')}</Text>
      <Panel>
        {FLAGS.map((flag) => (
          <Checkbox
            key={flag}
            label={t(`onboarding.health.${flag}`)}
            checked={draft.healthFlags.includes(flag)}
            onChange={(on) => toggle(flag, on)}
          />
        ))}
        <Button
          testID="health-next"
          label={t('onboarding.health.next')}
          onPress={() => router.push('/summary')}
        />
        <LinkButton label={t('common.back')} onPress={() => router.back()} />
      </Panel>
    </Screen>
  );
}
