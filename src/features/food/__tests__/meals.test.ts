import { buildPlan, type DayType } from '@/features/plan/engine';

import { MEAL_TEMPLATES, mealsForDay, progress, sumMeals } from '../meals';

const plan = buildPlan({
  sex: 'male',
  weightKg: 82,
  goal: 'recomp',
  trainingDays: 4,
  experience: 'intermediate',
  bodyFatPct: 18.4,
  bmrKcal: 1810,
  healthFlags: [],
});

describe('meal templates', () => {
  it.each<DayType>(['high', 'medium', 'low'])('%s day shares add up to 100%%', (type) => {
    const total = MEAL_TEMPLATES.filter((m) => m.dayType === type).reduce((a, m) => a + m.share, 0);
    expect(total).toBeCloseTo(1);
  });

  it('has Arabic names for every meal', () => {
    for (const m of MEAL_TEMPLATES) expect(m.nameAr.trim()).not.toBe('');
  });
});

describe('mealsForDay', () => {
  it('splits the day’s targets like the prototype', () => {
    const meals = mealsForDay(plan, 'high');
    expect(meals.map((m) => m.slot)).toEqual(['breakfast', 'lunch', 'pre_workout', 'dinner']);
    // High day: 2880 kcal, 164 g protein, 408 g carbs. Breakfast is 25%.
    expect(meals[0].macros).toEqual({ kcal: 720, proteinG: 41, carbsG: 102, fatG: 17 });
  });

  it('renames meals in Ramadan', () => {
    expect(mealsForDay(plan, 'medium', true).map((m) => m.slot)).toEqual([
      'suhoor',
      'iftar',
      'snack',
      'recovery',
    ]);
  });
});

describe('sumMeals and progress', () => {
  it('adds what was eaten and treats blanks as zero', () => {
    expect(
      sumMeals([
        { kcal: 550, protein_g: 32, carbs_g: 48, fat_g: 24 },
        { kcal: 200, protein_g: 20.5, carbs_g: null, fat_g: 5 },
      ]),
    ).toEqual({ kcal: 750, proteinG: 52.5, carbsG: 48, fatG: 29 });
    expect(sumMeals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('clamps progress between 0 and 1', () => {
    expect(progress(50, 100)).toBe(0.5);
    expect(progress(150, 100)).toBe(1);
    expect(progress(10, 0)).toBe(0);
  });
});
