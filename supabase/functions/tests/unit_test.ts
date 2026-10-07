import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { mediaTypeFor, toBase64 } from '../_shared/claude.ts';
import {
  ageFrom,
  buildMemberContext,
  COACH_RULES,
  type CoachContext,
  historyForRequest,
  type StoredPlan,
} from '../_shared/coach.ts';
import { DAILY_LIMITS } from '../_shared/entitlements.ts';
import { checkMeal, checkScan } from '../_shared/schemas.ts';

// The demo member's plan as stored by the app (engine 1.0.0).
const plan: StoredPlan = {
  bmrKcal: 1810,
  bodyFatPct: 18.4,
  leanMassKg: 66.9,
  trainingDays: 4,
  weightKg: 82,
  loadFactor: 0.8,
  schemes: { main: { sets: 4, reps: 6 }, accessory: { sets: 3, reps: 10 } },
  macros: {
    high: { kcal: 2880, proteinG: 164, carbsG: 408, fatG: 66 },
    medium: { kcal: 2670, proteinG: 164, carbsG: 337, fatG: 74 },
    low: { kcal: 2190, proteinG: 164, carbsG: 172, fatG: 94 },
  },
  week: [
    { dayType: 'medium', workoutKey: 'upper_a' },
    { dayType: 'high', workoutKey: 'lower_a' },
    { dayType: 'low', workoutKey: null },
    { dayType: 'medium', workoutKey: 'upper_b' },
    { dayType: 'high', workoutKey: 'lower_b' },
    { dayType: 'low', workoutKey: null },
    { dayType: 'low', workoutKey: null },
  ],
  safety: {
    noDeficit: false,
    hideCalories: false,
    doctorNotice: false,
    moderateTraining: false,
  },
};

const ctx: CoachContext = {
  name: 'Sam',
  sex: 'male',
  age: 29,
  heightCm: 178,
  goal: 'recomp',
  experience: 'intermediate',
  healthFlags: [],
  plan,
  dayIndex: 1,
  workoutName: 'Lower body A',
  exercises: [
    {
      key: 'back_squat',
      name_en: 'Back squat',
      bodyweight_ratio: 1,
      is_compound: true,
      is_per_hand: false,
      timed_seconds: null,
    },
    {
      key: 'walking_lunge',
      name_en: 'Walking lunges (dumbbells)',
      bodyweight_ratio: 0.2,
      is_compound: false,
      is_per_hand: true,
      timed_seconds: null,
    },
    {
      key: 'plank',
      name_en: 'Plank',
      bodyweight_ratio: 0,
      is_compound: false,
      is_per_hand: false,
      timed_seconds: 45,
    },
  ],
  readiness: 80,
  eatenKcal: 1270,
  ramadan: false,
  localTime: '12:30',
};

Deno.test('coach rules cover language, brevity and safety', () => {
  assertStringIncludes(COACH_RULES, 'same language and dialect');
  assertStringIncludes(COACH_RULES, 'Never diagnose');
  assertStringIncludes(COACH_RULES, 'chest pain');
  assertStringIncludes(COACH_RULES, 'resting energy (BMR)');
});

Deno.test('member context matches the prototype data', () => {
  const text = buildMemberContext(ctx);
  assertStringIncludes(text, 'Never suggest eating below 1810 kcal');
  assertStringIncludes(
    text,
    'Member: Sam, male, 29 y, 178 cm, 82 kg, body fat 18.4%, lean mass 66.9 kg, goal: lose fat and build muscle',
  );
  assertStringIncludes(
    text,
    'Today (Tuesday): Lower body A: Back squat 4 x 6 at 65 kg; Walking lunges (dumbbells) 3 x 10 at 12.5 kg per hand; Plank 3 x 45 s.',
  );
  assertStringIncludes(
    text,
    'high-carb day, target 2880 kcal, 164 g protein, 408 g carbs, 66 g fat. Eaten so far: 1270 kcal.',
  );
  assertStringIncludes(
    text,
    'Readiness this morning: 80/100. Ramadan mode: off. Local time: 12:30.',
  );
});

Deno.test('sleep and steps from Health reach the coach', () => {
  const text = buildMemberContext({ ...ctx, sleepMinutes: 412, steps: 6240 });
  assertStringIncludes(
    text,
    'Readiness this morning: 80/100. Sleep last night: 6 h 52 min. Steps today so far: 6240.',
  );
  assert(!/Sleep last night/.test(buildMemberContext(ctx)), 'no sleep line without Health');
});

Deno.test('Ramadan mode gives the coach the suhoor and iftar times', () => {
  const text = buildMemberContext({
    ...ctx,
    ramadan: true,
    fastTimes: { suhoor: '04:10', iftar: '18:12' },
  });
  assertStringIncludes(text, 'Ramadan mode: on (fasting; suhoor 04:10, iftar 18:12).');
});

Deno.test('a light day lowers sets and loads in the context', () => {
  const text = buildMemberContext({ ...ctx, readiness: 50 });
  assertStringIncludes(text, 'Lower body A (light day: low readiness): Back squat 3 x 6 at 60 kg');
});

Deno.test('careful members get no calorie numbers in the context', () => {
  const careful = {
    ...plan,
    safety: { ...plan.safety, noDeficit: true, hideCalories: true },
  };
  const text = buildMemberContext({
    ...ctx,
    plan: careful,
    healthFlags: ['eating_disorder'],
  });
  assertStringIncludes(text, 'must not get calorie targets');
  assert(!/kcal/.test(text), 'no kcal anywhere');
  assertStringIncludes(text, 'health notes: eating disorder');
});

Deno.test('medical flags keep training moderate; rest days say so', () => {
  const moderate = {
    ...plan,
    safety: { ...plan.safety, moderateTraining: true, doctorNotice: true },
  };
  assertStringIncludes(buildMemberContext({ ...ctx, plan: moderate }), 'do not push intensity up');
  assertStringIncludes(
    buildMemberContext({
      ...ctx,
      dayIndex: 2,
      workoutName: null,
      exercises: [],
    }),
    'Today (Wednesday) is a rest day.',
  );
});

Deno.test('history starts with a member turn, oldest first, capped', () => {
  const newestFirst = [
    { role: 'assistant' as const, content: 'a3' },
    { role: 'user' as const, content: 'u3' },
    { role: 'assistant' as const, content: 'a2' },
    { role: 'user' as const, content: 'u2' },
    { role: 'assistant' as const, content: 'a1' },
  ];
  assertEquals(
    historyForRequest(newestFirst).map((t) => t.content),
    ['u2', 'a2', 'u3', 'a3'],
  );
  assertEquals(
    historyForRequest(newestFirst, 2).map((t) => t.content),
    ['u3', 'a3'],
  );
  assertEquals(historyForRequest([]), []);
});

Deno.test('age from date of birth', () => {
  assertEquals(ageFrom('1997-02-14', new Date('2026-10-06T00:00:00Z')), 29);
  assertEquals(ageFrom('2008-10-07', new Date('2026-10-06T00:00:00Z')), 17);
  assertEquals(ageFrom(null, new Date()), null);
});

Deno.test('meal estimates are checked and tidied', () => {
  assertEquals(
    checkMeal(
      JSON.stringify({
        is_food: true,
        name: ' Chicken shawarma wrap ',
        kcal: 549.6,
        protein_g: 32.04,
        carbs_g: 48,
        fat_g: 24,
        confidence: 'medium',
      }),
    ),
    {
      name: 'Chicken shawarma wrap',
      kcal: 550,
      protein_g: 32,
      carbs_g: 48,
      fat_g: 24,
      confidence: 'medium',
    },
  );
  assertEquals(
    checkMeal(
      JSON.stringify({
        is_food: false,
        name: 'Shoe',
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        confidence: 'high',
      }),
    ),
    null,
  );
  assertEquals(
    checkMeal(
      JSON.stringify({
        is_food: true,
        name: 'X',
        kcal: 90000,
        protein_g: 1,
        carbs_g: 1,
        fat_g: 1,
        confidence: 'low',
      }),
    ),
    null,
  );
  assertEquals(checkMeal('not json'), null);
});

Deno.test('scan readings keep only plausible values', () => {
  assertEquals(
    checkScan(
      JSON.stringify({
        is_body_composition_sheet: true,
        weight_kg: 82.1,
        body_fat_percent: 18.4,
        skeletal_muscle_kg: 38.2,
        bmr_kcal: 1810.4,
      }),
    ),
    {
      weight_kg: 82.1,
      body_fat_percent: 18.4,
      skeletal_muscle_kg: 38.2,
      bmr_kcal: 1810,
    },
  );
  assertEquals(
    checkScan(
      JSON.stringify({
        is_body_composition_sheet: true,
        weight_kg: 82,
        body_fat_percent: 184,
        skeletal_muscle_kg: null,
        bmr_kcal: null,
      }),
    ),
    {
      weight_kg: 82,
      body_fat_percent: null,
      skeletal_muscle_kg: null,
      bmr_kcal: null,
    },
  );
  assertEquals(
    checkScan(
      JSON.stringify({
        is_body_composition_sheet: false,
        weight_kg: 82,
        body_fat_percent: null,
        skeletal_muscle_kg: null,
        bmr_kcal: null,
      }),
    ),
    null,
  );
  assertEquals(
    checkScan(
      JSON.stringify({
        is_body_composition_sheet: true,
        weight_kg: null,
        body_fat_percent: null,
        skeletal_muscle_kg: null,
        bmr_kcal: null,
      }),
    ),
    null,
  );
});

Deno.test('image helpers', () => {
  assertEquals(mediaTypeFor('u/scan.JPG'), 'image/jpeg');
  assertEquals(mediaTypeFor('u/scan.heic'), null);
  const big = new Uint8Array(200_000).map((_, i) => i % 256);
  assertEquals(toBase64(big).length, Math.ceil(200_000 / 3) * 4);
  assertEquals(toBase64(new TextEncoder().encode('Rafiq')), 'UmFmaXE=');
});

Deno.test('free members get no AI; paid tiers have limits', () => {
  assertEquals(Object.values(DAILY_LIMITS.free), [0, 0, 0]);
  assert(DAILY_LIMITS.elite.coach_chat > DAILY_LIMITS.pro.coach_chat);
});
