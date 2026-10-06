// JSON schemas for structured outputs, plus server-side checks: the model's numbers are
// treated as suggestions, so anything implausible is dropped rather than passed on.

const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] };

export const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    is_food: { type: 'boolean', description: 'False if the photo or text is not a meal or drink.' },
    name: { type: 'string', description: "Short meal name in the member's language." },
    kcal: { type: 'integer' },
    protein_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fat_g: { type: 'number' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['is_food', 'name', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence'],
  additionalProperties: false,
} as const;

export const SCAN_SCHEMA = {
  type: 'object',
  properties: {
    is_body_composition_sheet: { type: 'boolean' },
    weight_kg: nullableNumber,
    body_fat_percent: nullableNumber,
    skeletal_muscle_kg: nullableNumber,
    bmr_kcal: nullableNumber,
  },
  required: [
    'is_body_composition_sheet',
    'weight_kg',
    'body_fat_percent',
    'skeletal_muscle_kg',
    'bmr_kcal',
  ],
  additionalProperties: false,
} as const;

export interface MealEstimate {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface ScanReading {
  weight_kg: number | null;
  body_fat_percent: number | null;
  skeletal_muscle_kg: number | null;
  bmr_kcal: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Parses the model's JSON text. Returns null when it isn't food or the numbers are absurd. */
export function checkMeal(text: string): MealEstimate | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw.is_food !== true || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  if (
    !inRange(raw.kcal, 0, 5000) ||
    !inRange(raw.protein_g, 0, 400) ||
    !inRange(raw.carbs_g, 0, 800) ||
    !inRange(raw.fat_g, 0, 400)
  ) {
    return null;
  }
  const confidence = ['low', 'medium', 'high'].includes(raw.confidence as string)
    ? (raw.confidence as MealEstimate['confidence'])
    : 'low';
  return {
    name: raw.name.trim().slice(0, 120),
    kcal: Math.round(raw.kcal),
    protein_g: round1(raw.protein_g),
    carbs_g: round1(raw.carbs_g),
    fat_g: round1(raw.fat_g),
    confidence,
  };
}

/** Keeps only plausible values (same ranges the app accepts for manual entry). */
export function checkScan(text: string): ScanReading | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw.is_body_composition_sheet !== true) return null;
  const pick = (v: unknown, min: number, max: number) => (inRange(v, min, max) ? round1(v) : null);
  const reading: ScanReading = {
    weight_kg: pick(raw.weight_kg, 35, 250),
    body_fat_percent: pick(raw.body_fat_percent, 3, 60),
    skeletal_muscle_kg: pick(raw.skeletal_muscle_kg, 5, 100),
    bmr_kcal: inRange(raw.bmr_kcal, 800, 4000) ? Math.round(raw.bmr_kcal) : null,
  };
  return Object.values(reading).some((v) => v != null) ? reading : null;
}
