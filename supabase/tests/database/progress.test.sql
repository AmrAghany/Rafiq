-- Phase 6: record_scan() and the Ramadan times. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

-- Member A has onboarded (first scan and plan version 1); member B has not.
update public.profiles set onboarding_completed_at = now(), weight_kg = 82
where id = '11111111-1111-1111-1111-111111111111';
insert into public.body_scans (id, user_id, scanned_on, source, weight_kg, body_fat_pct)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        current_date - 28, 'manual', 82, 18.4);
insert into public.plans (user_id, version, body_scan_id, engine_version, inputs, plan)
values ('11111111-1111-1111-1111-111111111111', 1, 'aaaaaaaa-0000-0000-0000-000000000001',
        '1.0.0', '{"weightKg": 82}', '{"targetKcal": 2670}');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$select public.record_scan(
      '{"source": "manual", "weight_kg": 79.5, "body_fat_pct": 16.2, "skeletal_muscle_kg": 37}',
      '{"weightKg": 79.5}', '{"targetKcal": 2600}', '1.0.0')$$,
  'a member can record a rescan'
);

select results_eq(
  $$select weight_kg, body_fat_pct, skeletal_muscle_kg, scanned_on = current_date
    from public.body_scans order by scanned_on$$,
  $$values (82.0::numeric, 18.4::numeric, null::numeric, false), (79.5, 16.2, 37.0, true)$$,
  'the new scan is added and the first one is kept'
);

select results_eq(
  $$select version, is_active, (plan ->> 'targetKcal')::int from public.plans order by version$$,
  $$values (1, false, 2670), (2, true, 2600)$$,
  'the rebuilt plan becomes version 2 and the old plan is kept, inactive'
);

select is(
  (select p.body_scan_id = s.id from public.plans p
   join public.body_scans s on s.weight_kg = 79.5 where p.is_active),
  true,
  'the new plan points at the new scan'
);

select is(
  (select weight_kg from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  79.5::numeric,
  'the profile weight follows the latest scan'
);

select throws_ok(
  $$select public.record_scan('{"body_fat_pct": 16}', '{}', '{}', '1.0.0')$$,
  '23502', null,
  'a rescan needs a weight'
);

select throws_ok(
  $$select public.record_scan(
      '{"weight_kg": 80, "source": "photo", "photo_path": "22222222-2222-2222-2222-222222222222/x.jpg"}',
      '{}', '{}', '1.0.0')$$,
  '42501', null,
  'a rescan cannot use another member''s photo'
);

-- Ramadan times: members can set their own.
select lives_ok(
  $$update public.profiles set ramadan_mode = true, suhoor_time = '04:10', iftar_time = '18:12'
    where id = '11111111-1111-1111-1111-111111111111'$$,
  'a member can set Ramadan mode and times'
);
select results_eq(
  $$select ramadan_mode, suhoor_time, iftar_time from public.profiles$$,
  $$values (true, '04:10'::time, '18:12'::time)$$,
  'Ramadan times are saved (and only the member''s own profile is visible)'
);

-- Member B: not onboarded, and can't touch A's scans.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select throws_ok(
  $$select public.record_scan('{"weight_kg": 70}', '{}', '{}', '1.0.0')$$,
  '55000', null,
  'a member must finish onboarding before a rescan'
);
select is((select count(*)::int from public.body_scans), 0, 'other members'' scans are hidden');

reset role;
select is(
  (select count(*)::int from public.plans where user_id = '11111111-1111-1111-1111-111111111111' and is_active),
  1,
  'exactly one active plan'
);

select * from finish();
rollback;
