import { effectiveTier } from '../useTier';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('effectiveTier', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  it('mirrors public.current_tier', () => {
    expect(effectiveTier(null, now)).toBe('free');
    expect(effectiveTier({ tier: 'pro', current_period_ends_at: null }, now)).toBe('pro');
    expect(
      effectiveTier({ tier: 'elite', current_period_ends_at: '2026-11-01T00:00:00Z' }, now),
    ).toBe('elite');
    expect(
      effectiveTier({ tier: 'pro', current_period_ends_at: '2026-10-01T00:00:00Z' }, now),
    ).toBe('free');
  });
});
