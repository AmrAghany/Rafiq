-- Rafiq initial schema.
--
-- Conventions
-- * Every member-owned table has user_id -> auth.users(id) ON DELETE CASCADE, so deleting the
--   auth user deletes all of their data (account deletion).
-- * RLS is enabled on every table. Members can only touch their own rows. Policies use
--   (select auth.uid()) so Postgres evaluates it once per statement, not once per row.
-- * Tables the client must not write (subscriptions, ai_usage, content) have no write policies;
--   only Edge Functions using the service role (which bypasses RLS) write them.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.sex as enum ('male', 'female');
create type public.goal as enum ('lose', 'build', 'recomp');
create type public.experience as enum ('beginner', 'intermediate', 'advanced');
create type public.health_flag as enum (
  'injury',           -- injury or joint pain
  'heart',            -- heart or blood pressure condition
  'diabetes',
  'pregnancy',        -- pregnant or breastfeeding
  'eating_disorder'   -- past or current eating disorder
);
create type public.day_type as enum ('high', 'medium', 'low');
create type public.subscription_tier as enum ('free', 'pro', 'elite');
create type public.scan_source as enum ('manual', 'photo');
create type public.meal_source as enum ('plan', 'text', 'photo', 'manual');
create type public.chat_role as enum ('user', 'assistant');
create type public.ai_feature as enum ('coach_chat', 'meal_estimate', 'scan_read');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  sex public.sex,
  -- Date of birth rather than age so the 18+ rule stays correct over time.
  date_of_birth date,
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 30 and 300),
  goal public.goal,
  training_days smallint check (training_days in (3, 4, 5)),
  experience public.experience,
  health_flags public.health_flag[] not null default '{}',
  locale text not null default 'en' check (locale in ('en', 'ar')),
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  ramadan_mode boolean not null default false,
  wake_time time not null default '06:30',
  workout_time time not null default '18:00',
  timezone text not null default 'UTC',
  medical_notice_accepted_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per member. Created automatically when an auth user signs up.';
comment on column public.profiles.health_flags is 'Sensitive health data from the onboarding health check.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Members must be 18 or older. Enforced here as well as in the app.
create function public.enforce_adult_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.date_of_birth is not null
     and new.date_of_birth > (current_date - interval '18 years')::date then
    raise exception 'Rafiq is only available to members aged 18 or over'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_adult
  before insert or update of date_of_birth on public.profiles
  for each row execute function public.enforce_adult_member();

-- ---------------------------------------------------------------------------
-- Subscriptions (mirrored from RevenueCat webhooks; client read-only)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier public.subscription_tier not null default 'free',
  status text not null default 'none',
  product_id text,
  store text,
  is_trial boolean not null default false,
  current_period_ends_at timestamptz,
  revenuecat_app_user_id text unique,
  raw_event jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'Written only by the RevenueCat webhook Edge Function (service role). Never trust the client for tier.';

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Effective tier for Edge Functions and RLS. Lapsed paid periods fall back to free.
create function public.current_tier(p_user_id uuid)
returns public.subscription_tier
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select s.tier
      from public.subscriptions s
      where s.user_id = p_user_id
        and (s.tier = 'free' or s.current_period_ends_at is null or s.current_period_ends_at > now())
    ),
    'free'::public.subscription_tier
  );
$$;

revoke execute on function public.current_tier(uuid) from public, anon, authenticated;
grant execute on function public.current_tier(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- New-user bootstrap
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80), '')
  );
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Body scans and plans
-- ---------------------------------------------------------------------------

create table public.body_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scanned_on date not null default current_date,
  source public.scan_source not null,
  weight_kg numeric(5, 1) check (weight_kg between 30 and 300),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 3 and 70),
  skeletal_muscle_kg numeric(5, 1) check (skeletal_muscle_kg between 5 and 100),
  bmr_kcal integer check (bmr_kcal between 800 and 4000),
  -- Path inside the private scan-photos bucket: "<user id>/<file>".
  photo_path text,
  -- What the AI read from the photo, kept so we can compare it with what the member confirmed.
  ai_extracted jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create index body_scans_user_scanned_idx on public.body_scans (user_id, scanned_on desc);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version > 0),
  body_scan_id uuid references public.body_scans (id) on delete set null,
  engine_version text not null,
  inputs jsonb not null,
  plan jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, version)
);

create unique index plans_one_active_per_user on public.plans (user_id) where is_active;

-- ---------------------------------------------------------------------------
-- Daily tracking
-- ---------------------------------------------------------------------------

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  checkin jsonb,
  readiness_score smallint check (readiness_score between 40 and 100),
  water_glasses smallint not null default 0 check (water_glasses between 0 and 40),
  completed_items text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create trigger daily_logs_set_updated_at
  before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Content (editable by coaches later; read-only for members)
-- ---------------------------------------------------------------------------

create table public.exercises (
  key text primary key,
  name_en text not null,
  name_ar text not null,
  bodyweight_ratio numeric(4, 2) not null default 0,
  is_per_hand boolean not null default false,
  timed_seconds integer,
  smart_station text,
  alternative_key text references public.exercises (key),
  is_compound boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

create table public.workout_templates (
  key text primary key,
  name_en text not null,
  name_ar text not null,
  exercise_keys text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workout_templates_set_updated_at
  before update on public.workout_templates
  for each row execute function public.set_updated_at();

create table public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  day_type public.day_type not null,
  slot text not null,
  name_en text not null,
  name_ar text not null,
  description_en text,
  description_ar text,
  region text,
  kcal integer check (kcal >= 0),
  protein_g numeric(5, 1) check (protein_g >= 0),
  carbs_g numeric(5, 1) check (carbs_g >= 0),
  fat_g numeric(5, 1) check (fat_g >= 0),
  is_ramadan boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger meal_templates_set_updated_at
  before update on public.meal_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Training logs
-- ---------------------------------------------------------------------------

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  workout_key text not null,
  log_date date not null,
  readiness_score smallint check (readiness_score between 40 and 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  -- Lets set_logs reference (id, user_id) so a set can't point at someone else's session.
  unique (id, user_id)
);

create index workout_sessions_user_date_idx on public.workout_sessions (user_id, log_date desc);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_key text not null references public.exercises (key),
  swapped_from_key text references public.exercises (key),
  set_number smallint not null check (set_number between 1 and 20),
  target_reps smallint check (target_reps between 0 and 100),
  target_weight_kg numeric(5, 1) check (target_weight_kg >= 0),
  actual_reps smallint check (actual_reps between 0 and 100),
  actual_weight_kg numeric(5, 1) check (actual_weight_kg >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade,
  unique (session_id, exercise_key, set_number)
);

create index set_logs_user_exercise_idx on public.set_logs (user_id, exercise_key, created_at desc);

-- ---------------------------------------------------------------------------
-- Food and chat
-- ---------------------------------------------------------------------------

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  eaten_at timestamptz not null default now(),
  slot text,
  name text not null check (char_length(name) <= 200),
  kcal integer check (kcal between 0 and 10000),
  protein_g numeric(5, 1) check (protein_g >= 0),
  carbs_g numeric(5, 1) check (carbs_g >= 0),
  fat_g numeric(5, 1) check (fat_g >= 0),
  source public.meal_source not null,
  -- Path inside the private meal-photos bucket: "<user id>/<file>".
  photo_path text,
  ai_estimate jsonb,
  created_at timestamptz not null default now()
);

create index meal_logs_user_date_idx on public.meal_logs (user_id, log_date desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.chat_role not null,
  content text not null check (char_length(content) <= 8000),
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

create index chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);

-- Per-user daily AI usage counters for tier rate limits. Written only by Edge Functions.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default current_date,
  feature public.ai_feature not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date, feature)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.body_scans enable row level security;
alter table public.plans enable row level security;
alter table public.daily_logs enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.meal_templates enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.meal_logs enable row level security;
alter table public.chat_messages enable row level security;
alter table public.ai_usage enable row level security;

-- Profiles: read and update your own row. Rows are created by the signup trigger and
-- deleted with the auth user, so there are no insert or delete policies.
create policy "Members read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Members update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Subscriptions and AI usage: read your own; writes via service role only.
create policy "Members read own subscription" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Members read own AI usage" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- Content: readable by any signed-in member.
create policy "Members read exercises" on public.exercises
  for select to authenticated using (true);
create policy "Members read workout templates" on public.workout_templates
  for select to authenticated using (true);
create policy "Members read meal templates" on public.meal_templates
  for select to authenticated using (true);

-- Member-owned tables: full access to your own rows only.
do $$
declare
  t text;
begin
  foreach t in array array[
    'body_scans', 'plans', 'daily_logs', 'workout_sessions', 'set_logs', 'meal_logs', 'chat_messages'
  ] loop
    execute format(
      'create policy "Members manage own %1$s" on public.%1$I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end;
$$;

-- Column-level guard: members can't rewrite fields that only the server should set.
revoke update on public.profiles from authenticated;
grant update (
  display_name, sex, date_of_birth, height_cm, weight_kg, goal, training_days, experience,
  health_flags, locale, units, ramadan_mode, wake_time, workout_time, timezone,
  medical_notice_accepted_at, onboarding_completed_at
) on public.profiles to authenticated;

-- Anonymous users get nothing (no anon policies exist; revoke table grants as defence in depth).
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Storage: private buckets for scan and meal photos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('scan-photos', 'scan-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('meal-photos', 'meal-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

-- Objects must live under a folder named after the owner's user id: "<uid>/<file>".
create policy "Members read own photos" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('scan-photos', 'meal-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Members upload own photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('scan-photos', 'meal-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Members update own photos" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('scan-photos', 'meal-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('scan-photos', 'meal-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Members delete own photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('scan-photos', 'meal-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
