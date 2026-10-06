import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, Panel, Text } from '@/components/ui';

/** Shown in place of a paid feature, with a way into the paywall. */
export function LockedCard({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation();
  return (
    <Panel>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      <Text color="muted">{body}</Text>
      <Button
        testID="open-paywall"
        label={t('paywall.cta')}
        onPress={() => router.push('/paywall')}
      />
    </Panel>
  );
}
