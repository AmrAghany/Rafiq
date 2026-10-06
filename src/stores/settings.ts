import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getDeviceLanguage, type Language } from '@/i18n/languages';
import { secureStorage } from '@/lib/storage';
import type { ThemePreference } from '@/theme/tokens';

export type { ThemePreference };

interface SettingsState {
  language: Language;
  themePreference: ThemePreference;
  hasHydrated: boolean;
  setLanguage: (language: Language) => void;
  setThemePreference: (preference: ThemePreference) => void;
}

/** Device-local UI preferences. Server-side profile settings live in Supabase. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: getDeviceLanguage(),
      themePreference: 'system',
      hasHydrated: false,
      setLanguage: (language) => set({ language }),
      setThemePreference: (themePreference) => set({ themePreference }),
    }),
    {
      name: 'rafiq.settings',
      storage: createJSONStorage(() => secureStorage),
      partialize: ({ language, themePreference }) => ({ language, themePreference }),
      onRehydrateStorage: () => () => useSettings.setState({ hasHydrated: true }),
    },
  ),
);
