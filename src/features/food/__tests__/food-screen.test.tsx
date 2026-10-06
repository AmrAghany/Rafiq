import { fireEvent, render, screen } from '@testing-library/react-native';

import FoodScreen from '@/app/(tabs)/food';
import type { HealthFlag } from '@/features/plan/engine';

import type { MealLog } from '../api';

const mockAdd = jest.fn();
const mockRemove = jest.fn();
let mockFlags: HealthFlag[] = [];
let mockMeals: MealLog[] = [];

jest.mock('@/features/today/api', () => {
  const { buildPlan } = jest.requireActual('@/features/plan/engine');
  return {
    useToday: () => ({
      dateKey: '2026-10-06',
      todayIndex: 1, // Tuesday: high-carb day
      ramadan: false,
      plan: {
        isPending: false,
        data: {
          plan: buildPlan({
            sex: 'male',
            weightKg: 82,
            goal: 'recomp',
            trainingDays: 4,
            experience: 'intermediate',
            bodyFatPct: 18.4,
            bmrKcal: 1810,
            healthFlags: mockFlags,
          }),
        },
      },
    }),
  };
});
jest.mock('../api', () => ({
  useMealLogs: () => ({ isPending: false, isError: false, data: mockMeals }),
  useMealActions: () => ({ add: { mutate: mockAdd }, remove: { mutate: mockRemove } }),
}));

const shawarma: MealLog = {
  id: 'm1',
  name: 'Chicken shawarma wrap',
  kcal: 550,
  protein_g: 32,
  carbs_g: 48,
  fat_g: 24,
  source: 'manual',
  template_key: null,
  eaten_at: '2026-10-06T12:00:00Z',
};

beforeEach(() => {
  mockAdd.mockReset();
  mockRemove.mockReset();
  mockFlags = [];
  mockMeals = [];
});

describe('Food screen', () => {
  it('shows what was eaten against the day’s targets', async () => {
    mockMeals = [shawarma];
    await render(<FoodScreen />);
    expect(screen.getByText('High-carb day')).toBeTruthy();
    expect(screen.getByTestId('kcal-progress')).toHaveTextContent('550 / 2880 kcal');
    expect(screen.getByText('32 / 164 g')).toBeTruthy();
    expect(screen.getByText('550 kcal, 32 g protein, 48 g carbs, 24 g fat')).toBeTruthy();
  });

  it('logs a meal typed by hand, accepting Arabic digits', async () => {
    await render(<FoodScreen />);
    await fireEvent.changeText(screen.getByTestId('meal-name'), 'Foul and bread');
    await fireEvent.changeText(screen.getByTestId('meal-kcal'), '٤٥٠');
    await fireEvent.changeText(screen.getByTestId('meal-protein'), '22.5');
    await fireEvent.press(screen.getByTestId('meal-add'));
    expect(mockAdd).toHaveBeenCalledWith({
      name: 'Foul and bread',
      kcal: 450,
      protein_g: 22.5,
      carbs_g: null,
      fat_g: null,
      source: 'manual',
      template_key: null,
    });
  });

  it('validates the meal form', async () => {
    await render(<FoodScreen />);
    await fireEvent.changeText(screen.getByTestId('meal-kcal'), 'lots');
    await fireEvent.press(screen.getByTestId('meal-add'));
    expect(screen.getByText('Add a name for the meal.')).toBeTruthy();
    expect(screen.getByText('Enter a number, or leave it empty.')).toBeTruthy();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('shows the meal plan and logs a planned meal in one tap', async () => {
    await render(<FoodScreen />);
    expect(screen.getByText('Oats with banana, honey and a scoop of whey')).toBeTruthy();
    expect(screen.getByText('About 720 kcal, 41 g protein, 102 g carbs')).toBeTruthy();
    await fireEvent.press(screen.getAllByText('Log this meal')[0]);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'plan', template_key: 'high_breakfast', kcal: 720 }),
    );
  });

  it('removes a logged meal', async () => {
    mockMeals = [shawarma];
    await render(<FoodScreen />);
    await fireEvent.press(screen.getByText('Remove'));
    expect(mockRemove).toHaveBeenCalledWith('m1');
  });

  it('never shows or asks for numbers with careful health flags', async () => {
    mockFlags = ['pregnancy'];
    mockMeals = [shawarma];
    await render(<FoodScreen />);
    expect(screen.queryByTestId('meal-kcal')).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/kcal|\b550\b|2880/);
    await fireEvent.press(screen.getAllByText('Log this meal')[0]);
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ kcal: null, protein_g: null }));
  });
});
