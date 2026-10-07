import type {
  Experience,
  Goal,
  HealthFlag,
  PlanInput,
  Sex,
  TrainingDays,
} from '@/features/plan/engine';

export const MIN_AGE = 18;
export const LIMITS = {
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 250 },
  bodyFatPct: { min: 3, max: 60 },
  skeletalMuscleKg: { min: 5, max: 100 },
  bmrKcal: { min: 800, max: 4000 },
} as const;

export interface OnboardingDraft {
  name: string;
  sex: Sex | null;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  heightCm: string;
  weightKg: string;
  goal: Goal | null;
  trainingDays: TrainingDays | null;
  experience: Experience | null;
  bodyFatPct: string;
  skeletalMuscleKg: string;
  bmrKcal: string;
  healthFlags: HealthFlag[];
  medicalNoticeAcceptedAt: string | null;
  /** Set when the scan numbers were read from a photo (kept with what the AI read). */
  scanPhotoPath: string | null;
  scanAiReading: Record<string, number | null> | null;
}

export const emptyDraft: OnboardingDraft = {
  name: '',
  sex: null,
  birthDay: '',
  birthMonth: '',
  birthYear: '',
  heightCm: '',
  weightKg: '',
  goal: null,
  trainingDays: null,
  experience: null,
  bodyFatPct: '',
  skeletalMuscleKg: '',
  bmrKcal: '',
  healthFlags: [],
  medicalNoticeAcceptedAt: null,
  scanPhotoPath: null,
  scanAiReading: null,
};

/**
 * Parses a number typed on any keyboard: Arabic-Indic (٠-٩) and Persian (۰-۹) digits,
 * and the Arabic decimal separator (٫) or a comma. Returns null for blank or invalid input.
 */
export function parseNumber(raw: string): number | null {
  const normalised = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, '.');
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
  return Number(normalised);
}

/** A real calendar date from day/month/year inputs, or null. Returned as YYYY-MM-DD. */
export function parseBirthDate(day: string, month: string, year: string): string | null {
  const d = parseNumber(day);
  const m = parseNumber(month);
  const y = parseNumber(year);
  if (d == null || m == null || y == null || !Number.isInteger(d + m + y)) return null;
  if (y < 1900 || m < 1 || m > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null; // e.g. 31 Feb
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Completed years between an ISO birth date and `today`. */
export function ageOn(isoBirthDate: string, today: Date): number {
  const [y, m, d] = isoBirthDate.split('-').map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age--;
  return age;
}

export type AboutError =
  | 'nameRequired'
  | 'sexRequired'
  | 'birthDateInvalid'
  | 'underage'
  | 'heightInvalid'
  | 'weightInvalid'
  | 'goalRequired'
  | 'daysRequired'
  | 'experienceRequired';

export type AboutErrors = Partial<
  Record<
    'name' | 'sex' | 'birthDate' | 'height' | 'weight' | 'goal' | 'days' | 'experience',
    AboutError
  >
>;

const inRange = (n: number | null, { min, max }: { min: number; max: number }) =>
  n != null && n >= min && n <= max;

export function validateAbout(draft: OnboardingDraft, today = new Date()): AboutErrors {
  const errors: AboutErrors = {};
  if (!draft.name.trim()) errors.name = 'nameRequired';
  if (!draft.sex) errors.sex = 'sexRequired';

  const dob = parseBirthDate(draft.birthDay, draft.birthMonth, draft.birthYear);
  if (!dob || dob > today.toISOString().slice(0, 10) || ageOn(dob, today) > 100) {
    errors.birthDate = 'birthDateInvalid';
  } else if (ageOn(dob, today) < MIN_AGE) {
    errors.birthDate = 'underage';
  }

  if (!inRange(parseNumber(draft.heightCm), LIMITS.heightCm)) errors.height = 'heightInvalid';
  if (!inRange(parseNumber(draft.weightKg), LIMITS.weightKg)) errors.weight = 'weightInvalid';
  if (!draft.goal) errors.goal = 'goalRequired';
  if (!draft.trainingDays) errors.days = 'daysRequired';
  if (!draft.experience) errors.experience = 'experienceRequired';
  return errors;
}

export type ScanField = 'bodyFatPct' | 'skeletalMuscleKg' | 'bmrKcal';
export type ScanErrors = Partial<Record<ScanField, 'outOfRange'>>;

/** Scan numbers are optional, but anything typed must be plausible. */
export function validateScan(draft: OnboardingDraft): ScanErrors {
  const errors: ScanErrors = {};
  for (const field of ['bodyFatPct', 'skeletalMuscleKg', 'bmrKcal'] as const) {
    if (!draft[field].trim()) continue;
    if (!inRange(parseNumber(draft[field]), LIMITS[field])) errors[field] = 'outOfRange';
  }
  return errors;
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;

/** Engine input from a validated draft. */
export function toPlanInput(draft: OnboardingDraft): PlanInput {
  if (!draft.sex || !draft.goal || !draft.trainingDays || !draft.experience) {
    throw new Error('Onboarding draft is incomplete');
  }
  return {
    sex: draft.sex,
    weightKg: parseNumber(draft.weightKg)!,
    goal: draft.goal,
    trainingDays: draft.trainingDays,
    experience: draft.experience,
    bodyFatPct: parseNumber(draft.bodyFatPct),
    bmrKcal: parseNumber(draft.bmrKcal),
    healthFlags: draft.healthFlags,
  };
}
