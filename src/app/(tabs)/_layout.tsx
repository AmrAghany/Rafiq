import * as Notifications from 'expo-notifications';
import { router, Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useHealthSync } from '@/features/health/useHealthSync';
import { useRescanReminder } from '@/features/progress/useRescanReminder';
import { useReminderSync } from '@/features/reminders/useReminderSync';

import { useTheme } from '@/theme/ThemeProvider';

type SymbolName = SymbolViewProps['name'];

const ICONS: Record<string, SymbolName> = {
  index: { ios: 'sun.max', android: 'light_mode' },
  train: { ios: 'dumbbell', android: 'fitness_center' },
  food: { ios: 'fork.knife', android: 'restaurant' },
  coach: { ios: 'bubble.left', android: 'chat_bubble' },
  me: { ios: 'person', android: 'person' },
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  useReminderSync();
  useRescanReminder();
  useHealthSync();

  // Tapping a reminder opens the screen it is about.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (url === '/' || url === '/train' || url === '/progress') router.navigate(url);
  }, [response]);

  const tabs = [
    { name: 'index', title: t('tabs.today') },
    { name: 'train', title: t('tabs.train') },
    { name: 'food', title: t('tabs.food') },
    { name: 'coach', title: t('tabs.coach') },
    { name: 'me', title: t('tabs.me') },
  ] as const;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontWeight: '600' },
      }}>
      {tabs.map(({ name, title }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarAccessibilityLabel: title,
            tabBarIcon: ({ color, size }) => (
              <SymbolView name={ICONS[name]} tintColor={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
