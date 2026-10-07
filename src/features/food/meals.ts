// Meal plan and intake maths for the Food tab (prototype food()). Pure.

import mealsData from '@/features/plan/data/meals.json';
import type { DayType, Macros, Plan } from '@/features/plan/engine';

export type MealSlot =
  'breakfast' | 'lunch' | 'pre_workout' | 'snack' | 'dinner' | 'suhoor' | 'iftar' | 'recovery';

export interface MealTemplate {
  key: string;
  dayType: DayType;
  slot: MealSlot;
  ramadanSlot: MealSlot;
  /** Share of the day's calories and macros. Shares for a day type add up to 1. */
  share: number;
  nameEn: string;
  nameAr: string;
}

export const MEAL_TEMPLATES = mealsData as MealTemplate[];

export interface PlannedMeal {
  template: MealTemplate;
  slot: MealSlot;
  macros: Macros;
}

/** The day's meals with each one's share of the day's targets. Ramadan renames the slots. */
export function mealsForDay(plan: Plan, dayType: DayType, ramadan = false): PlannedMeal[] {
  const day = plan.macros[dayType];
  return MEAL_TEMPLATES.filter((m) => m.dayType === dayType).map((template) => ({
    template,
    slot: ramadan ? template.ramadanSlot : template.slot,
    macros: {
      kcal: Math.round(day.kcal * template.share),
      proteinG: Math.round(day.proteinG * template.share),
      carbsG: Math.round(day.carbsG * template.share),
      fatG: Math.round(day.fatG * template.share),
    },
  }));
}

export interface LoggedMeal {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

/** Totals eaten so far. Missing numbers count as zero. */
export function sumMeals(meals: readonly LoggedMeal[]): Macros {
  return meals.reduce<Macros>(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal ?? 0),
      proteinG: Math.round((acc.proteinG + (m.protein_g ?? 0)) * 10) / 10,
      carbsG: Math.round((acc.carbsG + (m.carbs_g ?? 0)) * 10) / 10,
      fatG: Math.round((acc.fatG + (m.fat_g ?? 0)) * 10) / 10,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Progress bar fill from 0 to 1. */
export const progress = (eaten: number, target: number) =>
  target > 0 ? Math.min(1, Math.max(0, eaten / target)) : 0;
