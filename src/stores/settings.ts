import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getDeviceLanguage, type Language } from '@/i18n/languages';
import { secureStorage } from '@/lib/storage';
import type { ThemePreference } from '@/theme/tokens';

export type { ThemePreference };

interface SettingsState {
  language: Language;
  themePreference: ThemePreference;
  /** The member turned on daily reminders (OS permission is checked separately). */
  remindersEnabled: boolean;
  /** The member connected Apple Health / Health Connect for sleep and steps. */
  healthEnabled: boolean;
  hasHydrated: boolean;
  setRemindersEnabled: (enabled: boolean) => void;
  setHealthEnabled: (enabled: boolean) => void;
  setLanguage: (language: Language) => void;
  setThemePreference: (preference: ThemePreference) => void;
}

/** Device-local UI preferences. Server-side profile settings live in Supabase. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: getDeviceLanguage(),
      themePreference: 'system',
      remindersEnabled: false,
      healthEnabled: false,
      hasHydrated: false,
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      setHealthEnabled: (healthEnabled) => set({ healthEnabled }),
      setLanguage: (language) => set({ language }),
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: 'rafiq.settings',
      storage: createJSONStorage(() => secureStorage),
      partialize: ({ language, themePreference, remindersEnabled, healthEnabled }) => ({
        language,
        themePreference,
        remindersEnabled,
        healthEnabled,
      }),
      onRehydrateStorage: () => () => useSettings.setState({ hasHydrated: true }),
    },
  ),
);
