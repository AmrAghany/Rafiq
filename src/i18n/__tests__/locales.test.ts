import ar from '../locales/ar.json';
import en from '../locales/en.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...acc, [path]: value }
      : { ...acc, ...flatten(value, path) };
  }, {});
}

const placeholders = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).sort();

describe('translations', () => {
  const flatEn = flatten(en);
  const flatAr = flatten(ar);

  it('Arabic has exactly the same keys as English', () => {
    expect(Object.keys(flatAr).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it.each(Object.keys(flatEn))('%s is non-empty and keeps its placeholders in Arabic', (key) => {
    expect(flatEn[key].trim()).not.toBe('');
    expect(flatAr[key].trim()).not.toBe('');
    expect(placeholders(flatAr[key])).toEqual(placeholders(flatEn[key]));
  });
});
