-- Row Level Security and trigger tests. Run with: npm run db:test (supabase test db).
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- Fixtures: two members, created as the auth service would.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com', '{"full_name": "Amal"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com', '{}');

insert into public.exercises (key, name_en, name_ar) values ('back_squat', 'Back squat', 'سكوات خلفي')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'RLS is enabled on every public table'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Amal',
  'signup creates a profile with the provider name'
);

select is(
  (select tier::text from public.subscriptions where user_id = '22222222-2222-2222-2222-222222222222'),
  'free',
  'signup creates a free subscription'
);

-- Data owned by member B, inserted with RLS bypassed.
insert into public.body_scans (user_id, source, body_fat_pct)
values ('22222222-2222-2222-2222-222222222222', 'manual', 22);
insert into public.workout_sessions (id, user_id, workout_key, log_date)
values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'LA', current_date);

-- ---------------------------------------------------------------------------
-- Member A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'a member sees only their own profile');
select is((select count(*)::int from public.subscriptions), 1, 'a member sees only their own subscription');
select is((select count(*)::int from public.body_scans), 0, 'a member cannot see another member''s scans');
select is((select count(*)::int from public.workout_sessions), 0, 'a member cannot see another member''s sessions');
select ok((select count(*) from public.exercises) >= 1, 'members can read exercise content');

select lives_ok(
  $$insert into public.body_scans (user_id, source, body_fat_pct)
    values ('11111111-1111-1111-1111-111111111111', 'manual', 18)$$,
  'a member can add their own scan'
);

select throws_ok(
  $$insert into public.body_scans (user_id, source, body_fat_pct)
    values ('22222222-2222-2222-2222-222222222222', 'manual', 18)$$,
  '42501',
  null,
  'a member cannot add a scan for someone else'
);

select lives_ok(
  $$update public.profiles set display_name = 'Amal K', date_of_birth = '1990-05-01'
    where id = '11111111-1111-1111-1111-111111111111'$$,
  'a member can update their own profile'
);

select throws_ok(
  $$update public.profiles set date_of_birth = current_date - interval '17 years'
    where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514',
  'Rafiq is only available to members aged 18 or over',
  'members under 18 are rejected'
);

select throws_ok(
  $$update public.profiles set created_at = now() where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  null,
  'a member cannot change server-managed profile columns'
);

update public.profiles set display_name = 'hacked' where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null,
  'updates to another member''s profile are no-ops'
);

update public.subscriptions set tier = 'elite' where user_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select tier::text from public.subscriptions where user_id = '11111111-1111-1111-1111-111111111111'),
  'free',
  'a member cannot upgrade their own tier'
);

select throws_ok(
  $$insert into public.subscriptions (user_id, tier) values ('11111111-1111-1111-1111-111111111111', 'pro')$$,
  '42501',
  null,
  'a member cannot insert subscriptions'
);

select throws_ok(
  $$insert into public.set_logs (session_id, user_id, exercise_key, set_number)
    values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'back_squat', 1)$$,
  '23503',
  null,
  'a set cannot be attached to another member''s session'
);

select throws_ok(
  $$insert into public.exercises (key, name_en, name_ar) values ('x', 'x', 'x')$$,
  '42501',
  null,
  'members cannot edit content tables'
);

select throws_ok(
  $$insert into public.ai_usage (user_id, feature, request_count)
    values ('11111111-1111-1111-1111-111111111111', 'coach_chat', 0)$$,
  '42501',
  null,
  'members cannot write their own AI usage counters'
);

select throws_ok(
  $$select public.current_tier('11111111-1111-1111-1111-111111111111')$$,
  '42501',
  null,
  'members cannot call current_tier directly'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('scan-photos', '11111111-1111-1111-1111-111111111111/scan.jpg', '11111111-1111-1111-1111-111111111111')$$,
  'a member can upload into their own photo folder'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('scan-photos', '22222222-2222-2222-2222-222222222222/scan.jpg', '11111111-1111-1111-1111-111111111111')$$,
  '42501',
  null,
  'a member cannot upload into someone else''s photo folder'
);

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  'select count(*) from public.profiles',
  '42501',
  null,
  'anonymous users cannot read profiles'
);

-- ---------------------------------------------------------------------------
-- Tier resolution (service role)
-- ---------------------------------------------------------------------------

reset role;
update public.subscriptions
set tier = 'pro', current_period_ends_at = now() - interval '1 day'
where user_id = '22222222-2222-2222-2222-222222222222';

select is(
  public.current_tier('22222222-2222-2222-2222-222222222222')::text,
  'free',
  'a lapsed paid subscription resolves to free'
);

select * from finish();
rollback;
