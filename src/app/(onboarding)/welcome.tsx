import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Notice, Panel, Screen, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/store';
import { useProfile } from '@/features/profile/api';

export default function OnboardingWelcome() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const { draft, update } = useOnboarding();

  // Prefill the first name from Apple/Google sign-in if we have one.
  useEffect(() => {
    if (!draft.name && profile?.display_name) update({ name: profile.display_name.split(' ')[0] });
  }, [draft.name, profile?.display_name, update]);

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {t('onboarding.welcome.title')}
      </Text>
      <Text color="muted">{t('onboarding.welcome.body')}</Text>
      <Panel>
        <Text variant="heading" accessibilityRole="header">
          {t('onboarding.welcome.noticeTitle')}
        </Text>
        <Notice>{t('onboarding.welcome.noticeBody')}</Notice>
        <Button
          testID="accept-notice"
          label={t('onboarding.welcome.accept')}
          onPress={() => {
            update({ medicalNoticeAcceptedAt: new Date().toISOString() });
            router.push('/about');
          }}
        />
      </Panel>
    </Screen>
  );
}
