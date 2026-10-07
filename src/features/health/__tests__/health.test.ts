import * as HealthKit from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';
import * as HealthConnect from 'react-native-health-connect';

import { healthSource, type HealthSource } from '../source';
import {
  cleanSteps,
  dayStart,
  hoursAndMinutes,
  nightWindow,
  shouldSync,
  sleepAnswer,
  sleepMinutes,
  STEPS_REFRESH_MS,
} from '../summary';
import { readHealthDay, saveHealthDay } from '../sync';

const mockUpsert = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ upsert: (...a: unknown[]) => mockUpsert(...a) }) },
}));

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

describe('sleep summary', () => {
  const night = nightWindow('2026-10-07');

  it('counts last night from 18:00 the evening before to 14:00', () => {
    expect(night).toEqual({ from: at(6, 18), to: at(7, 14) });
    expect(dayStart('2026-10-07')).toEqual(at(7, 0));
  });

  it('merges overlapping sources and clips to the night', () => {
    const minutes = sleepMinutes(
      [
        { start: at(6, 23), end: at(7, 3) }, // watch
        { start: at(7, 2), end: at(7, 6, 30) }, // overlaps
        { start: at(7, 13, 30), end: at(7, 15) }, // nap, clipped at 14:00
        { start: at(5, 23), end: at(6, 7) }, // the night before: outside
      ],
      night,
    );
    expect(minutes).toBe(7 * 60 + 30 + 30);
  });

  it('is null when nothing was recorded', () => {
    expect(sleepMinutes([], night)).toBeNull();
  });

  it('suggests the check-in answer: 7 h great, 5½ h OK, less badly', () => {
    expect(sleepAnswer(420)).toBe(3);
    expect(sleepAnswer(419)).toBe(2);
    expect(sleepAnswer(330)).toBe(2);
    expect(sleepAnswer(329)).toBe(1);
    expect(hoursAndMinutes(412)).toEqual({ h: 6, m: 52 });
  });

  it('cleans step counts and throttles syncs', () => {
    expect(cleanSteps(6240.4)).toBe(6240);
    expect(cleanSteps(-1)).toBeNull();
    expect(cleanSteps(undefined)).toBeNull();
    expect(cleanSteps(999_999)).toBe(200_000);
    expect(shouldSync(null, 0)).toBe(true);
    expect(shouldSync(0, STEPS_REFRESH_MS - 1)).toBe(false);
    expect(shouldSync(0, STEPS_REFRESH_MS)).toBe(true);
  });
});

describe('reading and saving a day', () => {
  const fake = (over: Partial<HealthSource> = {}): HealthSource => ({
    provider: 'apple_health',
    unavailable: async () => null,
    requestAccess: async () => true,
    sleep: async () => [{ start: at(6, 23), end: at(7, 6, 40) }],
    steps: async () => 5321,
    ...over,
  });

  beforeEach(() => mockUpsert.mockReset().mockResolvedValue({ error: null }));

  it('reads last night and today so far', async () => {
    const steps = jest.fn(async () => 5321);
    const reading = await readHealthDay(fake({ steps }), '2026-10-07', at(7, 12));
    expect(reading).toEqual({ sleepMinutes: 460, steps: 5321 });
    expect(steps).toHaveBeenCalledWith(at(7, 0), at(7, 12));
  });

  it('keeps going when one read fails', async () => {
    const reading = await readHealthDay(
      fake({ sleep: () => Promise.reject(new Error('denied')) }),
      '2026-10-07',
      at(7, 12),
    );
    expect(reading).toEqual({ sleepMinutes: null, steps: 5321 });
  });

  it('writes only the health columns and never erases a value with null', async () => {
    await saveHealthDay('u1', '2026-10-07', { sleepMinutes: null, steps: 800 }, 'health_connect');
    const [row, opts] = mockUpsert.mock.calls[0];
    expect(row).toEqual({
      user_id: 'u1',
      log_date: '2026-10-07',
      steps: 800,
      health_source: 'health_connect',
      health_synced_at: expect.any(String),
    });
    expect(opts).toEqual({ onConflict: 'user_id,log_date' });
    expect(
      await saveHealthDay('u1', '2026-10-07', { sleepMinutes: null, steps: null }, 'apple_health'),
    ).toBe(false);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

describe('native sources', () => {
  const setOS = (os: 'ios' | 'android') =>
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  afterEach(() => setOS('ios'));

  it('Apple Health: asks to read sleep and steps only, and keeps asleep stages', async () => {
    setOS('ios');
    const source = healthSource()!;
    expect(source.provider).toBe('apple_health');
    await source.requestAccess();
    expect(HealthKit.requestAuthorization).toHaveBeenCalledWith({
      toRead: ['HKCategoryTypeIdentifierSleepAnalysis', 'HKQuantityTypeIdentifierStepCount'],
    });
    jest.mocked(HealthKit.queryCategorySamples).mockResolvedValueOnce([
      { value: 0, startDate: at(6, 22), endDate: at(7, 7) }, // in bed
      { value: 3, startDate: at(6, 23), endDate: at(7, 2) }, // core
      { value: 2, startDate: at(7, 2), endDate: at(7, 2, 10) }, // awake
      { value: 5, startDate: at(7, 2, 10), endDate: at(7, 6) }, // REM
    ] as never);
    const intervals = await source.sleep(at(6, 18), at(7, 14));
    expect(intervals).toEqual([
      { start: at(6, 23), end: at(7, 2) },
      { start: at(7, 2, 10), end: at(7, 6) },
    ]);
    jest.mocked(HealthKit.queryStatisticsForQuantity).mockResolvedValueOnce({
      sumQuantity: { unit: 'count', quantity: 4200 },
      sources: [],
    } as never);
    expect(await source.steps(at(7, 0), at(7, 12))).toBe(4200);
  });

  it('Health Connect: reports a missing app and reads stages or whole sessions', async () => {
    setOS('android');
    const source = healthSource()!;
    expect(source.provider).toBe('health_connect');
    jest.mocked(HealthConnect.getSdkStatus).mockResolvedValueOnce(1);
    expect(await source.unavailable()).toBe('not_installed');
    jest.mocked(HealthConnect.getSdkStatus).mockResolvedValueOnce(2);
    expect(await source.unavailable()).toBe('update_required');
    expect(await source.unavailable()).toBeNull();

    jest.mocked(HealthConnect.readRecords).mockResolvedValueOnce({
      records: [
        {
          startTime: at(6, 23).toISOString(),
          endTime: at(7, 6).toISOString(),
          stages: [
            { stage: 4, startTime: at(6, 23).toISOString(), endTime: at(7, 1).toISOString() },
            { stage: 1, startTime: at(7, 1).toISOString(), endTime: at(7, 1, 20).toISOString() },
            { stage: 6, startTime: at(7, 1, 20).toISOString(), endTime: at(7, 6).toISOString() },
          ],
        },
        { startTime: at(7, 13).toISOString(), endTime: at(7, 13, 30).toISOString() },
      ],
    } as never);
    const intervals = await source.sleep(at(6, 18), at(7, 14));
    expect(sleepMinutes(intervals, { from: at(6, 18), to: at(7, 14) })).toBe(120 + 280 + 30);

    jest
      .mocked(HealthConnect.aggregateRecord)
      .mockResolvedValueOnce({ COUNT_TOTAL: 9100 } as never);
    expect(await source.steps(at(7, 0), at(7, 12))).toBe(9100);
  });
});
