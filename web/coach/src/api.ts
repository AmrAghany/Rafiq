import { supabase } from './supabase';
import type { Bundle, QueueItem, ReviewDraft } from './types';

const check = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
  return data;
};

export const isCoach = async () => check(await supabase.rpc('is_coach')) === true;

export const fetchQueue = async () =>
  (check(await supabase.rpc('coach_review_queue')) ?? []) as QueueItem[];

export const claimReview = async (id: string) => {
  check(await supabase.rpc('claim_coach_review', { p_id: id }));
};

export const releaseReview = async (id: string) => {
  check(await supabase.rpc('release_coach_review', { p_id: id }));
};

export const fetchBundle = async (id: string) =>
  check(await supabase.rpc('coach_review_bundle', { p_id: id })) as unknown as Bundle;

export const saveReview = async (id: string, draft: ReviewDraft, deliver: boolean) => {
  check(
    await supabase.rpc('save_coach_review', {
      p_id: id,
      p_summary: draft.summary,
      p_training: draft.training,
      p_nutrition: draft.nutrition,
      p_focus: draft.focus,
      p_deliver: deliver,
    }),
  );
};
