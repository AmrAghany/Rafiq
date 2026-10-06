import 'i18next';

import type en from './locales/en.json';

// Type-checks translation keys: t('tabs.today') compiles, t('tabs.typo') does not.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
