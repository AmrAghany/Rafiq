// Design tokens ported from reference/rafiq-prototype.html (:root CSS variables).

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'system' | ColorScheme;

export interface Palette {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  soft: string;
  accent: string;
  onAccent: string;
  /** Carb-cycle day colours: High, Medium, Low. */
  high: string;
  medium: string;
  low: string;
  warn: string;
  ok: string;
}

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    bg: '#E9ECEF',
    surface: '#FFFFFF',
    ink: '#1A1F29',
    muted: '#5D6675',
    line: '#D5DAE0',
    soft: '#F2F4F6',
    accent: '#1F5FBF',
    onAccent: '#FFFFFF',
    high: '#E09A00',
    medium: '#1F5FBF',
    low: '#16917F',
    warn: '#D7263D',
    ok: '#2E9E5B',
  },
  dark: {
    bg: '#12161D',
    surface: '#1C222C',
    ink: '#EEF1F5',
    muted: '#9AA4B3',
    line: '#2D3542',
    soft: '#232A35',
    accent: '#5B93E8',
    onAccent: '#FFFFFF',
    high: '#F5B83A',
    medium: '#5B93E8',
    low: '#36C2AC',
    warn: '#F0475C',
    ok: '#4CC27E',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 10, md: 12, lg: 16, pill: 999 } as const;

export const typography = {
  hero: { fontSize: 40, lineHeight: 44, fontWeight: '700' },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 21, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

export interface Theme {
  scheme: ColorScheme;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

export function buildTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: palettes[scheme], spacing, radius, typography };
}

export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
