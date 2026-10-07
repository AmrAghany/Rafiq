/**
 * End-to-end check of onboarding against a real local Supabase (npm run db:start).
 * Skipped unless SUPABASE_INTEGRATION_URL and SUPABASE_INTEGRATION_ANON_KEY are set:
 *   SUPABASE_INTEGRATION_URL=http://127.0.0.1:54321 SUPABASE_INTEGRATION_ANON_KEY=... npm run test:integration
 */
import { createClient } from '@supabase/supabase-js';

import { emptyDraft, type OnboardingDraft } from '@/features/onboarding/validation';
import type { Plan } from '@/features/plan/engine';
import type { Database } from '@/lib/database.types';

import { buildOnboardingPayload } from '@/features/onboarding/payload';
import { toPlanInput } from '@/features/onboarding/validation';
import { buildRescanPayload, emptyRescan } from '@/features/progress/rescan';

const url = process.env.SUPABASE_INTEGRATION_URL;
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY;
const describeIfDb = url && anonKey ? describe : describe.skip;

const draft: OnboardingDraft = {
  ...emptyDraft,
  name: 'Layla',
  sex: 'female',
  birthDay: '3',
  birthMonth: '7',
  birthYear: '1992',
  heightCm: '164',
  weightKg: '٦٣٫٥', // typed on an Arabic keyboard
  goal: 'lose',
  trainingDays: 3,
  experience: 'beginner',
  bodyFatPct: '31',
  bmrKcal: '1320',
  healthFlags: ['injury'],
  medicalNoticeAcceptedAt: new Date().toISOString(),
};

describeIfDb('onboarding against local Supabase', () => {
  const client = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });

  it('signs up, completes onboarding and reads the active plan back', async () => {
    const email = `it-${Date.now()}@example.com`;
    const { error: signUpError } = await client.auth.signUp({ email, password: 'long-enough-pw' });
    expect(signUpError).toBeNull();

    const payload = buildOnboardingPayload(draft, { locale: 'ar', timezone: 'Asia/Dubai' });
    const { data: planId, error } = await client.rpc('complete_onboarding', payload);
    expect(error).toBeNull();
    expect(typeof planId).toBe('string');

    const { data: profile } = await client
      .from('profiles')
      .select('display_name, weight_kg, health_flags, onboarding_completed_at, locale')
      .single();
    expect(profile).toMatchObject({
      display_name: 'Layla',
      weight_kg: 63.5,
      health_flags: ['injury'],
      locale: 'ar',
    });
    expect(profile?.onboarding_completed_at).not.toBeNull();

    const { data: plan } = await client
      .from('plans')
      .select('version, plan')
      .eq('is_active', true)
      .single();
    const stored = plan!.plan as unknown as Plan;
    expect(plan!.version).toBe(1);
    expect(stored.proteinG).toBe(Math.round(63.5 * 0.69 * 2.4)); // >30% body fat → lean-mass protein
    expect(stored.safety.doctorNotice).toBe(true);

    // Four weeks later: a rescan rebuilds the plan and keeps the history.
    const { args } = buildRescanPayload(toPlanInput(draft), {
      ...emptyRescan,
      weightKg: '61',
      bodyFatPct: '28.5',
      skeletalMuscleKg: '24.1',
    });
    const { error: rescanError } = await client.rpc('record_scan', args);
    expect(rescanError).toBeNull();
    const { data: scans } = await client
      .from('body_scans')
      .select('weight_kg, body_fat_pct')
      .order('created_at');
    expect(scans).toEqual([
      { weight_kg: 63.5, body_fat_pct: 31 },
      { weight_kg: 61, body_fat_pct: 28.5 },
    ]);
    const { data: plans } = await client
      .from('plans')
      .select('version, is_active')
      .order('version');
    expect(plans).toEqual([
      { version: 1, is_active: false },
      { version: 2, is_active: true },
    ]);

    await client.auth.signOut();
  });
});
