import '@/i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, Notice, Screen } from '@/components/ui';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { PurchasesSync } from '@/features/membership/PurchasesSync';
import { useProfile } from '@/features/profile/api';
import { useLanguageSync } from '@/i18n/useLanguageSync';
import { useSettings } from '@/stores/settings';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { t } = useTranslation();
  const { session, isLoaded } = useAuth();
  const settingsHydrated = useSettings((s) => s.hasHydrated);
  const profile = useProfile();
  const { scheme, colors } = useTheme();
  useLanguageSync();

  const signedIn = session != null;
  const ready = isLoaded && settingsHydrated && (!signedIn || !profile.isPending);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (signedIn && profile.isError) {
    return (
      <Screen>
        <Notice tone="warn">{t('auth.errors.generic')}</Notice>
        <Button label={t('common.retry')} onPress={() => void profile.refetch()} />
      </Screen>
    );
  }

  const onboarded = !!profile.data?.onboarding_completed_at;
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <PurchasesSync />
      <Stack
        screenOptions={{
          headerShown: false,
          headerTintColor: colors.accent,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.ink },
        }}>
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="plan" options={{ headerShown: true, title: t('plan.myPlan') }} />
          <Stack.Screen name="history" options={{ headerShown: true, title: t('history.title') }} />
          <Stack.Screen
            name="progress"
            options={{ headerShown: true, title: t('progress.title') }}
          />
          <Stack.Screen name="rescan" options={{ headerShown: true, title: t('rescan.title') }} />
          <Stack.Screen
            name="review/[id]"
            options={{ headerShown: true, title: t('review.title') }}
          />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        {/* Declared after the onboarding and tab groups: when a guard changes, the router
            opens the first allowed screen, which must never be the paywall. */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen
            name="paywall"
            options={{ headerShown: true, presentation: 'modal', title: t('paywall.header') }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="auth/callback" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
