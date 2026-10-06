import { buildPlan, ENGINE_VERSION } from '@/features/plan/engine';
import type { Json } from '@/lib/database.types';

import { parseBirthDate, parseNumber, toPlanInput, type OnboardingDraft } from './validation';

/** Arguments for public.complete_onboarding(), built from a validated draft. Pure, no I/O. */
export function buildOnboardingPayload(
  draft: OnboardingDraft,
  opts: { locale: string; timezone: string },
) {
  const input = toPlanInput(draft);
  const plan = buildPlan(input);
  return {
    p_profile: {
      display_name: draft.name.trim(),
      sex: draft.sex,
      date_of_birth: parseBirthDate(draft.birthDay, draft.birthMonth, draft.birthYear),
      height_cm: parseNumber(draft.heightCm),
      weight_kg: input.weightKg,
      goal: draft.goal,
      training_days: draft.trainingDays,
      experience: draft.experience,
      health_flags: draft.healthFlags,
      locale: opts.locale,
      timezone: opts.timezone,
      medical_notice_accepted_at: draft.medicalNoticeAcceptedAt,
    },
    p_scan: {
      source: 'manual',
      weight_kg: input.weightKg,
      body_fat_pct: parseNumber(draft.bodyFatPct),
      skeletal_muscle_kg: parseNumber(draft.skeletalMuscleKg),
      bmr_kcal: parseNumber(draft.bmrKcal),
    },
    p_plan_inputs: input as unknown as Json,
    p_plan: plan as unknown as Json,
    p_engine_version: ENGINE_VERSION,
  };
}
