import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getDeviceLanguage, type Language } from './languages';
import ar from './locales/ar.json';
import en from './locales/en.json';

export const resources = { en: { translation: en }, ar: { translation: ar } } as const;

// eslint-disable-next-line import/no-named-as-default-member -- i18next's documented API
void i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes output.
  returnNull: false,
});

export function changeLanguage(language: Language) {
  // eslint-disable-next-line import/no-named-as-default-member
  return i18n.changeLanguage(language);
}

export default i18n;
