import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from './locales/ar.json';
import en from './locales/en.json';

export type Language = 'en' | 'ar';

const saved = (() => {
  try {
    return localStorage.getItem('rafiq.coach.language');
  } catch {
    return null;
  }
})();

// A dedicated instance; initReactI18next makes it the one useTranslation() reads.
const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: saved === 'ar' || saved === 'en' ? saved : navigator.language.startsWith('ar') ? 'ar' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

/** Sets the language and the page direction (Arabic is right to left). */
export function applyLanguage(language: Language) {
  void i18n.changeLanguage(language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  try {
    localStorage.setItem('rafiq.coach.language', language);
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}

applyLanguage(i18n.language as Language);

export default i18n;
