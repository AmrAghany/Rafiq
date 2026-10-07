import { hitAllReps, nextTarget, workingWeight, type ExerciseSession } from '../progression';

const session = (date: string, kg: number, reps: number[], target = 6): ExerciseSession => ({
  date,
  sets: reps.map((r, i) => ({
    setNumber: i + 1,
    targetReps: target,
    actualReps: r,
    actualWeightKg: kg,
    completed: true,
  })),
});

describe('workingWeight', () => {
  it('is the heaviest completed set', () => {
    const s = session('2026-10-01', 60, [6, 6]);
    s.sets.push({
      setNumber: 3,
      targetReps: 6,
      actualReps: 6,
      actualWeightKg: 80,
      completed: false,
    });
    expect(workingWeight(s)).toBe(60);
    expect(workingWeight({ date: 'x', sets: [] })).toBeNull();
  });
});

describe('hitAllReps', () => {
  it('needs every prescribed set at target reps and weight', () => {
    expect(hitAllReps(session('d', 60, [6, 6, 6, 6]), 4, 60)).toBe(true);
    expect(hitAllReps(session('d', 60, [6, 6, 6]), 4, 60)).toBe(false); // a set short
    expect(hitAllReps(session('d', 60, [6, 6, 5, 6]), 4, 60)).toBe(false); // missed reps
    expect(hitAllReps(session('d', 55, [6, 6, 6, 6]), 4, 60)).toBe(false); // lighter weight
  });
});

describe('nextTarget', () => {
  it('starts from the plan weight with no history', () => {
    expect(nextTarget({ startKg: 65, history: [], prescribedSets: 4 })).toEqual({
      targetKg: 65,
      suggestedKg: null,
    });
  });

  it('carries on from the last working weight', () => {
    const history = [session('2026-10-03', 70, [6, 6, 5, 4])];
    expect(nextTarget({ startKg: 65, history, prescribedSets: 4 }).targetKg).toBe(70);
  });

  it('suggests an increase after two complete sessions in a row', () => {
    const history = [
      session('2026-10-03', 65, [6, 6, 6, 6]),
      session('2026-09-30', 65, [6, 6, 6, 7]),
    ];
    expect(nextTarget({ startKg: 65, history, prescribedSets: 4, incrementKg: 5 })).toEqual({
      targetKg: 65,
      suggestedKg: 70,
    });
  });

  it('does not suggest after only one complete session', () => {
    const history = [
      session('2026-10-03', 65, [6, 6, 6, 6]),
      session('2026-09-30', 65, [6, 6, 4, 4]),
    ];
    expect(nextTarget({ startKg: 65, history, prescribedSets: 4 }).suggestedKg).toBeNull();
  });

  it('does not count sessions at a lighter weight', () => {
    // Moved up to 70 last time and made it; the session before was at 65.
    const history = [
      session('2026-10-03', 70, [6, 6, 6, 6]),
      session('2026-09-30', 65, [6, 6, 6, 6]),
    ];
    expect(nextTarget({ startKg: 65, history, prescribedSets: 4 }).suggestedKg).toBeNull();
  });

  it('makes a light day 10% lighter and never suggests on it', () => {
    const history = [
      session('2026-10-03', 65, [6, 6, 6, 6]),
      session('2026-09-30', 65, [6, 6, 6, 6]),
    ];
    expect(nextTarget({ startKg: 65, history, prescribedSets: 4, light: true })).toEqual({
      targetKg: 57.5,
      suggestedKg: null,
    });
  });

  it('uses the plan’s light-day weight when there is no history', () => {
    // 82 kg × 1.0 × 0.8 × 0.9 = 59.04 → 60 kg (rounding 65 × 0.9 would give 57.5).
    expect(
      nextTarget({ startKg: 65, lightStartKg: 60, history: [], prescribedSets: 4, light: true }),
    ).toEqual({ targetKg: 60, suggestedKg: null });
  });

  it('has no target for bodyweight or timed exercises', () => {
    expect(nextTarget({ startKg: null, history: [], prescribedSets: 3 })).toEqual({
      targetKg: null,
      suggestedKg: null,
    });
  });
});
