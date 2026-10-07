import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, LinkButton, Notice, Panel, Text, TextField } from '@/components/ui';
import { LockedCard } from '@/features/membership/LockedCard';
import { useEntitlements } from '@/features/membership/useTier';
import { useTodayKey } from '@/features/today/api';
import { isolate } from '@/i18n/bidi';
import { useTheme } from '@/theme/ThemeProvider';

import { monthName, monthOf, useMyReviews, useRequestReview, type RequestError } from './api';

const NOTE_MAX = 1000;

/** Me tab: this month's coach review (Elite), and earlier ones. */
export function CoachReviewPanel() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const { can, isLoading } = useEntitlements();
  const elite = can('coach_review');
  const reviews = useMyReviews({ enabled: elite });
  const request = useRequestReview();
  const today = useTodayKey();
  const [note, setNote] = useState('');

  if (isLoading) return null;
  if (!elite) {
    return (
      <LockedCard
        title={t('review.lockedTitle')}
        body={t('review.lockedBody')}
        cta={t('review.lockedCta')}
      />
    );
  }

  const all = reviews.data ?? [];
  const current = all.find((r) => r.period === monthOf(today));
  const earlier = all.filter((r) => r !== current && r.status === 'delivered');
  const month = monthName(monthOf(today), i18n.language);
  const errorCode = request.error?.message as RequestError | undefined;

  return (
    <Panel style={{ gap: spacing.md }}>
      <Text variant="heading" accessibilityRole="header">
        {t('review.title')}
      </Text>

      {!current ? (
        <>
          <Text>{t('review.intro', { month })}</Text>
          <TextField
            testID="review-note"
            label={`${t('review.noteLabel')} · ${t('common.optional')}`}
            placeholder={t('review.notePlaceholder')}
            value={note}
            onChangeText={setNote}
            maxLength={NOTE_MAX}
            multiline
          />
          <Text variant="small" color="muted">
            {t('review.consent')}
          </Text>
          {errorCode ? <Notice tone="warn">{t(`review.errors.${errorCode}`)}</Notice> : null}
          <Button
            testID="request-review"
            label={t('review.request')}
            loading={request.isPending}
            onPress={() => request.mutate(note, { onSuccess: () => setNote('') })}
          />
        </>
      ) : current.status === 'requested' ? (
        <Text testID="review-status">{t('review.requested', { month })}</Text>
      ) : current.status === 'in_review' ? (
        <Text testID="review-status">
          {t('review.inReview', { coach: isolate(current.coach_name ?? ''), month })}
        </Text>
      ) : (
        <>
          <Text testID="review-status">
            {t('review.ready', { coach: isolate(current.coach_name ?? ''), month })}
          </Text>
          <Button
            testID="open-review"
            label={t('review.read')}
            onPress={() => router.push({ pathname: '/review/[id]', params: { id: current.id } })}
          />
        </>
      )}

      {earlier.map((r) => (
        <LinkButton
          key={r.id}
          label={t('review.earlier', { month: monthName(r.period, i18n.language) })}
          onPress={() => router.push({ pathname: '/review/[id]', params: { id: r.id } })}
        />
      ))}
    </Panel>
  );
}
