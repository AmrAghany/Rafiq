import { render, screen } from '@testing-library/react-native';

import { changeLanguage } from '@/i18n';

import { buildPlan, type PlanInput } from '../engine';
import { PlanSummary } from '../PlanSummary';

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

/** Everything rendered (text and accessibility labels), to assert what the member can see. */
const rendered = () => JSON.stringify(screen.toJSON());

afterEach(() => changeLanguage('en'));

describe('PlanSummary', () => {
  it('shows the scan basis, split and carb cycle', async () => {
    await render(<PlanSummary plan={buildPlan(sam)} />);
    expect(
      screen.getByText(
        'Built from your scan: 18.4% body fat, 66.9 kg lean mass, 1810 kcal resting burn.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('4-day upper/lower, 4 × 6 on main lifts.')).toBeTruthy();
    expect(screen.getByText('2880 kcal, 408 g carbs')).toBeTruthy();
    expect(screen.getByText('2190 kcal, 172 g carbs')).toBeTruthy();
    expect(screen.getByLabelText(/^Tue, Lower body A, High-carb day/)).toBeTruthy();
    expect(rendered()).toMatch(/kcal/); // control for the no-calories tests below
  });

  it.each(['pregnancy', 'eating_disorder'] as const)(
    'never shows calorie numbers with the %s flag',
    async (flag) => {
      await render(<PlanSummary plan={buildPlan({ ...sam, healthFlags: [flag] })} />);
      const text = rendered();
      expect(text).not.toMatch(/kcal/i);
      expect(text).not.toMatch(/carbs/i);
      expect(screen.getByTestId('balanced-meals')).toBeTruthy();
      expect(screen.getByText(/no calorie cut/)).toBeTruthy();
      expect(screen.queryByLabelText(/carb day/)).toBeNull();
    },
  );

  it('warns about medical flags', async () => {
    await render(<PlanSummary plan={buildPlan({ ...sam, healthFlags: ['heart'] })} />);
    expect(screen.getByText(/Get your doctor's or physio's OK/)).toBeTruthy();
    expect(screen.getByText('4-day upper/lower, 4 × 8 on main lifts.')).toBeTruthy();
  });

  it('explains an assumed body fat', async () => {
    await render(<PlanSummary plan={buildPlan({ ...sam, bodyFatPct: null })} />);
    expect(screen.getByText(/We assumed 20% body fat/)).toBeTruthy();
  });

  it('renders in Arabic', async () => {
    await changeLanguage('ar');
    await render(<PlanSummary plan={buildPlan(sam)} />);
    expect(screen.getByText('علوي/سفلي، 4 أيام، 4 × 6 في التمارين الأساسية.')).toBeTruthy();
    expect(screen.getByText('2880 سعرة، 408 غ كربوهيدرات')).toBeTruthy();
  });
});
