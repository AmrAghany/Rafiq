import { getLocales } from 'expo-localization';

export const LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];

export const RTL_LANGUAGES: readonly Language[] = ['ar'];

export const isRTLLanguage = (language: Language) => RTL_LANGUAGES.includes(language);

export function isSupportedLanguage(code: string | null | undefined): code is Language {
  return LANGUAGES.includes(code as Language);
}

/** The first supported language in the device's preference list, else English. */
export function getDeviceLanguage(): Language {
  for (const locale of getLocales()) {
    if (isSupportedLanguage(locale.languageCode)) return locale.languageCode;
  }
  return 'en';
}
