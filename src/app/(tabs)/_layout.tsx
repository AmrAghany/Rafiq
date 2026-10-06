import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type SymbolName = SymbolViewProps['name'];

const ICONS: Record<string, SymbolName> = {
  index: { ios: 'sun.max', android: 'light_mode', web: 'light_mode' },
  train: { ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' },
  food: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  coach: { ios: 'bubble.left', android: 'chat_bubble', web: 'chat_bubble' },
  me: { ios: 'person', android: 'person', web: 'person' },
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

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
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          // Web dev preview only: the default bar height clips label descenders.
          ...(Platform.OS === 'web' && { height: 56 }),
        },
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
