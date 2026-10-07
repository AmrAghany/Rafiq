import { buildTheme, palettes, resolveScheme } from '../tokens';

describe('theme', () => {
  it('light and dark palettes define the same tokens', () => {
    expect(Object.keys(palettes.dark).sort()).toEqual(Object.keys(palettes.light).sort());
  });

  it('follows the system scheme unless the member picks one', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('builds a theme with the matching palette', () => {
    expect(buildTheme('dark').colors).toBe(palettes.dark);
  });
});
