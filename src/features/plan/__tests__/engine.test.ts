import {
  buildPlan,
  EXERCISES,
  isLightDay,
  prescribe,
  prescribeWorkout,
  readinessScore,
  roundToPlate,
  SPLITS,
  WORKOUTS,
  weekdayIndex,
  type Checkin,
  type CheckinAnswer,
  type Experience,
  type Goal,
  type HealthFlag,
  type PlanInput,
  type Sex,
  type TrainingDays,
} from '../engine';

// The prototype's demo member.
const sam: PlanInput = {
  sex: 'male',
  weightKg: 82,
  goal: 'recomp',
  trainingDays: 4,
  experience: 'intermediate',
  bodyFatPct: 18.4,
  bmrKcal: 1810,
  healthFlags: [],
};

describe('buildPlan: energy and macros (hand-checked for the demo member)', () => {
  const plan = buildPlan(sam);

  it('uses the scan BMR and the 4-day activity factor', () => {
    expect(plan.bmrKcal).toBe(1810);
    expect(plan.bmrSource).toBe('scan');
    expect(plan.tdeeKcal).toBe(2806); // 1810 × 1.55 = 2805.5
  });

  it('applies the recomp goal factor and rounds to 10', () => {
    expect(plan.targetKcal).toBe(2670); // 2806 × 0.95 = 2665.7
  });

  it('sets protein at 2 g per kg bodyweight when body fat is 30% or less', () => {
    expect(plan.proteinG).toBe(164);
    expect(plan.leanMassKg).toBe(66.9);
  });

  it('builds high, medium and low carb days', () => {
    expect(plan.macros.high).toEqual({ kcal: 2880, proteinG: 164, carbsG: 408, fatG: 66 });
    expect(plan.macros.medium).toEqual({ kcal: 2670, proteinG: 164, carbsG: 337, fatG: 74 });
    expect(plan.macros.low).toEqual({ kcal: 2190, proteinG: 164, carbsG: 172, fatG: 94 });
  });

  it('maps the 4-day upper/lower split onto the week', () => {
    expect(plan.week.map((d) => `${d.workoutKey ?? 'rest'}:${d.dayType[0]}`)).toEqual([
      'upper_a:m',
      'lower_a:h',
      'rest:l',
      'upper_b:m',
      'lower_b:h',
      'rest:l',
      'rest:l',
    ]);
  });
});

describe('buildPlan: formula branches', () => {
  it('falls back to Katch-McArdle when the scan has no BMR', () => {
    const plan = buildPlan({ ...sam, bmrKcal: null });
    expect(plan.bmrSource).toBe('katch_mcardle');
    expect(plan.bmrKcal).toBe(Math.round(370 + 21.6 * 82 * (1 - 0.184))); // 1815
  });

  it('assumes 20% body fat for men and 28% for women when the scan has none', () => {
    expect(buildPlan({ ...sam, bodyFatPct: null })).toMatchObject({
      bodyFatPct: 20,
      bodyFatAssumed: true,
    });
    expect(buildPlan({ ...sam, sex: 'female', bodyFatPct: undefined })).toMatchObject({
      bodyFatPct: 28,
      bodyFatAssumed: true,
    });
  });

  it('switches protein to 2.4 g per kg lean mass above 30% body fat', () => {
    const plan = buildPlan({ ...sam, weightKg: 110, bodyFatPct: 35 });
    expect(plan.proteinG).toBe(Math.round(110 * 0.65 * 2.4)); // 172, not 220
    expect(buildPlan({ ...sam, bodyFatPct: 30 }).proteinG).toBe(164); // exactly 30% stays bodyweight-based
  });

  it.each<[TrainingDays, number]>([
    [3, 1.45],
    [4, 1.55],
    [5, 1.65],
  ])('uses activity factor for %i days', (days, factor) => {
    expect(buildPlan({ ...sam, trainingDays: days }).tdeeKcal).toBe(Math.round(1810 * factor));
  });

  it.each<[Goal, number]>([
    ['lose', 0.8],
    ['build', 1.1],
    ['recomp', 0.95],
  ])('uses goal factor for %s', (goal, factor) => {
    const plan = buildPlan({ ...sam, goal });
    expect(plan.targetKcal).toBe(Math.round((plan.tdeeKcal * factor) / 10) * 10);
  });

  it('never drops carbs below 50 g', () => {
    // Small target, heavy bodyweight: protein and fat alone exceed the low-day calories.
    const plan = buildPlan({
      ...sam,
      weightKg: 140,
      bodyFatPct: 25,
      bmrKcal: 1300,
      trainingDays: 3,
      goal: 'lose',
    });
    expect(plan.macros.low.carbsG).toBe(50);
  });

  it('keeps every macro a non-negative integer across all inputs', () => {
    for (const input of allInputs()) {
      const plan = buildPlan(input);
      for (const m of Object.values(plan.macros)) {
        for (const v of Object.values(m)) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
        expect(m.kcal % 10).toBe(0);
        expect(m.carbsG).toBeGreaterThanOrEqual(50);
      }
      expect(plan.week).toHaveLength(7);
      expect(plan.week.filter((d) => d.workoutKey).length).toBe(input.trainingDays);
    }
  });
});

describe('buildPlan: safety overrides', () => {
  it.each<HealthFlag>(['eating_disorder', 'pregnancy'])(
    '%s removes the deficit and hides calories',
    (flag) => {
      const plan = buildPlan({ ...sam, goal: 'lose', healthFlags: [flag] });
      expect(plan.targetKcal).toBe(Math.round(plan.tdeeKcal / 10) * 10);
      expect(plan.safety).toMatchObject({ noDeficit: true, hideCalories: true });
    },
  );

  it('keeps the build surplus for careful flags (no deficit, not no surplus)', () => {
    // Prototype behaviour: careful flags use a factor of 1 for every goal.
    const plan = buildPlan({ ...sam, goal: 'build', healthFlags: ['pregnancy'] });
    expect(plan.targetKcal).toBe(Math.round(plan.tdeeKcal / 10) * 10);
  });

  it.each<HealthFlag>(['heart', 'diabetes', 'injury'])(
    '%s shows a doctor notice and keeps training moderate',
    (flag) => {
      const normal = buildPlan(sam);
      const plan = buildPlan({ ...sam, healthFlags: [flag] });
      expect(plan.safety).toEqual({
        noDeficit: false,
        hideCalories: false,
        doctorNotice: true,
        moderateTraining: true,
      });
      expect(plan.loadFactor).toBeCloseTo(normal.loadFactor * 0.9);
      expect(plan.schemes.main.reps).toBe(8); // recomp's heavy sets of 6 become 8
      expect(plan.targetKcal).toBe(normal.targetKcal); // nutrition unchanged
    },
  );

  it('has no safety changes without flags', () => {
    expect(buildPlan(sam).safety).toEqual({
      noDeficit: false,
      hideCalories: false,
      doctorNotice: false,
      moderateTraining: false,
    });
  });
});

describe('prescribe', () => {
  const plan = buildPlan(sam); // load factor 0.8 × 1.0

  it('computes starting weights from bodyweight × ratio × factors, rounded to 2.5 kg', () => {
    expect(prescribe(plan, 'back_squat')).toMatchObject({ sets: 4, reps: 6, loadKg: 65 }); // 65.6
    expect(prescribe(plan, 'bench_press')).toMatchObject({ sets: 4, reps: 6, loadKg: 50 }); // 49.2
    expect(prescribe(plan, 'lateral_raise')).toMatchObject({ sets: 3, reps: 10, loadKg: 5 }); // 5.2
  });

  it('gives timed holds seconds instead of reps and weight', () => {
    expect(prescribe(plan, 'plank')).toMatchObject({
      sets: 3,
      reps: null,
      seconds: 45,
      loadKg: null,
    });
  });

  it('makes a light day one set fewer and 10% lighter', () => {
    expect(prescribe(plan, 'back_squat', true)).toMatchObject({ sets: 3, reps: 6, loadKg: 60 }); // 59.04
  });

  it('never prescribes less than 2.5 kg', () => {
    const tiny = buildPlan({ ...sam, weightKg: 40, experience: 'beginner', goal: 'lose' });
    expect(prescribe(tiny, 'lateral_raise').loadKg).toBe(2.5);
  });

  it('uses goal rep schemes', () => {
    expect(buildPlan({ ...sam, goal: 'lose' }).schemes).toEqual({
      main: { sets: 3, reps: 10 },
      accessory: { sets: 3, reps: 15 },
    });
    expect(buildPlan({ ...sam, goal: 'build' }).schemes).toEqual({
      main: { sets: 4, reps: 8 },
      accessory: { sets: 3, reps: 12 },
    });
  });

  it('throws on unknown keys', () => {
    expect(() => prescribe(plan, 'nope')).toThrow('Unknown exercise');
    expect(() => prescribeWorkout(plan, 'nope')).toThrow('Unknown workout');
  });

  it('prescribes every exercise in a workout', () => {
    const { workout, exercises } = prescribeWorkout(plan, 'lower_a');
    expect(workout.nameEn).toBe('Lower body A');
    expect(exercises.map((e) => e.exercise.key)).toEqual(WORKOUTS.lower_a.exerciseKeys);
  });
});

describe('roundToPlate', () => {
  it.each([
    [0, 2.5],
    [1.2, 2.5],
    [3.7, 2.5],
    [3.8, 5],
    [61.25, 62.5],
    [100.1, 100],
  ])('%f kg → %f kg', (input, expected) => expect(roundToPlate(input)).toBe(expected));
});

describe('readiness', () => {
  const answers: CheckinAnswer[] = [1, 2, 3];

  it('scores 40 for the worst morning and 100 for the best', () => {
    expect(readinessScore({ sleep: 1, energy: 1, soreness: 1 })).toBe(40);
    expect(readinessScore({ sleep: 3, energy: 3, soreness: 3 })).toBe(100);
    expect(readinessScore({ sleep: 2, energy: 2, soreness: 2 })).toBe(70);
  });

  it('always lands between 40 and 100 and below 60 means a light day', () => {
    for (const sleep of answers)
      for (const energy of answers)
        for (const soreness of answers) {
          const c: Checkin = { sleep, energy, soreness };
          const score = readinessScore(c);
          expect(score).toBeGreaterThanOrEqual(40);
          expect(score).toBeLessThanOrEqual(100);
          expect(isLightDay(score)).toBe(score < 60);
        }
  });

  it('treats a missing check-in as a normal day', () => {
    expect(isLightDay(null)).toBe(false);
    expect(isLightDay(59)).toBe(true);
    expect(isLightDay(60)).toBe(false);
  });

  it('indexes weekdays Monday first', () => {
    expect(weekdayIndex(new Date(2026, 9, 5))).toBe(0); // Monday 5 Oct 2026
    expect(weekdayIndex(new Date(2026, 9, 11))).toBe(6); // Sunday
  });
});

describe('content data', () => {
  it('every workout references real exercises and every alternative exists', () => {
    for (const w of Object.values(WORKOUTS)) {
      for (const k of w.exerciseKeys) expect(EXERCISES[k]).toBeDefined();
    }
    for (const e of Object.values(EXERCISES)) {
      if (e.alternativeKey) expect(EXERCISES[e.alternativeKey]).toBeDefined();
      expect(e.nameAr.trim()).not.toBe('');
    }
  });

  it('every split day references a real workout and has seven days', () => {
    for (const split of Object.values(SPLITS)) {
      expect(split.week).toHaveLength(7);
      for (const d of split.week) if (d.workoutKey) expect(WORKOUTS[d.workoutKey]).toBeDefined();
    }
  });

  it('makes every rest day a low-carb day', () => {
    for (const split of Object.values(SPLITS)) {
      for (const d of split.week) {
        if (!d.workoutKey) expect(d.dayType).toBe('low');
      }
    }
  });

  it('marks main lifts as in the prototype (smart station or ratio ≥ 0.6)', () => {
    for (const e of Object.values(EXERCISES)) {
      expect(!!e.isMain).toBe(!!e.smartStation || e.bodyweightRatio >= 0.6);
    }
  });
});

// ---------------------------------------------------------------------------
// Parity with the prototype: a verbatim copy of its plan() maths, run over every
// combination of inputs, must agree with the engine (no medical flags, since the
// engine adds moderate training that the prototype only described in text).
// ---------------------------------------------------------------------------

function prototypePlan(P: {
  weight: number;
  days: 3 | 4 | 5;
  goal: Goal;
  scan: { bf: number; bmr?: number };
  flags: string[];
}) {
  const bf = (P.scan.bf || 20) / 100,
    lbm = P.weight * (1 - bf);
  const bmr = Math.round(P.scan.bmr || 370 + 21.6 * lbm);
  const act = { 3: 1.45, 4: 1.55, 5: 1.65 }[P.days];
  const tdee = Math.round(bmr * act);
  const careful = P.flags.includes('ed') || P.flags.includes('preg');
  const gf = careful ? 1 : { lose: 0.8, build: 1.1, recomp: 0.95 }[P.goal];
  const target = Math.round((tdee * gf) / 10) * 10;
  const protein = Math.round(bf > 0.3 ? lbm * 2.4 : P.weight * 2.0);
  const mk = (mult: number, fatPerKg: number) => {
    const cal = Math.round((target * mult) / 10) * 10,
      f = Math.round(P.weight * fatPerKg),
      c = Math.max(50, Math.round((cal - protein * 4 - f * 9) / 4));
    return { cal, p: protein, c, f };
  };
  return {
    bmr,
    tdee,
    target,
    protein,
    macros: { H: mk(1.08, 0.8), M: mk(1.0, 0.9), L: mk(0.82, 1.15) },
  };
}

function* allInputs(): Generator<PlanInput> {
  const sexes: Sex[] = ['male', 'female'];
  const goals: Goal[] = ['lose', 'build', 'recomp'];
  const days: TrainingDays[] = [3, 4, 5];
  const exps: Experience[] = ['beginner', 'intermediate', 'advanced'];
  for (const sex of sexes)
    for (const goal of goals)
      for (const trainingDays of days)
        for (const experience of exps)
          for (const weightKg of [48, 63.5, 82, 97, 135])
            for (const bodyFatPct of [9, 18.4, 30, 31, 45])
              for (const bmrKcal of [null, 1450, 2100])
                for (const healthFlags of [
                  [],
                  ['pregnancy'],
                  ['eating_disorder'],
                ] as HealthFlag[][])
                  yield {
                    sex,
                    goal,
                    trainingDays,
                    experience,
                    weightKg,
                    bodyFatPct,
                    bmrKcal,
                    healthFlags,
                  };
}

describe('parity with the prototype', () => {
  it('matches plan() for every input combination', () => {
    let checked = 0;
    for (const input of allInputs()) {
      const expected = prototypePlan({
        weight: input.weightKg,
        days: input.trainingDays,
        goal: input.goal,
        scan: { bf: input.bodyFatPct!, bmr: input.bmrKcal ?? undefined },
        flags: input.healthFlags.map((f) => (f === 'eating_disorder' ? 'ed' : 'preg')),
      });
      const plan = buildPlan(input);
      expect({
        bmr: plan.bmrKcal,
        tdee: plan.tdeeKcal,
        target: plan.targetKcal,
        protein: plan.proteinG,
        macros: {
          H: {
            cal: plan.macros.high.kcal,
            p: plan.macros.high.proteinG,
            c: plan.macros.high.carbsG,
            f: plan.macros.high.fatG,
          },
          M: {
            cal: plan.macros.medium.kcal,
            p: plan.macros.medium.proteinG,
            c: plan.macros.medium.carbsG,
            f: plan.macros.medium.fatG,
          },
          L: {
            cal: plan.macros.low.kcal,
            p: plan.macros.low.proteinG,
            c: plan.macros.low.carbsG,
            f: plan.macros.low.fatG,
          },
        },
      }).toEqual(expected);
      checked++;
    }
    expect(checked).toBe(2 * 3 * 3 * 3 * 5 * 5 * 3 * 3);
  });

  it('matches the prototype starting weights', () => {
    // exLoad(): r25(weight × r × expF × goalF × (light ? 0.9 : 1))
    const r25 = (x: number) => Math.max(2.5, Math.round(x / 2.5) * 2.5);
    const expF = { beginner: 0.55, intermediate: 0.8, advanced: 1.0 };
    const goalF = { lose: 0.85, build: 0.9, recomp: 1.0 };
    for (const input of allInputs()) {
      if (input.healthFlags.length || input.bodyFatPct !== 18.4 || input.bmrKcal !== null) continue;
      const plan = buildPlan(input);
      for (const e of Object.values(EXERCISES)) {
        if (e.timedSeconds || !e.bodyweightRatio) continue;
        for (const light of [false, true]) {
          const expected = r25(
            input.weightKg *
              e.bodyweightRatio *
              expF[input.experience] *
              goalF[input.goal] *
              (light ? 0.9 : 1),
          );
          expect(prescribe(plan, e.key, light).loadKg).toBe(expected);
        }
      }
    }
  });
});
