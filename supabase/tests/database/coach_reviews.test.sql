-- Elite coach reviews: who can request, see, claim, read and write. Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'elite@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'pro@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'coach-a@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'coach-b@example.com');

update public.profiles set display_name = 'Layla Haddad', timezone = 'Asia/Riyadh'
where id = '11111111-1111-1111-1111-111111111111';
update public.subscriptions set tier = 'elite', status = 'active', current_period_ends_at = now() + interval '20 days'
where user_id = '11111111-1111-1111-1111-111111111111';
update public.subscriptions set tier = 'pro', status = 'active', current_period_ends_at = now() + interval '20 days'
where user_id = '22222222-2222-2222-2222-222222222222';
insert into public.staff (user_id, display_name) values
  ('33333333-3333-3333-3333-333333333333', 'Coach Omar'),
  ('44444444-4444-4444-4444-444444444444', 'Coach Sara');
insert into public.body_scans (user_id, source, weight_kg, body_fat_pct)
values ('11111111-1111-1111-1111-111111111111', 'manual', 64, 27);
insert into public.chat_messages (user_id, role, content)
values ('11111111-1111-1111-1111-111111111111', 'user', 'private question');

set local role authenticated;

-- Pro member: not Elite.
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select throws_ok($$select public.request_coach_review('hi')$$, '42501', 'elite_required',
  'only Elite members can request a review');
select throws_ok($$select * from public.coach_review_queue()$$, '42501', 'coach_only',
  'members cannot see the coach queue');
select throws_ok($$select public.claim_coach_review(gen_random_uuid())$$, '42501', 'coach_only',
  'members cannot claim reviews');
select throws_ok($$insert into public.staff (user_id, display_name) values (auth.uid(), 'Me')$$,
  '42501', null, 'members cannot make themselves coaches');

-- Elite member requests this month's review.
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok($$select public.request_coach_review('  My squat feels stuck  ')$$,
  'an Elite member can request a review');
select throws_ok($$select public.request_coach_review(null)$$, '23505', 'already_requested',
  'one review per month');
select results_eq(
  $$select status::text, member_note, coach_name, summary, extract(day from period)::int from public.my_coach_reviews()$$,
  $$values ('requested', 'My squat feels stuck', null::text, null::text, 1)$$,
  'the member sees the request, for this month');
select is((select count(*)::int from public.coach_reviews), 0,
  'the table itself is not readable by members');

create temporary table ids on commit drop as select id from public.my_coach_reviews();
grant select on ids to authenticated;

-- Coach A: queue, then claim.
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select results_eq(
  $$select member_first_name, status::text, is_mine from public.coach_review_queue()$$,
  $$values ('Layla', 'requested', false)$$,
  'the queue shows open requests with the member''s first name only');
select throws_ok($$select public.coach_review_bundle((select id from ids))$$, '42501', 'not_yours',
  'no member data before claiming');
select lives_ok($$select public.claim_coach_review((select id from ids))$$, 'a coach claims a request');
select ok(
  (select b -> 'profile' ->> 'first_name' = 'Layla'
      and jsonb_array_length(b -> 'scans') = 1
      and b ->> 'chat' is null
      and b -> 'profile' ->> 'health_flags' is not null
   from (select public.coach_review_bundle((select id from ids)) as b) x),
  'the claiming coach gets the member''s profile, flags and scans, never the chat');

-- Coach B can't take or touch it.
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
select throws_ok($$select public.claim_coach_review((select id from ids))$$, 'P0002', 'not_available',
  'a claimed review cannot be claimed again');
select throws_ok($$select public.coach_review_bundle((select id from ids))$$, '42501', 'not_yours',
  'another coach cannot read the member''s data');
select throws_ok($$select public.save_coach_review((select id from ids), 'x', null, null, null, true)$$,
  '42501', 'not_yours', 'another coach cannot write the review');
select is((select count(*)::int from public.coach_review_queue()), 0,
  'another coach no longer sees it in the queue');

-- Coach A drafts, then delivers.
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select lives_ok($$select public.save_coach_review((select id from ids), 'Draft summary', 'Squat: pause reps', null, null, false)$$,
  'the coach saves a draft');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select status::text, coach_name, summary, training from public.my_coach_reviews()$$,
  $$values ('in_review', 'Coach Omar', null::text, null::text)$$,
  'the member sees who is reviewing, but not the draft');

set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select throws_ok($$select public.save_coach_review((select id from ids), '  ', null, null, null, true)$$,
  '23514', 'summary_required', 'a review needs a summary to be delivered');
select lives_ok($$select public.save_coach_review((select id from ids), 'Strong month, Layla.', 'Pause squats', 'More protein at lunch', 'Sleep 7 h', true)$$,
  'the coach delivers the review');
select throws_ok($$select public.save_coach_review((select id from ids), 'changed', null, null, null, false)$$,
  '42501', 'not_yours', 'a delivered review cannot be edited');

set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select results_eq(
  $$select status::text, summary, training, nutrition, focus, read_at is null from public.my_coach_reviews()$$,
  $$values ('delivered', 'Strong month, Layla.', 'Pause squats', 'More protein at lunch', 'Sleep 7 h', true)$$,
  'the member reads the delivered review');

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.mark_coach_review_read((select id from ids));
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select read_at from public.my_coach_reviews()), null, 'other members cannot mark it read');
select public.mark_coach_review_read((select id from ids));
select isnt((select read_at from public.my_coach_reviews()), null, 'the member marks it read');

select * from finish();
rollback;
