// System prompt for the AI coach (prototype coachContext()). Pure: built only from data the
// server loaded for this member, never from anything the app sends.

/** The parts of the stored plan snapshot (src/features/plan/engine.ts Plan) the coach uses. */
export interface StoredPlan {
  bmrKcal: number;
  bodyFatPct: number;
  leanMassKg: number;
  trainingDays: 3 | 4 | 5;
  weightKg: number;
  loadFactor: number;
  schemes: { main: { sets: number; reps: number }; accessory: { sets: number; reps: number } };
  macros: Record<
    'high' | 'medium' | 'low',
    { kcal: number; proteinG: number; carbsG: number; fatG: number }
  >;
  week: { dayType: 'high' | 'medium' | 'low'; workoutKey: string | null }[];
  safety: {
    noDeficit: boolean;
    hideCalories: boolean;
    doctorNotice: boolean;
    moderateTraining: boolean;
  };
}

export interface ExerciseInfo {
  key: string;
  name_en: string;
  bodyweight_ratio: number;
  is_compound: boolean;
  is_per_hand: boolean;
  timed_seconds: number | null;
}

export interface CoachContext {
  name: string;
  sex: 'male' | 'female' | null;
  age: number | null;
  heightCm: number | null;
  goal: 'lose' | 'build' | 'recomp' | null;
  experience: 'beginner' | 'intermediate' | 'advanced' | null;
  healthFlags: string[];
  plan: StoredPlan;
  dayIndex: number;
  workoutName: string | null;
  exercises: ExerciseInfo[];
  readiness: number | null;
  eatenKcal: number;
  ramadan: boolean;
  /** "HH:MM" suhoor and iftar times, when Ramadan mode is on. */
  fastTimes?: { suhoor: string; iftar: string } | null;
  localTime: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const GOALS = { lose: 'lose fat', build: 'build muscle', recomp: 'lose fat and build muscle' };
const DAY_TYPES = { high: 'high-carb day', medium: 'medium-carb day', low: 'low-carb day' };

const plate = (kg: number) => Math.max(2.5, Math.round(kg / 2.5) * 2.5);

/** Stable rules first (cache-friendly), member data second. */
export const COACH_RULES = `You are Rafiq, a warm, expert personal trainer and nutrition coach inside a fitness app for gym members.

Rules:
- Always reply in the same language and dialect the member uses in their latest message (for example Gulf, Levantine or Egyptian Arabic, Modern Standard Arabic, English, French or Spanish).
- Be brief and practical: at most about 120 words, plain text, no markdown headings or tables.
- Base your advice on the member data you are given. When suggesting exercise swaps or meals, keep them consistent with the member's plan and local food.
- You are not a doctor. Never diagnose. For chest pain, dizziness, fainting, sharp or lasting pain, injuries, medication questions, pregnancy, or signs of an eating disorder, kindly recommend seeing a doctor or physiotherapist, and do not give training or diet advice that could make it worse.
- Never suggest eating below the member's resting energy (BMR), skipping meals for weight loss, crash or extreme diets, or supplements beyond basics like protein powder and creatine.
- If the member asks for something outside fitness, nutrition, sleep or wellbeing, say briefly that you can only help with those.`;

export function buildMemberContext(c: CoachContext): string {
  const { plan } = c;
  const day = plan.week[c.dayIndex];
  const lines: string[] = [];

  if (plan.safety.hideCalories) {
    lines.push(
      'Important: this member must not get calorie targets, calorie counts, weight-loss or dieting advice. Focus on regular, balanced meals and how they feel.',
    );
  } else {
    lines.push(`Never suggest eating below ${plan.bmrKcal} kcal a day.`);
  }
  if (plan.safety.moderateTraining) {
    lines.push(
      'Training is kept moderate because of a health condition; do not push intensity up.',
    );
  }

  const profile = [
    c.name || 'Member',
    c.sex,
    c.age != null ? `${c.age} y` : null,
    c.heightCm != null ? `${c.heightCm} cm` : null,
    `${plan.weightKg} kg`,
    `body fat ${plan.bodyFatPct}%`,
    `lean mass ${plan.leanMassKg} kg`,
    c.goal ? `goal: ${GOALS[c.goal]}` : null,
    c.experience ? `experience: ${c.experience}` : null,
    `health notes: ${c.healthFlags.length ? c.healthFlags.join(', ').replace(/_/g, ' ') : 'none'}`,
  ].filter(Boolean);
  lines.push(`Member: ${profile.join(', ')}.`);

  const program = {
    3: '3-day full body',
    4: '4-day upper/lower',
    5: '5-day push/pull/legs + upper/lower',
  }[plan.trainingDays];
  if (day.workoutKey && c.workoutName) {
    const light = c.readiness != null && c.readiness < 60;
    const items = c.exercises.map((e) => {
      const s = e.is_compound ? plan.schemes.main : plan.schemes.accessory;
      const sets = Math.max(1, s.sets - (light ? 1 : 0));
      if (e.timed_seconds) return `${e.name_en} ${sets} x ${e.timed_seconds} s`;
      if (!e.bodyweight_ratio) return `${e.name_en} ${sets} x ${s.reps}`;
      const kg = plate(plan.weightKg * e.bodyweight_ratio * plan.loadFactor * (light ? 0.9 : 1));
      return `${e.name_en} ${sets} x ${s.reps} at ${kg} kg${e.is_per_hand ? ' per hand' : ''}`;
    });
    lines.push(
      `Program: ${program}. Today (${DAYS[c.dayIndex]}): ${c.workoutName}${light ? ' (light day: low readiness)' : ''}: ${items.join('; ')}.`,
    );
  } else {
    lines.push(`Program: ${program}. Today (${DAYS[c.dayIndex]}) is a rest day.`);
  }

  if (!plan.safety.hideCalories) {
    const m = plan.macros[day.dayType];
    lines.push(
      `Carb cycle today: ${DAY_TYPES[day.dayType]}, target ${m.kcal} kcal, ${m.proteinG} g protein, ${m.carbsG} g carbs, ${m.fatG} g fat. Eaten so far: ${c.eatenKcal} kcal.`,
    );
  }
  lines.push(
    `Readiness this morning: ${c.readiness == null ? 'not checked in yet' : `${c.readiness}/100`}. Ramadan mode: ${c.ramadan ? `on (fasting${c.fastTimes ? `; suhoor ${c.fastTimes.suhoor}, iftar ${c.fastTimes.iftar}` : ''})` : 'off'}.${c.localTime ? ` Local time: ${c.localTime}.` : ''}`,
  );
  return lines.join('\n');
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Recent history for the request: oldest first, starting with a member message, so the
 * API sees a valid conversation. Consecutive same-role turns are fine (the API merges them).
 */
export function historyForRequest(recentNewestFirst: ChatTurn[], max = 20): ChatTurn[] {
  const turns = recentNewestFirst.slice(0, max).reverse();
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns;
}

/** Age in completed years from an ISO date, or null. */
export function ageFrom(dateOfBirth: string | null, today: Date): number | null {
  if (!dateOfBirth) return null;
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d))
    age--;
  return age;
}
