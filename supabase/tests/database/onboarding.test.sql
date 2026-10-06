-- complete_onboarding() and seeded content. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

-- Seeded content (supabase/seed.sql runs on db reset).
select ok((select count(*) from public.exercises) >= 20, 'exercise library is seeded');
select is(
  (select exercise_keys from public.workout_templates where key = 'lower_a'),
  array['back_squat', 'romanian_deadlift', 'walking_lunge', 'leg_curl', 'calf_raise', 'plank'],
  'workout templates are seeded'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

create temporary table answers as
select
  jsonb_build_object(
    'display_name', ' Amal ',
    'sex', 'female',
    'date_of_birth', '1994-03-02',
    'height_cm', 165,
    'weight_kg', 64.5,
    'goal', 'recomp',
    'training_days', 4,
    'experience', 'beginner',
    'health_flags', jsonb_build_array('injury'),
    'locale', 'ar',
    'timezone', 'Asia/Riyadh',
    'medical_notice_accepted_at', now()
  ) as profile,
  jsonb_build_object('weight_kg', 64.5, 'body_fat_pct', 27.1, 'skeletal_muscle_kg', 25.3, 'bmr_kcal', 1390) as scan;

select lives_ok(
  $$select public.complete_onboarding(
      (select profile from answers), (select scan from answers),
      '{"goal": "recomp"}'::jsonb, '{"targetKcal": 1900}'::jsonb, '1.0.0')$$,
  'a member can complete onboarding'
);

select results_eq(
  $$select display_name, sex::text, goal::text, training_days::int, health_flags::text[], locale,
           onboarding_completed_at is not null
    from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  $$values ('Amal', 'female', 'recomp', 4, array['injury'], 'ar', true)$$,
  'profile answers are saved and onboarding is marked complete'
);

select results_eq(
  $$select source::text, body_fat_pct, bmr_kcal, confirmed_at is not null from public.body_scans$$,
  $$values ('manual', 27.1::numeric, 1390, true)$$,
  'the confirmed scan is saved'
);

select results_eq(
  $$select version, is_active, engine_version, plan ->> 'targetKcal', body_scan_id is not null from public.plans$$,
  $$values (1, true, '1.0.0', '1900', true)$$,
  'the first plan is saved as version 1, linked to the scan'
);

-- Redoing onboarding (e.g. a rescan) keeps history and activates the new plan.
select lives_ok(
  $$select public.complete_onboarding(
      (select profile from answers), (select scan from answers), '{}'::jsonb, '{}'::jsonb, '1.0.0')$$,
  'onboarding can be completed again'
);
select results_eq(
  $$select version, is_active from public.plans order by version$$,
  $$values (1, false), (2, true)$$,
  'older plans are kept and deactivated'
);
select is((select count(*)::int from public.body_scans), 2, 'scan history is kept');

select throws_ok(
  $$select public.complete_onboarding(
      (select profile - 'medical_notice_accepted_at' from answers), (select scan from answers),
      '{}'::jsonb, '{}'::jsonb, '1.0.0')$$,
  '23514',
  'The medical notice must be accepted',
  'the medical notice is required'
);

select throws_ok(
  $$select public.complete_onboarding(
      (select jsonb_set(profile, '{date_of_birth}', to_jsonb((current_date - interval '17 years')::date)) from answers),
      (select scan from answers), '{}'::jsonb, '{}'::jsonb, '1.0.0')$$,
  '23514',
  'Rafiq is only available to members aged 18 or over',
  'under-18 members cannot complete onboarding'
);

-- Member B sees none of A's data.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.plans), 0, 'another member cannot see the plan');
select is(
  (select onboarding_completed_at from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'another member''s onboarding is untouched'
);

reset role;
set local role anon;
select throws_ok(
  $$select public.complete_onboarding('{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '1.0.0')$$,
  '42501',
  null,
  'anonymous users cannot call complete_onboarding'
);

select * from finish();
rollback;
