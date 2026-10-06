import {
  ageOn,
  emptyDraft,
  parseBirthDate,
  parseNumber,
  toPlanInput,
  validateAbout,
  validateScan,
  type OnboardingDraft,
} from '../validation';
import { buildOnboardingPayload } from '../payload';

const today = new Date(2026, 9, 6); // 6 Oct 2026

const valid: OnboardingDraft = {
  ...emptyDraft,
  name: ' Sam ',
  sex: 'male',
  birthDay: '14',
  birthMonth: '2',
  birthYear: '1997',
  heightCm: '178',
  weightKg: '82',
  goal: 'recomp',
  trainingDays: 4,
  experience: 'intermediate',
  bodyFatPct: '18.4',
  skeletalMuscleKg: '38.2',
  bmrKcal: '1810',
  healthFlags: [],
  medicalNoticeAcceptedAt: '2026-10-06T08:00:00.000Z',
};

describe('parseNumber', () => {
  it.each([
    ['82', 82],
    [' 82.5 ', 82.5],
    ['82,5', 82.5],
    ['٨٢٫٥', 82.5], // Arabic-Indic digits and decimal separator
    ['۸۲', 82], // Persian digits
    ['', null],
    ['abc', null],
    ['-5', null],
    ['1.2.3', null],
  ])('%j → %j', (raw, expected) => expect(parseNumber(raw)).toBe(expected));
});

describe('birth date and age', () => {
  it('parses real dates and rejects impossible ones', () => {
    expect(parseBirthDate('14', '2', '1997')).toBe('1997-02-14');
    expect(parseBirthDate('٢٩', '٢', '٢٠٠٤')).toBe('2004-02-29'); // leap year, Arabic digits
    expect(parseBirthDate('29', '2', '2003')).toBeNull();
    expect(parseBirthDate('31', '4', '1990')).toBeNull();
    expect(parseBirthDate('1', '13', '1990')).toBeNull();
    expect(parseBirthDate('', '1', '1990')).toBeNull();
    expect(parseBirthDate('1', '1', '1850')).toBeNull();
  });

  it('counts completed years', () => {
    expect(ageOn('2008-10-06', today)).toBe(18); // 18th birthday today
    expect(ageOn('2008-10-07', today)).toBe(17); // tomorrow
    expect(ageOn('1997-02-14', today)).toBe(29);
  });
});

describe('validateAbout', () => {
  it('accepts a complete adult profile', () => {
    expect(validateAbout(valid, today)).toEqual({});
  });

  it('requires every answer', () => {
    expect(validateAbout(emptyDraft, today)).toEqual({
      name: 'nameRequired',
      sex: 'sexRequired',
      birthDate: 'birthDateInvalid',
      height: 'heightInvalid',
      weight: 'weightInvalid',
      goal: 'goalRequired',
      days: 'daysRequired',
      experience: 'experienceRequired',
    });
  });

  it('blocks members under 18', () => {
    const teen = { ...valid, birthDay: '7', birthMonth: '10', birthYear: '2008' };
    expect(validateAbout(teen, today).birthDate).toBe('underage');
    const adult = { ...valid, birthDay: '6', birthMonth: '10', birthYear: '2008' };
    expect(validateAbout(adult, today).birthDate).toBeUndefined();
  });

  it('rejects birth dates in the future or over 100 years ago', () => {
    expect(validateAbout({ ...valid, birthYear: '2027' }, today).birthDate).toBe(
      'birthDateInvalid',
    );
    expect(validateAbout({ ...valid, birthYear: '1920' }, today).birthDate).toBe(
      'birthDateInvalid',
    );
  });

  it('checks height and weight ranges', () => {
    expect(validateAbout({ ...valid, heightCm: '119' }, today).height).toBe('heightInvalid');
    expect(validateAbout({ ...valid, weightKg: '34' }, today).weight).toBe('weightInvalid');
    expect(validateAbout({ ...valid, weightKg: '٨٢' }, today).weight).toBeUndefined();
  });
});

describe('validateScan', () => {
  it('allows an empty scan', () => {
    expect(validateScan({ ...valid, bodyFatPct: '', skeletalMuscleKg: '', bmrKcal: '' })).toEqual(
      {},
    );
  });

  it('flags implausible numbers', () => {
    expect(
      validateScan({ ...valid, bodyFatPct: '75', bmrKcal: '300', skeletalMuscleKg: 'x' }),
    ).toEqual({
      bodyFatPct: 'outOfRange',
      bmrKcal: 'outOfRange',
      skeletalMuscleKg: 'outOfRange',
    });
  });
});

describe('toPlanInput and the save payload', () => {
  it('converts the draft into engine input', () => {
    expect(toPlanInput(valid)).toEqual({
      sex: 'male',
      weightKg: 82,
      goal: 'recomp',
      trainingDays: 4,
      experience: 'intermediate',
      bodyFatPct: 18.4,
      bmrKcal: 1810,
      healthFlags: [],
    });
    expect(toPlanInput({ ...valid, bodyFatPct: '', bmrKcal: '' })).toMatchObject({
      bodyFatPct: null,
      bmrKcal: null,
    });
  });

  it('throws for an incomplete draft', () => {
    expect(() => toPlanInput(emptyDraft)).toThrow('incomplete');
  });

  it('builds the complete_onboarding payload', () => {
    const payload = buildOnboardingPayload(valid, { locale: 'ar', timezone: 'Asia/Riyadh' });
    expect(payload.p_profile).toEqual({
      display_name: 'Sam',
      sex: 'male',
      date_of_birth: '1997-02-14',
      height_cm: 178,
      weight_kg: 82,
      goal: 'recomp',
      training_days: 4,
      experience: 'intermediate',
      health_flags: [],
      locale: 'ar',
      timezone: 'Asia/Riyadh',
      medical_notice_accepted_at: '2026-10-06T08:00:00.000Z',
    });
    expect(payload.p_scan).toEqual({
      source: 'manual',
      weight_kg: 82,
      body_fat_pct: 18.4,
      skeletal_muscle_kg: 38.2,
      bmr_kcal: 1810,
    });
    expect(payload.p_plan).toMatchObject({ targetKcal: 2670, engineVersion: '1.0.0' });
    expect(payload.p_engine_version).toBe('1.0.0');
  });
});
