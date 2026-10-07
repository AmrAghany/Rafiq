import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Platform, Pressable, View } from 'react-native';

import { Button, LinkButton, Notice, Screen, Text } from '@/components/ui';
import type { PaidTier } from '@/features/membership/plans';
import { trialDays } from '@/features/membership/plans';
import {
  buy,
  loadPlans,
  PurchaseError,
  purchasesAvailable,
  restore,
} from '@/features/membership/purchases';
import { useEntitlements } from '@/features/membership/useTier';
import { env } from '@/lib/env';
import { useTheme } from '@/theme/ThemeProvider';

type Message = { tone: 'warn' | 'ok' | 'medium'; text: string };

export default function PaywallScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { tier, refresh } = useEntitlements();
  const available = purchasesAvailable();
  const plans = useQuery({
    queryKey: ['offerings'],
    queryFn: loadPlans,
    enabled: available,
    staleTime: 300_000,
  });
  const [selected, setSelected] = useState<PaidTier>('pro');
  const [busy, setBusy] = useState<null | 'buy' | 'restore'>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const chosen = plans.data?.find((p) => p.tier === selected) ?? plans.data?.[0];
  const chosenTrial = chosen ? trialDays(chosen.pkg.product) : null;

  const failure = (e: unknown): Message => ({
    tone: 'warn',
    text: e instanceof PurchaseError ? t(`paywall.errors.${e.code}`) : t('paywall.errors.sync'),
  });

  async function purchase() {
    if (!chosen) return;
    setMessage(null);
    setBusy('buy');
    try {
      const outcome = await buy(chosen.pkg);
      if (outcome === 'purchased') {
        await refresh();
        setMessage({
          tone: 'ok',
          text: t('paywall.success', { plan: t(`paywall.${chosen.tier}.name`) }),
        });
      } else if (outcome === 'pending') {
        setMessage({ tone: 'medium', text: t('paywall.pending') });
      }
    } catch (e) {
      setMessage(failure(e));
    } finally {
      setBusy(null);
    }
  }

  async function restorePurchases() {
    setMessage(null);
    setBusy('restore');
    try {
      await restore();
      await refresh();
      setMessage({ tone: 'ok', text: t('paywall.restored') });
    } catch (e) {
      setMessage(failure(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="title" accessibilityRole="header">
        {chosenTrial ? t('paywall.titleTrial', { days: chosenTrial }) : t('paywall.title')}
      </Text>
      <Text color="muted">{t('paywall.subtitle')}</Text>

      {!available ? (
        <Notice tone="medium">{t('paywall.unavailable')}</Notice>
      ) : plans.isPending ? (
        <ActivityIndicator />
      ) : plans.isError || !plans.data?.length ? (
        <>
          <Notice tone="warn">{t('paywall.errors.offerings')}</Notice>
          <Button variant="ghost" label={t('common.retry')} onPress={() => void plans.refetch()} />
        </>
      ) : (
        <View accessibilityRole="radiogroup" style={{ gap: spacing.md }}>
          {plans.data.map(({ pkg, tier: planTier }) => {
            const isSelected = chosen?.tier === planTier;
            const isCurrent = tier === planTier;
            const trial = trialDays(pkg.product);
            const features = t(`paywall.${planTier}.features`, { returnObjects: true }) as string[];
            return (
              <Pressable
                key={pkg.identifier}
                testID={`plan-${planTier}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelected(planTier)}
                style={{
                  borderWidth: 2,
                  borderColor: isSelected ? colors.accent : colors.line,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  gap: spacing.xs,
                }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: spacing.sm,
                  }}>
                  <Text variant="heading">{t(`paywall.${planTier}.name`)}</Text>
                  <Text variant="label">
                    {t('paywall.perMonth', { price: pkg.product.priceString })}
                  </Text>
                </View>
                {trial ? (
                  <Text variant="small" color="ok">
                    {t('paywall.trialThen', { days: trial, price: pkg.product.priceString })}
                  </Text>
                ) : null}
                {features.map((f) => (
                  <Text key={f} variant="small">{`•  ${f}`}</Text>
                ))}
                {isCurrent ? (
                  <Text variant="small" color="accent">
                    {t('paywall.current')}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          <Button
            testID="paywall-buy"
            label={chosenTrial ? t('paywall.startTrial') : t('paywall.subscribe')}
            loading={busy === 'buy'}
            disabled={!!busy || chosen?.tier === tier}
            onPress={() => void purchase()}
          />
        </View>
      )}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {available ? (
        <LinkButton label={t('paywall.restore')} onPress={() => void restorePurchases()} />
      ) : null}
      {tier !== 'free' || message?.tone === 'ok' ? (
        <Button variant="ghost" label={t('paywall.done')} onPress={() => router.back()} />
      ) : null}

      <Text variant="small" color="muted">
        {t(Platform.OS === 'ios' ? 'paywall.legalIos' : 'paywall.legalAndroid')}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        {env.termsUrl ? (
          <LinkButton
            label={t('paywall.terms')}
            onPress={() => void Linking.openURL(env.termsUrl)}
          />
        ) : null}
        {env.privacyUrl ? (
          <LinkButton
            label={t('paywall.privacy')}
            onPress={() => void Linking.openURL(env.privacyUrl)}
          />
        ) : null}
      </View>
    </Screen>
  );
}
