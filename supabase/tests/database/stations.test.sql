-- Smart stations: pairing by code and logging sets. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');
update public.profiles set timezone = 'Asia/Riyadh';

-- Member A's active plan: every day is "lower_a" so the test doesn't depend on the weekday.
insert into public.plans (user_id, version, engine_version, inputs, plan)
values ('11111111-1111-1111-1111-111111111111', 1, '1.0.0', '{}',
  jsonb_build_object(
    'week', (select jsonb_agg(jsonb_build_object('workoutKey', 'lower_a', 'dayType', 'high')) from generate_series(1, 7)),
    'schemes', '{"main": {"sets": 4, "reps": 6}, "accessory": {"sets": 3, "reps": 10}}'::jsonb));

insert into public.stations (id, label, gym_name, exercise_keys, secret)
values ('fitzone-rack-3', 'Rack 3', 'FitZone Olaya', array['back_squat', 'deadlift'], repeat('s', 40));

-- Members can't see stations, secrets or pairings directly.
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.stations), 0, 'members cannot read stations or secrets');
select throws_ok($$select public.station_pairing_code('fitzone-rack-3')$$, '42501', null,
  'members cannot make pairing codes');
select throws_ok($$select public.station_log_set('fitzone-rack-3', 'e0', 'back_squat', 100, 5, now())$$,
  '42501', null, 'members cannot log sets as a station');

-- The station asks for a code (service role, as station-api does).
reset role;
create temporary table code as select public.station_pairing_code('fitzone-rack-3') as c;
grant select on code to authenticated;
select matches((select c ->> 'code' from code), '^[0-9]{6}$', 'the station gets a 6-digit code');

select throws_ok($$select public.station_log_set('fitzone-rack-3', 'e1', 'back_squat', 100, 5, now())$$,
  'P0002', 'not_paired', 'no sets are logged before anyone pairs');

set local role authenticated;
select throws_ok($$select public.pair_station('000000')$$, 'P0002', 'invalid_code', 'a wrong code is refused');
select is(
  (select public.pair_station((select c ->> 'code' from code)) ->> 'label'),
  'Rack 3',
  'member A pairs with the code');
select is((select public.my_station_pairing() ->> 'gym_name'), 'FitZone Olaya', 'the app sees the pairing');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$select public.pair_station((select c ->> 'code' from code))$$, 'P0002', 'invalid_code',
  'a used code cannot be used again');
select is(public.my_station_pairing(), null, 'member B is not paired');

-- The station logs sets for member A.
reset role;
select is(
  (select public.station_log_set('fitzone-rack-3', 'e1', 'back_squat', 100, 5, now()) ->> 'set_number'),
  '1', 'the first set is set 1');
select is(
  (select public.station_log_set('fitzone-rack-3', 'e2', 'back_squat', 102.5, 5, now()) ->> 'set_number'),
  '2', 'the next set is set 2');
select is(
  (select public.station_log_set('fitzone-rack-3', 'e2', 'back_squat', 102.5, 5, now()) ->> 'status'),
  'duplicate', 'a retried event is not logged twice');
select throws_ok($$select public.station_log_set('fitzone-rack-3', 'e3', 'bench_press', 60, 5, now())$$,
  '22023', 'exercise_not_tracked', 'only lifts the station tracks');
select throws_ok($$select public.station_log_set('fitzone-rack-3', 'e4', 'back_squat', 100, 0, now())$$,
  '22023', 'implausible_set', 'implausible sets are refused');

select results_eq(
  $$select s.workout_key, l.set_number, l.actual_weight_kg, l.actual_reps, l.target_reps, l.completed, l.source, l.station_id
    from public.set_logs l join public.workout_sessions s on s.id = l.session_id
    where l.user_id = '11111111-1111-1111-1111-111111111111' order by l.set_number$$,
  $$values ('lower_a', 1::smallint, 100.0::numeric, 5::smallint, 6::smallint, true, 'station', 'fitzone-rack-3'),
           ('lower_a', 2::smallint, 102.5::numeric, 5::smallint, 6::smallint, true, 'station', 'fitzone-rack-3')$$,
  'sets land in today''s planned session with the plan''s target reps');

-- The member sees their station sets through their own access.
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*)::int from public.set_logs where source = 'station'), 2, 'member A sees the sets');
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is((select count(*)::int from public.set_logs), 0, 'member B sees none of them');

-- Member B takes over the station with a fresh code: A's pairing ends.
reset role;
create temporary table code2 as select public.station_pairing_code('fitzone-rack-3') as c;
grant select on code2 to authenticated;
set local role authenticated;
select lives_ok($$select public.pair_station((select c ->> 'code' from code2))$$, 'member B pairs next');
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is(public.my_station_pairing(), null, 'member A is no longer paired');

-- Ending from the app.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.end_station_pairing();
select is(public.my_station_pairing(), null, 'member B ends the pairing');
reset role;
select throws_ok($$select public.station_log_set('fitzone-rack-3', 'e9', 'back_squat', 100, 5, now())$$,
  'P0002', 'not_paired', 'nothing is logged after the pairing ends');

select * from finish();
rollback;
