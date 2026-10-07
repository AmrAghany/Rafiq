-- Phase 6: Ramadan times on the profile, and rescans that rebuild the plan.

-- ---------------------------------------------------------------------------
-- Ramadan: the member's own suhoor and iftar times drive the fasting-day timeline.
-- The defaults reproduce the prototype's fixed Ramadan day.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column suhoor_time time not null default '03:45',
  add column iftar_time time not null default '18:05';

grant update (suhoor_time, iftar_time) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- record_scan(): saves a new body scan, updates the profile weight and switches the
-- active plan to a new version built from it. Earlier scans and plans are kept for
-- progress history. SECURITY INVOKER, so the caller's RLS policies and column grants
-- still apply; it only ever writes the caller's own rows.
-- ---------------------------------------------------------------------------
create function public.record_scan(
  p_scan jsonb,
  p_plan_inputs jsonb,
  p_plan jsonb,
  p_engine_version text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_scan_id uuid;
  v_plan_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles where id = v_uid and onboarding_completed_at is not null
  ) then
    raise exception 'Finish onboarding first' using errcode = '55000';
  end if;
  if (p_scan ->> 'weight_kg') is null then
    raise exception 'A rescan needs your weight' using errcode = '23502';
  end if;

  -- A scan photo must sit in the member's own folder of the private bucket.
  if p_scan ->> 'photo_path' is not null
     and split_part(p_scan ->> 'photo_path', '/', 1) <> v_uid::text then
    raise exception 'Scan photo must be in your own folder' using errcode = '42501';
  end if;

  update public.profiles
  set weight_kg = (p_scan ->> 'weight_kg')::numeric
  where id = v_uid;

  insert into public.body_scans (
    user_id, source, weight_kg, body_fat_pct, skeletal_muscle_kg, bmr_kcal, photo_path,
    ai_extracted, confirmed_at
  )
  values (
    v_uid,
    coalesce(p_scan ->> 'source', 'manual')::public.scan_source,
    (p_scan ->> 'weight_kg')::numeric,
    (p_scan ->> 'body_fat_pct')::numeric,
    (p_scan ->> 'skeletal_muscle_kg')::numeric,
    (p_scan ->> 'bmr_kcal')::integer,
    p_scan ->> 'photo_path',
    p_scan -> 'ai_extracted',
    now()
  )
  returning id into v_scan_id;

  update public.plans set is_active = false where user_id = v_uid and is_active;

  insert into public.plans (user_id, version, body_scan_id, engine_version, inputs, plan)
  values (
    v_uid,
    coalesce((select max(version) from public.plans where user_id = v_uid), 0) + 1,
    v_scan_id,
    p_engine_version,
    p_plan_inputs,
    p_plan
  )
  returning id into v_plan_id;

  return v_plan_id;
end;
$$;

revoke execute on function public.record_scan(jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.record_scan(jsonb, jsonb, jsonb, text) to authenticated;
