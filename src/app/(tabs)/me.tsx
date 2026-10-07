import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { Button, Panel, Screen, Segmented, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { CoachReviewPanel } from '@/features/coachReview/CoachReviewPanel';
import { MembershipPanel } from '@/features/membership/MembershipPanel';
import { RescanCard } from '@/features/progress/RescanCard';
import { HealthSettings } from '@/features/settings/HealthSettings';
import { PrivacySettings } from '@/features/settings/PrivacySettings';
import { RamadanSettings } from '@/features/settings/RamadanSettings';
import { ScheduleSettings } from '@/features/settings/ScheduleSettings';
import type { Language } from '@/i18n/languages';
import { applyLayoutDirection, reloadApp } from '@/i18n/rtl';
import { supabase } from '@/lib/supabase';
import { useSettings, type ThemePreference } from '@/stores/settings';

export default function MeScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { language, themePreference, setLanguage, setThemePreference } = useSettings();

  function onLanguageChange(next: Language) {
    if (next === language) return;
    setLanguage(next);
    if (applyLayoutDirection(next)) {
      Alert.alert(t('language.restartTitle'), t('language.restartBody'), [
        { text: t('language.later'), style: 'cancel' },
        { text: t('language.restartNow'), onPress: () => reloadApp() },
      ]);
    }
  }

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {t('me.title')}
      </Text>
      {session?.user.email ? (
        <Text color="muted">{t('me.signedInAs', { email: session.user.email })}</Text>
      ) : null}

      <Button testID="view-plan" label={t('me.viewPlan')} onPress={() => router.push('/plan')} />

      <RescanCard always />

      <MembershipPanel />

      <CoachReviewPanel />

      <ScheduleSettings />

      <RamadanSettings />

      <HealthSettings />

      <Panel>
        <Text variant="heading" accessibilityRole="header">
          {t('me.settings')}
        </Text>
        <Segmented<Language>
          label={t('me.language')}
          value={language}
          onChange={onLanguageChange}
          options={[
            { value: 'en', label: t('language.en') },
            { value: 'ar', label: t('language.ar') },
          ]}
        />
        <Segmented<ThemePreference>
          label={t('me.appearance')}
          value={themePreference}
          onChange={setThemePreference}
          options={[
            { value: 'system', label: t('me.themeSystem') },
            { value: 'light', label: t('me.themeLight') },
            { value: 'dark', label: t('me.themeDark') },
          ]}
        />
      </Panel>

      <PrivacySettings />

      <Button
        variant="ghost"
        label={t('me.signOut')}
        onPress={() => void supabase.auth.signOut()}
      />

      <Text variant="small" color="muted" style={{ textAlign: 'center' }}>
        {t('app.notMedicalAdvice')}
      </Text>
    </Screen>
  );
}
