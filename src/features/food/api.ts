import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export interface MealLog {
  id: string;
  name: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: 'plan' | 'text' | 'photo' | 'manual';
  template_key: string | null;
  photo_path?: string | null;
  ai_estimate?: unknown;
  eaten_at: string;
}

export type NewMeal = Omit<MealLog, 'id' | 'eaten_at'>;

export const mealLogsKey = (uid: string | undefined, date: string) =>
  ['meal_logs', uid, date] as const;

export function useMealLogs(date: string) {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: mealLogsKey(uid, date),
    enabled: !!uid,
    queryFn: async (): Promise<MealLog[]> => {
      const { data, error } = await supabase
        .from('meal_logs')
        .select('id, name, kcal, protein_g, carbs_g, fat_g, source, template_key, eaten_at')
        .eq('user_id', uid!)
        .eq('log_date', date)
        .order('eaten_at');
      if (error) throw error;
      return (data as MealLog[]) ?? [];
    },
  });
}

export function useMealActions(date: string) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const queryClient = useQueryClient();
  const key = mealLogsKey(uid, date);
  const settle = () => queryClient.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: async (meal: NewMeal) => {
      const { error } = await supabase.from('meal_logs').insert({
        ...meal,
        ai_estimate: (meal.ai_estimate ?? null) as Json,
        user_id: uid!,
        log_date: date,
      });
      if (error) throw error;
    },
    onMutate: async (meal) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MealLog[]>(key) ?? [];
      queryClient.setQueryData<MealLog[]>(key, [
        ...previous,
        { ...meal, id: `pending-${previous.length}`, eaten_at: new Date().toISOString() },
      ]);
      return { previous };
    },
    onError: (_e, _m, ctx) => queryClient.setQueryData(key, ctx?.previous),
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meal_logs').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MealLog[]>(key) ?? [];
      queryClient.setQueryData<MealLog[]>(
        key,
        previous.filter((m) => m.id !== id),
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => queryClient.setQueryData(key, ctx?.previous),
    onSettled: settle,
  });

  return { add, remove };
}
