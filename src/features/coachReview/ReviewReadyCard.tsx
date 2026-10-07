import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Panel, Text } from '@/components/ui';
import { useEntitlements } from '@/features/membership/useTier';
import { isolate } from '@/i18n/bidi';

import { unreadReview, useMyReviews } from './api';

/** Today tab: a nudge when a coach review is waiting to be read. */
export function ReviewReadyCard() {
  const { t } = useTranslation();
  const { can } = useEntitlements();
  const elite = can('coach_review');
  const { data } = useMyReviews({ enabled: elite });
  const review = elite ? unreadReview(data) : null;
  if (!review) return null;
  return (
    <Panel>
      <Text variant="heading" accessibilityRole="header">
        {t('review.readyTitle')}
      </Text>
      <Text>{t('review.readyBody', { coach: isolate(review.coach_name ?? '') })}</Text>
      <Button
        testID="read-review-today"
        label={t('review.read')}
        onPress={() => router.push({ pathname: '/review/[id]', params: { id: review.id } })}
      />
    </Panel>
  );
}
