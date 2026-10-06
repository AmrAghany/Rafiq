-- AI quota functions and photo checks in complete_onboarding. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'a@example.com');

select is(public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'scan_read', 2), 1, 'first request is counted');
select is(public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'scan_read', 2), 2, 'second request reaches the limit');
select is(public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'scan_read', 2), null, 'third request is refused');
select is(
  (select request_count from public.ai_usage where feature = 'scan_read'),
  2,
  'a refused request does not count'
);
select lives_ok(
  $$select public.refund_ai_quota('11111111-1111-1111-1111-111111111111', 'scan_read')$$,
  'a failed AI call can be refunded'
);
select is(public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'scan_read', 2), 2, 'the refunded unit can be used again');
select is(public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'coach_chat', 0), null, 'a zero limit (free tier) allows nothing');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$select public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'coach_chat', 1000)$$,
  '42501',
  null,
  'members cannot grant themselves quota'
);

select throws_ok(
  $$select public.complete_onboarding(
      jsonb_build_object('sex', 'male', 'date_of_birth', '1990-01-01', 'medical_notice_accepted_at', now()),
      jsonb_build_object('photo_path', '22222222-2222-2222-2222-222222222222/scan.jpg'),
      '{}'::jsonb, '{}'::jsonb, '1.0.0')$$,
  '42501',
  'Scan photo must be in your own folder',
  'a scan photo must be in the member''s own folder'
);

select * from finish();
rollback;
