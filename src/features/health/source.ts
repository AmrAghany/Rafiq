// Native side of Health: Apple Health (HealthKit) on iOS, Health Connect on Android.
// Read-only: Rafiq reads sleep and steps and never writes to either store.

import {
  CategoryValueSleepAnalysis,
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';
import {
  aggregateRecord,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  SleepStageType,
} from 'react-native-health-connect';

import type { SleepInterval } from './summary';

export type HealthProvider = 'apple_health' | 'health_connect';

/** Why Health can't be used on this phone, if it can't. */
export type HealthUnavailable = 'unsupported' | 'not_installed' | 'update_required';

export interface HealthSource {
  provider: HealthProvider;
  /** Null when Health can be used, otherwise the reason it can't. */
  unavailable(): Promise<HealthUnavailable | null>;
  /**
   * Shows the system permission sheet. Apple never tells apps whether read access was
   * granted, so on iOS this only reports that the sheet was shown.
   */
  requestAccess(): Promise<boolean>;
  sleep(from: Date, to: Date): Promise<SleepInterval[]>;
  steps(from: Date, to: Date): Promise<number | null>;
}

// ---------------------------------------------------------------------------
// Apple Health
// ---------------------------------------------------------------------------

const HK_SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const HK_STEPS = 'HKQuantityTypeIdentifierStepCount' as const;
const HK_ASLEEP: ReadonlySet<number> = new Set([
  CategoryValueSleepAnalysis.asleepUnspecified,
  CategoryValueSleepAnalysis.asleepCore,
  CategoryValueSleepAnalysis.asleepDeep,
  CategoryValueSleepAnalysis.asleepREM,
]);

const appleHealth: HealthSource = {
  provider: 'apple_health',
  async unavailable() {
    return (await isHealthDataAvailableAsync()) ? null : 'unsupported';
  },
  async requestAccess() {
    return requestAuthorization({ toRead: [HK_SLEEP, HK_STEPS] });
  },
  async sleep(from, to) {
    const samples = await queryCategorySamples(HK_SLEEP, {
      limit: -1,
      filter: { date: { startDate: from, endDate: to } },
    });
    return samples
      .filter((s) => HK_ASLEEP.has(s.value as number))
      .map((s) => ({ start: new Date(s.startDate), end: new Date(s.endDate) }));
  },
  async steps(from, to) {
    const res = await queryStatisticsForQuantity(HK_STEPS, ['cumulativeSum'], {
      filter: { date: { startDate: from, endDate: to } },
      unit: 'count',
    });
    return res.sumQuantity?.quantity ?? null;
  },
};

// ---------------------------------------------------------------------------
// Health Connect
// ---------------------------------------------------------------------------

const HC_ASLEEP: ReadonlySet<number> = new Set([
  SleepStageType.SLEEPING,
  SleepStageType.LIGHT,
  SleepStageType.DEEP,
  SleepStageType.REM,
]);

const range = (from: Date, to: Date) => ({
  operator: 'between' as const,
  startTime: from.toISOString(),
  endTime: to.toISOString(),
});

const healthConnect: HealthSource = {
  provider: 'health_connect',
  async unavailable() {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'not_installed';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'update_required';
    }
    return (await initialize()) ? null : 'not_installed';
  },
  async requestAccess() {
    await initialize();
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'Steps' },
    ]);
    return granted.length > 0;
  },
  async sleep(from, to) {
    await initialize();
    const { records } = await readRecords('SleepSession', { timeRangeFilter: range(from, to) });
    return records.flatMap((r) => {
      // Sessions without stages count as asleep from start to end.
      if (!r.stages?.length) return [{ start: new Date(r.startTime), end: new Date(r.endTime) }];
      return r.stages
        .filter((s) => HC_ASLEEP.has(s.stage))
        .map((s) => ({ start: new Date(s.startTime), end: new Date(s.endTime) }));
    });
  },
  async steps(from, to) {
    await initialize();
    const res = await aggregateRecord({ recordType: 'Steps', timeRangeFilter: range(from, to) });
    return res.COUNT_TOTAL ?? null;
  },
};

/** The health store for this phone, or null on a platform without one. */
export function healthSource(): HealthSource | null {
  if (Platform.OS === 'ios') return appleHealth;
  if (Platform.OS === 'android') return healthConnect;
  return null;
}
