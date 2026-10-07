-- Phase 7: sleep and steps from Apple Health / Health Connect, Elite coach reviews and
-- smart stations.

-- ---------------------------------------------------------------------------
-- Health: the member's phone writes last night's sleep and today's steps into the day's
-- log (only when they've connected Health). Read by the app and the coach.
-- ---------------------------------------------------------------------------
alter table public.daily_logs
  add column sleep_minutes smallint check (sleep_minutes between 0 and 1440),
  add column steps integer check (steps between 0 and 200000),
  add column health_source text check (health_source in ('apple_health', 'health_connect')),
  add column health_synced_at timestamptz;

-- ---------------------------------------------------------------------------
-- Elite coach reviews.
--
-- Staff (coaches and admins) are added by an admin with the service role. Coaches work
-- in the separate web console (web/coach). Nobody reads coach_reviews directly: every
-- read and write goes through the functions below, which check who is asking. That keeps
-- a coach's draft hidden from the member until it is delivered, and gives a coach a
-- member's data only while that coach holds the member's review.
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('coach', 'admin');

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null default 'coach',
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;
create policy "Staff read own row" on public.staff
  for select to authenticated using (user_id = (select auth.uid()));

create type public.review_status as enum ('requested', 'in_review', 'delivered');

create table public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users (id) on delete cascade,
  -- First day of the month the review covers, in the member's time zone.
  period date not null check (extract(day from period) = 1),
  status public.review_status not null default 'requested',
  member_note text check (char_length(member_note) <= 1000),
  coach_id uuid references public.staff (user_id) on delete set null,
  -- Kept with the review so the member still sees who wrote it if the coach leaves.
  coach_name text,
  summary text check (char_length(summary) <= 4000),
  training text check (char_length(training) <= 4000),
  nutrition text check (char_length(nutrition) <= 4000),
  focus text check (char_length(focus) <= 4000),
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (member_id, period)
);

create index coach_reviews_queue_idx on public.coach_reviews (status, requested_at);
create index coach_reviews_coach_idx on public.coach_reviews (coach_id, status);

create trigger coach_reviews_set_updated_at
  before update on public.coach_reviews
  for each row execute function public.set_updated_at();

-- RLS on, no policies: only the functions below (and the service role) touch it.
alter table public.coach_reviews enable row level security;

create function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;

-- Member: ask for this month's review. Elite only, one per month.
create function public.request_coach_review(p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_period date;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if public.current_tier(v_uid) <> 'elite' then
    raise exception 'elite_required' using errcode = '42501';
  end if;
  select date_trunc('month', now() at time zone p.timezone)::date
    into v_period from public.profiles p where p.id = v_uid;
  insert into public.coach_reviews (member_id, period, member_note)
  values (v_uid, v_period, nullif(trim(p_note), ''))
  on conflict (member_id, period) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'already_requested' using errcode = '23505';
  end if;
  return v_id;
end;
$$;

-- Member: own reviews, newest first. A coach's text appears only once delivered.
create function public.my_coach_reviews()
returns table (
  id uuid, period date, status public.review_status, member_note text, coach_name text,
  summary text, training text, nutrition text, focus text,
  requested_at timestamptz, delivered_at timestamptz, read_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.period, r.status, r.member_note,
    case when r.status <> 'requested' then r.coach_name end,
    case when r.status = 'delivered' then r.summary end,
    case when r.status = 'delivered' then r.training end,
    case when r.status = 'delivered' then r.nutrition end,
    case when r.status = 'delivered' then r.focus end,
    r.requested_at, r.delivered_at, r.read_at
  from public.coach_reviews r
  where r.member_id = (select auth.uid())
  order by r.period desc;
$$;

create function public.mark_coach_review_read(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.coach_reviews set read_at = coalesce(read_at, now())
  where id = p_id and member_id = (select auth.uid()) and status = 'delivered';
$$;

-- Coach: open requests, the coach's own reviews in progress, and what they delivered in
-- the last 60 days. Only a first name identifies the member here.
create function public.coach_review_queue()
returns table (
  id uuid, period date, status public.review_status, member_first_name text,
  member_note text, requested_at timestamptz, claimed_at timestamptz,
  delivered_at timestamptz, is_mine boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_coach() then
    raise exception 'coach_only' using errcode = '42501';
  end if;
  return query
  select r.id, r.period, r.status, split_part(coalesce(p.display_name, ''), ' ', 1),
    r.member_note, r.requested_at, r.claimed_at, r.delivered_at,
    coalesce(r.coach_id = (select auth.uid()), false)
  from public.coach_reviews r
  join public.profiles p on p.id = r.member_id
  where r.status = 'requested'
     or (r.coach_id = (select auth.uid())
         and (r.status = 'in_review' or r.delivered_at > now() - interval '60 days'))
  order by (r.status = 'in_review') desc, r.requested_at;
end;
$$;

create function public.claim_coach_review(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_coach() then
    raise exception 'coach_only' using errcode = '42501';
  end if;
  update public.coach_reviews
  set status = 'in_review', coach_id = (select auth.uid()), claimed_at = now(),
      coach_name = (select display_name from public.staff where user_id = (select auth.uid()))
  where id = p_id and status = 'requested';
  if not found then
    raise exception 'not_available' using errcode = 'P0002';
  end if;
end;
$$;

create function public.release_coach_review(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.coach_reviews
  set status = 'requested', coach_id = null, coach_name = null, claimed_at = null
  where id = p_id and status = 'in_review' and coach_id = (select auth.uid());
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

-- Coach: everything needed to review one member's month, for a review the coach holds.
-- Chat messages are never included.
create function public.coach_review_bundle(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_review public.coach_reviews;
  v_member uuid;
  v_since date;
begin
  select * into v_review from public.coach_reviews
  where id = p_id and coach_id = (select auth.uid()) and status in ('in_review', 'delivered');
  if not found or not public.is_coach() then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  v_member := v_review.member_id;
  -- The five weeks before the request: a full month plus the week it started in.
  v_since := (v_review.requested_at - interval '35 days')::date;

  return jsonb_build_object(
    'review', jsonb_build_object(
      'id', v_review.id, 'period', v_review.period, 'status', v_review.status,
      'member_note', v_review.member_note, 'summary', v_review.summary,
      'training', v_review.training, 'nutrition', v_review.nutrition, 'focus', v_review.focus,
      'requested_at', v_review.requested_at, 'delivered_at', v_review.delivered_at),
    'profile', (
      select jsonb_build_object(
        'first_name', split_part(coalesce(display_name, ''), ' ', 1), 'sex', sex,
        'age', extract(year from age(date_of_birth))::int, 'height_cm', height_cm,
        'weight_kg', weight_kg, 'goal', goal, 'training_days', training_days,
        'experience', experience, 'health_flags', health_flags, 'ramadan_mode', ramadan_mode,
        'locale', locale)
      from public.profiles where id = v_member),
    'plan', (
      select jsonb_build_object('version', version, 'created_at', created_at, 'plan', plan)
      from public.plans where user_id = v_member and is_active),
    'scans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scanned_on', scanned_on, 'weight_kg', weight_kg, 'body_fat_pct', body_fat_pct,
        'skeletal_muscle_kg', skeletal_muscle_kg, 'bmr_kcal', bmr_kcal) order by scanned_on)
      from public.body_scans where user_id = v_member), '[]'),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', log_date, 'readiness', readiness_score, 'sleep_minutes', sleep_minutes,
        'steps', steps, 'water', water_glasses,
        'done', coalesce(array_length(completed_items, 1), 0)) order by log_date)
      from public.daily_logs where user_id = v_member and log_date >= v_since), '[]'),
    'workouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', s.log_date, 'workout_key', s.workout_key, 'completed', s.completed_at is not null,
        'sets', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'exercise_key', l.exercise_key, 'set', l.set_number,
            'weight_kg', l.actual_weight_kg, 'reps', l.actual_reps, 'target_reps', l.target_reps,
            'completed', l.completed) order by l.exercise_key, l.set_number), '[]')
          from public.set_logs l where l.session_id = s.id)) order by s.log_date)
      from public.workout_sessions s where s.user_id = v_member and s.log_date >= v_since), '[]'),
    'meals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', log_date, 'name', name, 'kcal', kcal, 'protein_g', protein_g,
        'carbs_g', carbs_g, 'fat_g', fat_g) order by log_date, eaten_at)
      from public.meal_logs where user_id = v_member and log_date >= v_since), '[]')
  );
end;
$$;

-- Coach: save a draft, or deliver it to the member.
create function public.save_coach_review(
  p_id uuid, p_summary text, p_training text, p_nutrition text, p_focus text, p_deliver boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_deliver and coalesce(trim(p_summary), '') = '' then
    raise exception 'summary_required' using errcode = '23514';
  end if;
  update public.coach_reviews
  set summary = nullif(trim(p_summary), ''), training = nullif(trim(p_training), ''),
      nutrition = nullif(trim(p_nutrition), ''), focus = nullif(trim(p_focus), ''),
      status = case when p_deliver then 'delivered'::public.review_status else status end,
      delivered_at = case when p_deliver then now() else delivered_at end
  where id = p_id and coach_id = (select auth.uid()) and status = 'in_review';
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.is_coach() from public, anon;
revoke execute on function public.request_coach_review(text) from public, anon;
revoke execute on function public.my_coach_reviews() from public, anon;
revoke execute on function public.mark_coach_review_read(uuid) from public, anon;
revoke execute on function public.coach_review_queue() from public, anon;
revoke execute on function public.claim_coach_review(uuid) from public, anon;
revoke execute on function public.release_coach_review(uuid) from public, anon;
revoke execute on function public.coach_review_bundle(uuid) from public, anon;
revoke execute on function public.save_coach_review(uuid, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.is_coach() to authenticated;
grant execute on function public.request_coach_review(text) to authenticated;
grant execute on function public.my_coach_reviews() to authenticated;
grant execute on function public.mark_coach_review_read(uuid) to authenticated;
grant execute on function public.coach_review_queue() to authenticated;
grant execute on function public.claim_coach_review(uuid) to authenticated;
grant execute on function public.release_coach_review(uuid) to authenticated;
grant execute on function public.coach_review_bundle(uuid) to authenticated;
grant execute on function public.save_coach_review(uuid, text, text, text, text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Smart stations: partner racks and benches that log barbell sets for the member using
-- them. A station shows a 6-digit code; the member types it in the app to pair for the
-- session, and the station then posts each set to the station-api Edge Function, which
-- checks the station's signature and calls the service-only functions below.
-- See docs/smart-stations.md for the partner contract.
-- ---------------------------------------------------------------------------
create table public.stations (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  label text not null check (char_length(label) between 1 and 60),
  gym_name text not null check (char_length(gym_name) between 1 and 80),
  -- Lifts this station can track (keys from public.exercises).
  exercise_keys text[] not null check (cardinality(exercise_keys) > 0),
  -- Shared HMAC secret. Readable only with the service role.
  secret text not null check (char_length(secret) >= 32),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.stations enable row level security;

create table public.station_pairings (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references public.stations (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{6}$'),
  code_expires_at timestamptz not null,
  user_id uuid references auth.users (id) on delete cascade,
  paired_at timestamptz,
  -- Pairing lasts until ended, or until 20 minutes pass without a set.
  ends_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index station_pairings_open_code on public.station_pairings (code)
  where user_id is null and ended_at is null;
create index station_pairings_active on public.station_pairings (station_id)
  where user_id is not null and ended_at is null;
alter table public.station_pairings enable row level security;

-- Sets already received, so a station retrying after a timeout never logs a set twice.
create table public.station_events (
  station_id text not null references public.stations (id) on delete cascade,
  event_id text not null check (char_length(event_id) between 1 and 100),
  set_log_id uuid references public.set_logs (id) on delete set null,
  received_at timestamptz not null default now(),
  primary key (station_id, event_id)
);
alter table public.station_events enable row level security;

alter table public.set_logs
  add column source text not null default 'app' check (source in ('app', 'station')),
  add column station_id text references public.stations (id) on delete set null;

-- Member: pair with the station showing this code.
create function public.pair_station(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pairing public.station_pairings;
  v_station public.stations;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select * into v_pairing from public.station_pairings
  where code = trim(p_code) and user_id is null and ended_at is null and code_expires_at > now()
  for update;
  if not found then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;
  select * into v_station from public.stations where id = v_pairing.station_id and active;
  if not found then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;

  -- One station at a time: pairing here ends any other pairing for this member.
  update public.station_pairings set ended_at = now()
  where user_id = v_uid and ended_at is null;
  -- And the station now belongs to this member alone.
  update public.station_pairings set ended_at = now()
  where station_id = v_station.id and user_id is not null and ended_at is null;

  update public.station_pairings
  set user_id = v_uid, paired_at = now(), ends_at = now() + interval '20 minutes'
  where id = v_pairing.id;

  return jsonb_build_object(
    'station_id', v_station.id, 'label', v_station.label, 'gym_name', v_station.gym_name,
    'exercise_keys', to_jsonb(v_station.exercise_keys),
    'ends_at', now() + interval '20 minutes');
end;
$$;

-- Member: the station they're paired with now, if any.
create function public.my_station_pairing()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'station_id', s.id, 'label', s.label, 'gym_name', s.gym_name,
    'exercise_keys', to_jsonb(s.exercise_keys), 'ends_at', p.ends_at)
  from public.station_pairings p
  join public.stations s on s.id = p.station_id
  where p.user_id = (select auth.uid()) and p.ended_at is null and p.ends_at > now()
  order by p.paired_at desc
  limit 1;
$$;

create function public.end_station_pairing()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.station_pairings set ended_at = now()
  where user_id = (select auth.uid()) and ended_at is null;
$$;

-- Service (station-api): a fresh pairing code for a station, valid for 2 minutes.
create function public.station_pairing_code(p_station_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_expires timestamptz := now() + interval '2 minutes';
begin
  -- Codes this station showed before and nobody used are retired.
  update public.station_pairings set ended_at = now()
  where station_id = p_station_id and user_id is null and ended_at is null;
  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    begin
      insert into public.station_pairings (station_id, code, code_expires_at)
      values (p_station_id, v_code, v_expires);
      exit;
    exception when unique_violation then
      -- Another station is showing the same code right now; draw again.
    end;
  end loop;
  -- Clear out expired, unused codes so they free up.
  update public.station_pairings set ended_at = now()
  where user_id is null and ended_at is null and code_expires_at < now();
  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end;
$$;

-- Service (station-api): the station is done with its member (logout button, timeout).
create function public.station_end_pairing(p_station_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.station_pairings set ended_at = now()
  where station_id = p_station_id and ended_at is null;
$$;

-- Service (station-api): log one set for the member paired with the station. Lands in
-- today's session for today's planned workout (the one the Train tab shows), or a
-- free-training session on a rest day. Idempotent per station event id.
create function public.station_log_set(
  p_station_id text,
  p_event_id text,
  p_exercise_key text,
  p_weight_kg numeric,
  p_reps integer,
  p_performed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_station public.stations;
  v_pairing public.station_pairings;
  v_seen public.station_events;
  v_date date;
  v_plan record;
  v_workout text;
  v_session uuid;
  v_set_number int;
  v_target int;
  v_set uuid;
begin
  select * into v_seen from public.station_events
  where station_id = p_station_id and event_id = p_event_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'set_log_id', v_seen.set_log_id);
  end if;

  select * into v_station from public.stations where id = p_station_id and active;
  if not found then
    raise exception 'unknown_station' using errcode = '42501';
  end if;
  if not p_exercise_key = any (v_station.exercise_keys) then
    raise exception 'exercise_not_tracked' using errcode = '22023';
  end if;
  if p_weight_kg is null or p_weight_kg < 0 or p_weight_kg > 500
     or p_reps is null or p_reps < 1 or p_reps > 100 then
    raise exception 'implausible_set' using errcode = '22023';
  end if;

  select * into v_pairing from public.station_pairings
  where station_id = p_station_id and user_id is not null and ended_at is null and ends_at > now()
  order by paired_at desc limit 1
  for update;
  if not found then
    raise exception 'not_paired' using errcode = 'P0002';
  end if;

  select (now() at time zone p.timezone)::date into v_date
  from public.profiles p where p.id = v_pairing.user_id;
  select id, plan into v_plan from public.plans
  where user_id = v_pairing.user_id and is_active;
  v_workout := coalesce(
    v_plan.plan -> 'week' -> (extract(isodow from v_date)::int - 1) ->> 'workoutKey',
    'free_training');
  select case when e.is_compound then (v_plan.plan #>> '{schemes,main,reps}')::int
              else (v_plan.plan #>> '{schemes,accessory,reps}')::int end
    into v_target
  from public.exercises e where e.key = p_exercise_key;

  insert into public.workout_sessions (user_id, log_date, workout_key, plan_id)
  values (v_pairing.user_id, v_date, v_workout, v_plan.id)
  on conflict (user_id, log_date, workout_key) do update set workout_key = excluded.workout_key
  returning id into v_session;

  select coalesce(max(set_number), 0) + 1 into v_set_number
  from public.set_logs where session_id = v_session and exercise_key = p_exercise_key;
  if v_set_number > 20 then
    raise exception 'too_many_sets' using errcode = '22023';
  end if;

  insert into public.set_logs (
    session_id, user_id, exercise_key, set_number, target_reps, actual_reps,
    actual_weight_kg, completed, completed_at, source, station_id)
  values (
    v_session, v_pairing.user_id, p_exercise_key, v_set_number, v_target, p_reps,
    round(p_weight_kg, 1), true, coalesce(p_performed_at, now()), 'station', p_station_id)
  returning id into v_set;

  insert into public.station_events (station_id, event_id, set_log_id)
  values (p_station_id, p_event_id, v_set);

  -- Keep the pairing alive while the member keeps lifting.
  update public.station_pairings set ends_at = greatest(ends_at, now() + interval '20 minutes')
  where id = v_pairing.id;

  return jsonb_build_object('status', 'logged', 'set_log_id', v_set, 'set_number', v_set_number);
end;
$$;

revoke execute on function public.pair_station(text) from public, anon;
revoke execute on function public.my_station_pairing() from public, anon;
revoke execute on function public.end_station_pairing() from public, anon;
grant execute on function public.pair_station(text) to authenticated;
grant execute on function public.my_station_pairing() to authenticated;
grant execute on function public.end_station_pairing() to authenticated;

revoke execute on function public.station_pairing_code(text) from public, anon, authenticated;
revoke execute on function public.station_end_pairing(text) from public, anon, authenticated;
revoke execute on function public.station_log_set(text, text, text, numeric, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.station_pairing_code(text) to service_role;
grant execute on function public.station_end_pairing(text) to service_role;
grant execute on function public.station_log_set(text, text, text, numeric, integer, timestamptz)
  to service_role;
