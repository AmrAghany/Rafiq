// The shape of public.coach_review_bundle(). Plan is the app's stored plan snapshot.

export type ReviewStatus = 'requested' | 'in_review' | 'delivered';

export interface QueueItem {
  id: string;
  period: string;
  status: ReviewStatus;
  member_first_name: string;
  member_note: string | null;
  requested_at: string;
  claimed_at: string | null;
  delivered_at: string | null;
  is_mine: boolean;
}

export interface ReviewDraft {
  summary: string;
  training: string;
  nutrition: string;
  focus: string;
}

export interface Bundle {
  review: {
    id: string;
    period: string;
    status: ReviewStatus;
    member_note: string | null;
    summary: string | null;
    training: string | null;
    nutrition: string | null;
    focus: string | null;
    requested_at: string;
    delivered_at: string | null;
  };
  profile: {
    first_name: string;
    sex: 'male' | 'female' | null;
    age: number | null;
    height_cm: number | null;
    weight_kg: number | null;
    goal: 'lose' | 'build' | 'recomp' | null;
    training_days: number | null;
    experience: string | null;
    health_flags: string[];
    ramadan_mode: boolean;
    locale: string | null;
  };
  plan: {
    version: number;
    created_at: string;
    plan: {
      targetKcal: number;
      proteinG: number;
      bmrKcal: number;
      trainingDays: number;
      safety: { hideCalories: boolean; doctorNotice: boolean };
      week: { workoutKey: string | null; dayType: 'high' | 'medium' | 'low' }[];
    };
  } | null;
  scans: {
    scanned_on: string;
    weight_kg: number | null;
    body_fat_pct: number | null;
    skeletal_muscle_kg: number | null;
    bmr_kcal: number | null;
  }[];
  days: {
    date: string;
    readiness: number | null;
    sleep_minutes: number | null;
    steps: number | null;
    water: number;
    done: number;
  }[];
  workouts: {
    date: string;
    workout_key: string;
    completed: boolean;
    sets: {
      exercise_key: string;
      set: number;
      weight_kg: number | null;
      reps: number | null;
      target_reps: number | null;
      completed: boolean;
    }[];
  }[];
  meals: {
    date: string;
    name: string;
    kcal: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  }[];
}
