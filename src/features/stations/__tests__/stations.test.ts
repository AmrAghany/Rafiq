import { normaliseCode } from '../api';

describe('station codes', () => {
  it('accepts 6 digits typed any way', () => {
    expect(normaliseCode('123456')).toBe('123456');
    expect(normaliseCode(' 123 456 ')).toBe('123456');
    expect(normaliseCode('123-456')).toBe('123456');
    expect(normaliseCode('١٢٣٤٥٦')).toBe('123456');
    expect(normaliseCode('۱۲۳۴۵۶')).toBe('123456');
  });

  it('rejects anything else', () => {
    expect(normaliseCode('12345')).toBeNull();
    expect(normaliseCode('1234567')).toBeNull();
    expect(normaliseCode('12a456')).toBeNull();
    expect(normaliseCode('')).toBeNull();
  });
});
