import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Notice, Panel, Screen, Text } from '@/components/ui';
import { textDirection } from '@/features/ai/sse';
import { monthName, useMarkReviewRead, useMyReviews } from '@/features/coachReview/api';
import { isolate } from '@/i18n/bidi';

const SECTIONS = ['summary', 'training', 'nutrition', 'focus'] as const;

/** A delivered monthly review from the member's coach. */
export default function ReviewScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isPending } = useMyReviews();
  const { mutate: markRead } = useMarkReviewRead();
  const review = data?.find((r) => r.id === id);
  const unread = review?.status === 'delivered' && !review.read_at;

  // Opening an unread review marks it read.
  useEffect(() => {
    if (unread && id) markRead(id);
  }, [unread, id, markRead]);

  if (isPending) {
    return (
      <Screen edges={[]}>
        <ActivityIndicator />
      </Screen>
    );
  }
  if (!review || review.status !== 'delivered') {
    return (
      <Screen edges={[]}>
        <Notice tone="medium">{t('review.notReady')}</Notice>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="title" accessibilityRole="header">
        {monthName(review.period, i18n.language)}
      </Text>
      <Text color="muted">{t('review.byCoach', { coach: isolate(review.coach_name ?? '') })}</Text>
      {SECTIONS.map((key) => {
        const body = review[key];
        if (!body) return null;
        const dir = textDirection(body);
        return (
          <Panel key={key}>
            <Text variant="heading" accessibilityRole="header">
              {t(`review.sections.${key}`)}
            </Text>
            <Text
              selectable
              testID={`review-${key}`}
              style={{ writingDirection: dir, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              {body}
            </Text>
          </Panel>
        );
      })}
      <Text variant="small" color="muted" style={{ textAlign: 'center' }}>
        {t('app.notMedicalAdvice')}
      </Text>
    </Screen>
  );
}
