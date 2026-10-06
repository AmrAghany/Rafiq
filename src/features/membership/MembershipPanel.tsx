import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { Button, LinkButton, Panel, Text } from '@/components/ui';

import { manageSubscriptions, purchasesAvailable } from './purchases';
import { useEntitlements } from './useTier';

/** Me tab: current plan, renewal or trial end, and ways to change it. */
export function MembershipPanel() {
  const { t, i18n } = useTranslation();
  const { tier, subscription } = useEntitlements();
  const date = subscription?.current_period_ends_at
    ? new Date(subscription.current_period_ends_at).toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const status = !subscription
    ? null
    : subscription.status === 'billing_issue'
      ? t('membership.billingIssue')
      : subscription.is_trial && date
        ? t('membership.trialEnds', { date })
        : subscription.will_renew && date
          ? t('membership.renews', { date })
          : date
            ? t('membership.ends', { date })
            : null;

  function manage() {
    if (subscription?.management_url) void Linking.openURL(subscription.management_url);
    else if (purchasesAvailable()) void manageSubscriptions();
  }

  return (
    <Panel>
      <Text variant="heading" accessibilityRole="header">
        {t('membership.title')}
      </Text>
      <Text testID="membership-plan" variant="label">
        {t('membership.yourPlan', { plan: t(`membership.tiers.${tier}`) })}
      </Text>
      {status ? (
        <Text color={subscription?.status === 'billing_issue' ? 'warn' : 'muted'}>{status}</Text>
      ) : null}
      {tier === 'free' ? (
        <Button
          testID="see-plans"
          label={t('paywall.cta')}
          onPress={() => router.push('/paywall')}
        />
      ) : (
        <>
          <Button
            variant="ghost"
            label={t('membership.change')}
            onPress={() => router.push('/paywall')}
          />
          <LinkButton label={t('membership.manage')} onPress={manage} />
        </>
      )}
    </Panel>
  );
}
