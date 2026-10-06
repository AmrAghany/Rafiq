import { DevSettings, I18nManager, Platform } from 'react-native';

import { isRTLLanguage, type Language } from './languages';

/**
 * React Native only applies a layout-direction change after the JS bundle
 * reloads. Returns true when the direction for `language` differs from the
 * direction the app is currently laid out in (so a restart is needed).
 */
export function applyLayoutDirection(language: Language): boolean {
  const rtl = isRTLLanguage(language);

  // Web (dev preview only): react-native-web follows the document's dir attribute live.
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    return false;
  }

  I18nManager.allowRTL(true);
  if (Boolean(I18nManager.isRTL) === rtl) return false;
  I18nManager.forceRTL(rtl);
  return true;
}

/** Reloads the JS bundle where possible. Returns false if the user must restart manually. */
export function reloadApp(): boolean {
  if (__DEV__ && typeof DevSettings?.reload === 'function') {
    DevSettings.reload('Layout direction changed');
    return true;
  }
  // TODO(phase 6): use expo-updates `reloadAsync()` in release builds (needs approval to add).
  return false;
}
