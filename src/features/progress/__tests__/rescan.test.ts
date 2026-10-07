import { buildPlan, ENGINE_VERSION, type PlanInput } from '@/features/plan/engine';

import { chartGeometry, niceDomain } from '../chart';
import {
  buildRescanPayload,
  change,
  daysBetween,
  emptyRescan,
  latestScan,
  planChanges,
  rescanInput,
  rescanReminderAt,
  rescanStatus,
  seriesFor,
  validateRescan,
  type BodyScan,
} from '../rescan';

const input: PlanInput = {
  sex: 'male',
  weightKg: 82,
  goal: 'recomp',
  trainingDays: 4,
  experience: 'intermediate',
  bodyFatPct: 18.4,
  bmrKcal: 1810,
  healthFlags: ['injury'],
};

const scan = (scannedOn: string, w: number | null, bf: number | null, smm: number | null) =>
  ({
    id: scannedOn,
    scannedOn,
    source: 'manual',
    weightKg: w,
    bodyFatPct: bf,
    skeletalMuscleKg: smm,
    bmrKcal: null,
  }) satisfies BodyScan;

describe('rescanStatus', () => {
  it('is due 28 days after the last scan, with a heads-up 3 days before', () => {
    expect(rescanStatus('2026-10-01', '2026-10-07')).toEqual({
      dueOn: '2026-10-29',
      daysLeft: 22,
      state: 'ok',
    });
    expect(rescanStatus('2026-10-01', '2026-10-26').state).toBe('soon');
    expect(rescanStatus('2026-10-01', '2026-10-29').state).toBe('due');
    expect(rescanStatus('2026-10-01', '2026-11-20')).toMatchObject({ daysLeft: -22, state: 'due' });
  });

  it('counts calendar days across month ends and daylight-saving changes', () => {
    expect(daysBetween('2026-03-20', '2026-04-17')).toBe(28);
    expect(rescanStatus('2027-02-10', '2027-02-10').dueOn).toBe('2027-03-10');
  });
});

describe('rescanReminderAt', () => {
  it('fires two hours after waking on the due day, never in the past', () => {
    const now = new Date(2026, 9, 7, 12, 0);
    expect(rescanReminderAt('2026-10-29', '06:30', now)).toEqual(new Date(2026, 9, 29, 8, 30));
    expect(rescanReminderAt('2026-10-07', '06:30', now)).toBeNull();
    expect(rescanReminderAt('2026-10-07', '11:00', now)).toEqual(new Date(2026, 9, 7, 13, 0));
  });
});

describe('series', () => {
  const scans = [
    scan('2026-08-04', 86, 22.5, 36.1),
    scan('2026-09-01', 84.2, null, 36.4),
    scan('2026-10-01', 82, 19.6, 36.9),
  ];

  it('picks one metric oldest first and skips scans without it', () => {
    expect(seriesFor(scans, 'bodyFatPct')).toEqual([
      { date: '2026-08-04', value: 22.5 },
      { date: '2026-10-01', value: 19.6 },
    ]);
    expect(seriesFor(scans, 'weightKg')).toHaveLength(3);
    expect(latestScan(scans)?.scannedOn).toBe('2026-10-01');
    expect(latestScan([])).toBeNull();
  });

  it('reports the change since the first scan, rounded to 0.1', () => {
    expect(change(seriesFor(scans, 'weightKg'))).toBe(-4);
    expect(change(seriesFor(scans, 'skeletalMuscleKg'))).toBe(0.8);
    expect(change(seriesFor([scans[0]], 'weightKg'))).toBeNull();
  });
});

describe('validateRescan', () => {
  it('needs a plausible weight; the scan numbers are optional but must be plausible', () => {
    expect(validateRescan(emptyRescan)).toEqual({ weightKg: 'required' });
    expect(validateRescan({ ...emptyRescan, weightKg: '٨٠٫٥' })).toEqual({});
    expect(
      validateRescan({ ...emptyRescan, weightKg: '20', bodyFatPct: '90', bmrKcal: '1700' }),
    ).toEqual({ weightKg: 'outOfRange', bodyFatPct: 'outOfRange' });
  });
});

describe('rebuilding the plan', () => {
  const draft = {
    ...emptyRescan,
    weightKg: '79.5',
    bodyFatPct: '16.2',
    skeletalMuscleKg: '37',
    bmrKcal: '',
  };

  it('keeps goal, days, experience and health answers, and takes the new body numbers', () => {
    expect(rescanInput(input, draft)).toEqual({
      ...input,
      weightKg: 79.5,
      bodyFatPct: 16.2,
      bmrKcal: null,
    });
  });

  it('builds the record_scan arguments from the same plan the engine gives', () => {
    const { plan, args } = buildRescanPayload(input, { ...draft, photoPath: 'u1/s.jpg' });
    expect(plan).toEqual(buildPlan(rescanInput(input, draft)));
    expect(args.p_engine_version).toBe(ENGINE_VERSION);
    expect(args.p_scan).toEqual({
      source: 'photo',
      photo_path: 'u1/s.jpg',
      ai_extracted: null,
      weight_kg: 79.5,
      body_fat_pct: 16.2,
      skeletal_muscle_kg: 37,
      bmr_kcal: null,
    });
    expect(args.p_plan).toEqual(plan);
  });

  it('lists what changes, without calorie lines for careful flags', () => {
    const before = buildPlan(input);
    const after = buildPlan(rescanInput(input, draft));
    expect(planChanges(before, after).map((c) => c.key)).toEqual([
      'targetKcal',
      'proteinG',
      'bmrKcal',
      'leanMassKg',
    ]);
    const careful = { ...input, healthFlags: ['eating_disorder' as const] };
    const keys = planChanges(buildPlan(careful), buildPlan(rescanInput(careful, draft))).map(
      (c) => c.key,
    );
    expect(keys).toEqual(['leanMassKg']);
  });
});

describe('chart geometry', () => {
  it('rounds the y-axis out to whole numbers with some air', () => {
    expect(niceDomain([82, 84.2, 86])).toEqual([81, 87]);
    expect(niceDomain([19.6])).toEqual([19, 21]);
  });

  it('places points by date and joins them with segments', () => {
    const points = [
      { date: '2026-08-04', value: 86 },
      { date: '2026-09-01', value: 84 },
      { date: '2026-10-29', value: 82 },
    ];
    const g = chartGeometry(points, {
      width: 220,
      height: 120,
      padLeft: 10,
      padRight: 10,
      padY: 10,
    });
    expect(g.dots.map((d) => Math.round(d.x))).toEqual([10, 75, 210]);
    // Highest value at the top, lowest at the bottom of the padded plot.
    expect(g.dots[0].y).toBeLessThan(g.dots[2].y);
    expect(g.yMaxAt).toBe(10);
    expect(g.yMinAt).toBe(110);
    expect(g.segments).toHaveLength(2);
    const s = g.segments[0];
    expect(s.length).toBeCloseTo(Math.hypot(g.dots[1].x - 10, g.dots[1].y - g.dots[0].y));
    expect(s.angle).toBeGreaterThan(0); // going down-right on screen
  });

  it('copes with a single scan and an unmeasured box', () => {
    const one = chartGeometry([{ date: '2026-10-01', value: 80 }], {
      width: 200,
      height: 100,
      padLeft: 10,
      padRight: 10,
      padY: 10,
    });
    expect(one.dots[0].x).toBe(100);
    expect(one.segments).toEqual([]);
    expect(
      chartGeometry([], { width: 0, height: 100, padLeft: 10, padRight: 10, padY: 10 }).dots,
    ).toEqual([]);
  });
});
