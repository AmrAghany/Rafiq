import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export type ReviewStatus = 'requested' | 'in_review' | 'delivered';

export interface CoachReview {
  id: string;
  /** YYYY-MM-01 */
  period: string;
  status: ReviewStatus;
  member_note: string | null;
  coach_name: string | null;
  summary: string | null;
  training: string | null;
  nutrition: string | null;
  focus: string | null;
  requested_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export const reviewsKey = (uid: string | undefined) => ['coach_reviews', uid] as const;

/** The member's monthly reviews, newest first. The coach's text arrives only once delivered. */
export function useMyReviews({ enabled = true }: { enabled?: boolean } = {}) {
  const uid = useAuth().session?.user.id;
  return useQuery({
    queryKey: reviewsKey(uid),
    enabled: !!uid && enabled,
    queryFn: async (): Promise<CoachReview[]> => {
      const { data, error } = await supabase.rpc('my_coach_reviews');
      if (error) throw error;
      return (data ?? []) as CoachReview[];
    },
  });
}

export type RequestError = 'elite_required' | 'already_requested' | 'failed';

export function useRequestReview() {
  const uid = useAuth().session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (note: string) => {
      const { error } = await supabase.rpc('request_coach_review', { p_note: note });
      if (error) {
        const code: RequestError =
          error.message === 'elite_required' || error.message === 'already_requested'
            ? error.message
            : 'failed';
        throw new Error(code);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: reviewsKey(uid) }),
  });
}

export function useMarkReviewRead() {
  const uid = useAuth().session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('mark_coach_review_read', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewsKey(uid) }),
  });
}

/** YYYY-MM-01 for the month containing a local date key. */
export const monthOf = (dateKey: string) => `${dateKey.slice(0, 7)}-01`;

/** "October 2026" in the app language. */
export function monthName(period: string, language: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(language, { month: 'long', year: 'numeric' });
}

/** A delivered review the member hasn't opened yet. */
export const unreadReview = (reviews: readonly CoachReview[] | undefined) =>
  reviews?.find((r) => r.status === 'delivered' && !r.read_at) ?? null;
