import { EXERCISES, WORKOUTS } from './engine';

/** Content has English and Arabic names; pick by UI language. */
export const localName = (item: { nameEn: string; nameAr: string }, language: string) =>
  language === 'ar' ? item.nameAr : item.nameEn;

export const workoutName = (key: string, language: string) =>
  WORKOUTS[key] ? localName(WORKOUTS[key], language) : key;

export const exerciseName = (key: string, language: string) =>
  EXERCISES[key] ? localName(EXERCISES[key], language) : key;
