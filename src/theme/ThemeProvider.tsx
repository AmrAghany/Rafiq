import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '@/stores/settings';

import { buildTheme, resolveScheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(buildTheme('light'));

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const preference = useSettings((s) => s.themePreference);
  const scheme = resolveScheme(preference, system);
  const theme = useMemo(() => buildTheme(scheme), [scheme]);

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    const c = theme.colors;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.accent,
        background: c.bg,
        card: c.surface,
        text: c.ink,
        border: c.line,
        notification: c.warn,
      },
    };
  }, [scheme, theme]);

  return (
    <ThemeContext.Provider value={theme}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
