-- Phase 3 schema: sessions, swaps, meal templates. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'a@example.com');

select is(
  (select count(*)::int from public.meal_templates where key is not null and share is not null),
  12,
  'meal templates are seeded with keys and shares'
);
select is(
  (select array_agg(round(total, 2) order by day_type)
     from (select day_type, sum(share) as total from public.meal_templates group by day_type) t),
  array[1.00, 1.00, 1.00]::numeric[],
  'meal shares add up to 100% for each day type'
);
select is(
  (select progression_kg from public.exercises where key = 'deadlift'),
  5.0,
  'big lower-body lifts progress in 5 kg steps'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.workout_sessions (user_id, workout_key, log_date)
values ('11111111-1111-1111-1111-111111111111', 'lower_a', '2026-10-06');

select is(
  (select swaps from public.workout_sessions),
  '{}'::jsonb,
  'sessions start with no swaps'
);
select throws_ok(
  $$insert into public.workout_sessions (user_id, workout_key, log_date)
    values ('11111111-1111-1111-1111-111111111111', 'lower_a', '2026-10-06')$$,
  '23505',
  null,
  'one session per member, day and workout'
);
select lives_ok(
  $$insert into public.meal_logs (user_id, log_date, name, source, template_key)
    values ('11111111-1111-1111-1111-111111111111', '2026-10-06', 'Oats', 'plan', 'high_breakfast')$$,
  'a meal log can point at its template'
);
select throws_ok(
  $$insert into public.meal_logs (user_id, log_date, name, source, template_key)
    values ('11111111-1111-1111-1111-111111111111', '2026-10-06', 'X', 'plan', 'no_such_meal')$$,
  '23503',
  null,
  'template keys must exist'
);

select * from finish();
rollback;
