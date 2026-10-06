/**
 * Today/Train/Food data paths against a real local Supabase, using the same table
 * shapes, upsert conflict targets and embedded selects as the app.
 * Skipped unless SUPABASE_INTEGRATION_URL and SUPABASE_INTEGRATION_ANON_KEY are set.
 */
import { createClient } from '@supabase/supabase-js';

import { emptyDraft } from '@/features/onboarding/validation';
import { buildOnboardingPayload } from '@/features/onboarding/payload';
import { exerciseHistory, type WorkoutSession } from '@/features/train/api';
import { nextTarget } from '@/features/train/progression';
import { SESSION_COLUMNS } from '@/features/train/queries';
import type { Database } from '@/lib/database.types';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/auth/AuthProvider', () => ({}));

const url = process.env.SUPABASE_INTEGRATION_URL;
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY;
const describeIfDb = url && anonKey ? describe : describe.skip;

describeIfDb('daily experience against local Supabase', () => {
  const db = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } });
  let uid = '';

  beforeAll(async () => {
    const { data } = await db.auth.signUp({
      email: `daily-${Date.now()}@example.com`,
      password: 'long-enough-pw',
    });
    uid = data.user!.id;
    const { error } = await db.rpc(
      'complete_onboarding',
      buildOnboardingPayload(
        {
          ...emptyDraft,
          name: 'Sam',
          sex: 'male',
          birthDay: '14',
          birthMonth: '2',
          birthYear: '1997',
          heightCm: '178',
          weightKg: '82',
          goal: 'recomp',
          trainingDays: 4,
          experience: 'intermediate',
          medicalNoticeAcceptedAt: new Date().toISOString(),
        },
        { locale: 'en', timezone: 'UTC' },
      ),
    );
    expect(error).toBeNull();
  });

  afterAll(() => db.auth.signOut());

  it('upserts the daily log (check-in, water, timeline) on one row per day', async () => {
    const row = {
      user_id: uid,
      log_date: '2026-10-05',
      checkin: { sleep: 1, energy: 2, soreness: 2, score: 60 },
      readiness_score: 60,
      water_glasses: 1,
      completed_items: ['checkin'],
    };
    expect(
      (await db.from('daily_logs').upsert(row, { onConflict: 'user_id,log_date' })).error,
    ).toBeNull();
    expect(
      (
        await db
          .from('daily_logs')
          .upsert(
            { ...row, water_glasses: 2, completed_items: ['checkin', 'breakfast'] },
            { onConflict: 'user_id,log_date' },
          )
      ).error,
    ).toBeNull();
    const { data } = await db.from('daily_logs').select('water_glasses, completed_items, checkin');
    expect(data).toEqual([
      { water_glasses: 2, completed_items: ['checkin', 'breakfast'], checkin: row.checkin },
    ]);
  });

  async function logSession(date: string, kg: number) {
    const { data: session, error } = await db
      .from('workout_sessions')
      .upsert(
        { user_id: uid, log_date: date, workout_key: 'lower_a' },
        { onConflict: 'user_id,log_date,workout_key' },
      )
      .select(SESSION_COLUMNS)
      .single();
    expect(error).toBeNull();
    for (let n = 1; n <= 4; n++) {
      const { error: setError } = await db.from('set_logs').upsert(
        {
          session_id: session!.id,
          user_id: uid,
          exercise_key: 'back_squat',
          set_number: n,
          target_reps: 6,
          target_weight_kg: kg,
          actual_reps: 6,
          actual_weight_kg: kg,
          completed: true,
        },
        { onConflict: 'session_id,exercise_key,set_number' },
      );
      expect(setError).toBeNull();
    }
    return session!.id;
  }

  it('logs sessions and sets, and reads them back embedded for progression', async () => {
    const first = await logSession('2026-09-29', 65);
    await logSession('2026-10-02', 65);
    // Upserting the same day again reuses the session; re-logging a set edits it.
    expect(await logSession('2026-09-29', 65)).toBe(first);

    const { error: swapError } = await db
      .from('workout_sessions')
      .update({ swaps: { back_squat: 'leg_press' } })
      .eq('id', first);
    expect(swapError).toBeNull();

    const { data, error } = await db
      .from('workout_sessions')
      .select(SESSION_COLUMNS)
      .lt('log_date', '2026-10-05')
      .order('log_date', { ascending: false });
    expect(error).toBeNull();
    const sessions = data as unknown as WorkoutSession[];
    expect(sessions.map((s) => s.log_date)).toEqual(['2026-10-02', '2026-09-29']);
    expect(sessions[1].swaps).toEqual({ back_squat: 'leg_press' });
    expect(sessions[0].set_logs).toHaveLength(4);

    const history = exerciseHistory(sessions);
    expect(
      nextTarget({ startKg: 65, history: history.back_squat, prescribedSets: 4, incrementKg: 5 }),
    ).toEqual({
      targetKg: 65,
      suggestedKg: 70,
    });
  });

  it('logs and removes meals, linking planned ones to their template', async () => {
    const { error } = await db.from('meal_logs').insert([
      {
        user_id: uid,
        log_date: '2026-10-05',
        name: 'Oats',
        kcal: 720,
        source: 'plan',
        template_key: 'high_breakfast',
      },
      {
        user_id: uid,
        log_date: '2026-10-05',
        name: 'Shawarma',
        kcal: 550,
        protein_g: 32,
        source: 'manual',
      },
    ]);
    expect(error).toBeNull();
    const { data } = await db
      .from('meal_logs')
      .select('id, name, template_key')
      .eq('log_date', '2026-10-05')
      .order('eaten_at');
    expect(data!.map((m) => m.template_key)).toEqual(['high_breakfast', null]);
    expect((await db.from('meal_logs').delete().eq('id', data![1].id)).error).toBeNull();
    expect((await db.from('meal_logs').select('id')).data).toHaveLength(1);
  });

  it('saves the member’s schedule on the profile', async () => {
    expect(
      (
        await db
          .from('profiles')
          .update({ wake_time: '05:45', workout_time: '07:00' })
          .eq('id', uid)
      ).error,
    ).toBeNull();
    const { data } = await db.from('profiles').select('wake_time, workout_time').single();
    expect(data).toEqual({ wake_time: '05:45:00', workout_time: '07:00:00' });
  });
});
