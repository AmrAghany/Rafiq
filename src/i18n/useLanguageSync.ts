import { useEffect, useRef } from 'react';

import { useSettings } from '@/stores/settings';

import { changeLanguage } from './index';
import { applyLayoutDirection, reloadApp } from './rtl';

/**
 * Keeps i18next and the native layout direction in step with the saved
 * language. Runs once settings have loaded from storage. If the saved language
 * needs the other direction at launch, the app reloads (dev) or picks it up on
 * next launch (release); in-app switches prompt the user from the Me tab.
 */
export function useLanguageSync() {
  const language = useSettings((s) => s.language);
  const hydrated = useSettings((s) => s.hasHydrated);
  const checkedLaunchDirection = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    void changeLanguage(language);
    if (!checkedLaunchDirection.current) {
      checkedLaunchDirection.current = true;
      if (applyLayoutDirection(language)) reloadApp();
    }
  }, [hydrated, language]);
}
