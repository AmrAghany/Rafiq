-- Phase 3: daily experience (Today, Train, Food).

-- One session per member, day and workout, so the app can upsert as sets are ticked.
alter table public.workout_sessions
  add column swaps jsonb not null default '{}'::jsonb,
  add constraint workout_sessions_one_per_day unique (user_id, log_date, workout_key);

comment on column public.workout_sessions.swaps is
  'Machine-busy swaps for this session: {"<planned exercise key>": "<alternative key>"}.';

-- Meal templates are generated from src/features/plan/data/meals.json (see scripts/seed.js).
alter table public.meal_templates
  add column key text unique,
  add column share numeric(3, 2) check (share > 0 and share <= 1),
  add column ramadan_slot text;

comment on column public.meal_templates.share is
  'Share of the day''s calories and macros this meal covers. Shares per day type add up to 1.';

-- Remember which planned meal a log came from ("Log this meal").
alter table public.meal_logs
  add column template_key text references public.meal_templates (key) on delete set null;

-- Match the prototype's default training time.
alter table public.profiles alter column workout_time set default '17:30';

-- Weight step used when suggesting a heavier load (5 kg for big lower-body lifts).
alter table public.exercises
  add column progression_kg numeric(3, 1) not null default 2.5 check (progression_kg > 0);
