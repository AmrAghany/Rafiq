import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Notice, Screen, Text } from '@/components/ui';
import { PlanSummary } from '@/features/plan/PlanSummary';
import { useActivePlan } from '@/features/profile/api';

export default function PlanScreen() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useActivePlan();

  return (
    <Screen edges={[]}>
      {isPending ? (
        <ActivityIndicator />
      ) : isError ? (
        <>
          <Notice tone="warn">{t('auth.errors.generic')}</Notice>
          <Button label={t('common.retry')} onPress={() => void refetch()} />
        </>
      ) : data ? (
        <PlanSummary plan={data.plan} />
      ) : (
        <Text color="muted">{t('plan.notFound')}</Text>
      )}
    </Screen>
  );
}
