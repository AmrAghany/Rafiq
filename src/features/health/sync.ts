import { supabase } from '@/lib/supabase';

import type { HealthSource } from './source';
import { cleanSteps, dayStart, nightWindow, sleepMinutes } from './summary';

export interface HealthReading {
  sleepMinutes: number | null;
  steps: number | null;
}

/** Last night's sleep and today's steps so far, for a local date key. */
export async function readHealthDay(
  source: HealthSource,
  dateKey: string,
  now: Date,
): Promise<HealthReading> {
  const night = nightWindow(dateKey);
  const [intervals, steps] = await Promise.all([
    source.sleep(night.from, night.to).catch(() => []),
    source.steps(dayStart(dateKey), now).catch(() => null),
  ]);
  return { sleepMinutes: sleepMinutes(intervals, night), steps: cleanSteps(steps) };
}

/**
 * Writes the reading into the day's log. Only the health columns are sent, so the
 * member's check-in and water are never touched, and a missing value never erases one
 * read earlier.
 */
export async function saveHealthDay(
  userId: string,
  dateKey: string,
  reading: HealthReading,
  provider: HealthSource['provider'],
): Promise<boolean> {
  if (reading.sleepMinutes == null && reading.steps == null) return false;
  const { error } = await supabase.from('daily_logs').upsert(
    {
      user_id: userId,
      log_date: dateKey,
      ...(reading.sleepMinutes != null ? { sleep_minutes: reading.sleepMinutes } : {}),
      ...(reading.steps != null ? { steps: reading.steps } : {}),
      health_source: provider,
      health_synced_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,log_date' },
  );
  if (error) throw error;
  return true;
}
