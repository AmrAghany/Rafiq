-- Phase 4: AI features.

-- ---------------------------------------------------------------------------
-- Daily AI quotas. Edge Functions (service role) consume one unit before calling
-- Claude and refund it if the call fails. Atomic, so parallel requests can't overshoot.
-- ---------------------------------------------------------------------------

create function public.consume_ai_quota(p_user_id uuid, p_feature public.ai_feature, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_limit <= 0 then
    return null;
  end if;
  insert into public.ai_usage as u (user_id, usage_date, feature, request_count)
  values (p_user_id, current_date, p_feature, 1)
  on conflict (user_id, usage_date, feature) do update
    set request_count = u.request_count + 1
    where u.request_count < p_limit
  returning request_count into v_count;
  return v_count; -- null when the limit is already reached
end;
$$;

create function public.refund_ai_quota(p_user_id uuid, p_feature public.ai_feature)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
  set request_count = greatest(0, request_count - 1)
  where user_id = p_user_id and usage_date = current_date and feature = p_feature;
$$;

revoke execute on function public.consume_ai_quota(uuid, public.ai_feature, integer) from public, anon, authenticated;
revoke execute on function public.refund_ai_quota(uuid, public.ai_feature) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, public.ai_feature, integer) to service_role;
grant execute on function public.refund_ai_quota(uuid, public.ai_feature) to service_role;

-- ---------------------------------------------------------------------------
-- Onboarding now keeps the scan photo and what the AI read from it, next to the
-- numbers the member confirmed.
-- ---------------------------------------------------------------------------

create or replace function public.complete_onboarding(
  p_profile jsonb,
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
  if p_profile ->> 'medical_notice_accepted_at' is null then
    raise exception 'The medical notice must be accepted' using errcode = '23514';
  end if;

  update public.profiles
  set
    display_name = nullif(trim(p_profile ->> 'display_name'), ''),
    sex = (p_profile ->> 'sex')::public.sex,
    date_of_birth = (p_profile ->> 'date_of_birth')::date,
    height_cm = (p_profile ->> 'height_cm')::numeric,
    weight_kg = (p_profile ->> 'weight_kg')::numeric,
    goal = (p_profile ->> 'goal')::public.goal,
    training_days = (p_profile ->> 'training_days')::smallint,
    experience = (p_profile ->> 'experience')::public.experience,
    health_flags = coalesce(
      array(select jsonb_array_elements_text(p_profile -> 'health_flags'))::public.health_flag[],
      '{}'
    ),
    locale = coalesce(p_profile ->> 'locale', locale),
    timezone = coalesce(p_profile ->> 'timezone', timezone),
    medical_notice_accepted_at = (p_profile ->> 'medical_notice_accepted_at')::timestamptz,
    onboarding_completed_at = now()
  where id = v_uid;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  -- A scan photo must sit in the member's own folder of the private bucket.
  if p_scan ->> 'photo_path' is not null
     and split_part(p_scan ->> 'photo_path', '/', 1) <> v_uid::text then
    raise exception 'Scan photo must be in your own folder' using errcode = '42501';
  end if;

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
