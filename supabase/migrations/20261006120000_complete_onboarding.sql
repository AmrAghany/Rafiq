-- Saves the result of onboarding in one transaction: profile answers, the confirmed body
-- scan and the first plan snapshot. SECURITY INVOKER, so the caller's RLS policies and
-- column grants still apply; it only ever writes the caller's own rows.

create function public.complete_onboarding(
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

  insert into public.body_scans (
    user_id, source, weight_kg, body_fat_pct, skeletal_muscle_kg, bmr_kcal, confirmed_at
  )
  values (
    v_uid,
    coalesce(p_scan ->> 'source', 'manual')::public.scan_source,
    (p_scan ->> 'weight_kg')::numeric,
    (p_scan ->> 'body_fat_pct')::numeric,
    (p_scan ->> 'skeletal_muscle_kg')::numeric,
    (p_scan ->> 'bmr_kcal')::integer,
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

revoke execute on function public.complete_onboarding(jsonb, jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.complete_onboarding(jsonb, jsonb, jsonb, jsonb, text) to authenticated;
