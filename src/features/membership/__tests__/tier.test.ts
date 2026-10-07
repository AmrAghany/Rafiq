import { can, effectiveTier } from '../entitlements';

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

describe('can', () => {
  it('unlocks Pro features for Pro and Elite, and coach review only for Elite', () => {
    expect(can('free', 'ai_coach')).toBe(false);
    expect(can('free', 'meal_plans')).toBe(false);
    for (const f of ['ai_coach', 'scan_photo', 'meal_plans', 'meal_ai'] as const) {
      expect(can('pro', f)).toBe(true);
      expect(can('elite', f)).toBe(true);
    }
    expect(can('pro', 'coach_review')).toBe(false);
    expect(can('elite', 'coach_review')).toBe(true);
  });
});
