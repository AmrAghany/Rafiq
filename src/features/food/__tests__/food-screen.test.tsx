import { fireEvent, render, screen } from '@testing-library/react-native';

import FoodScreen from '@/app/(tabs)/food';
import type { HealthFlag } from '@/features/plan/engine';

import type { MealLog } from '../api';

const mockAdd = jest.fn();
const mockRemove = jest.fn();
let mockFlags: HealthFlag[] = [];
let mockMeals: MealLog[] = [];
let mockPaid = false;
const mockCall = jest.fn();
const mockPick = jest.fn();
const mockUpload = jest.fn();

jest.mock('@/features/membership/useTier', () => ({
  useEntitlements: () => ({
    tier: mockPaid ? 'pro' : 'free',
    isPaid: mockPaid,
    can: () => mockPaid,
    isLoading: false,
  }),
}));
jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/features/ai/api', () => ({ callFunction: (...a: unknown[]) => mockCall(...a) }));
jest.mock('@/features/ai/photos', () => {
  const actual = jest.requireActual('@/features/ai/photos');
  return {
    ...actual,
    pickPhoto: (...a: unknown[]) => mockPick(...a),
    uploadPhoto: (...a: unknown[]) => mockUpload(...a),
  };
});

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
  mockPaid = true;
  [mockCall, mockPick, mockUpload].forEach((m) => m.mockReset());
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
      photo_path: null,
      ai_estimate: null,
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

  it('locks carb cycling and meal plans for free members', async () => {
    mockPaid = false;
    await render(<FoodScreen />);
    expect(screen.getByText('Carb cycling and meal plans are part of Pro')).toBeTruthy();
    expect(screen.getByTestId('open-paywall')).toBeTruthy();
    expect(screen.queryByTestId('meal-add')).toBeNull();
  });

  it('keeps balanced-meal logging free for careful plans, without AI', async () => {
    mockPaid = false;
    mockFlags = ['eating_disorder'];
    await render(<FoodScreen />);
    expect(screen.getByTestId('meal-add')).toBeTruthy();
    expect(screen.queryByTestId('ai-estimate')).toBeNull();
  });

  it('pre-fills the form from a text estimate for the member to check', async () => {
    const estimate = {
      name: 'Chicken shawarma wrap',
      kcal: 550,
      protein_g: 32,
      carbs_g: 48,
      fat_g: 24,
      confidence: 'medium',
    };
    mockCall.mockResolvedValue({ estimate });
    await render(<FoodScreen />);
    await fireEvent.changeText(screen.getByTestId('ai-describe'), 'shawarma wrap');
    await fireEvent.press(screen.getByTestId('ai-estimate'));
    expect(mockCall).toHaveBeenCalledWith('meal-estimate', {
      text: 'shawarma wrap',
      photoPath: undefined,
    });
    expect(await screen.findByText(/Check the estimate/)).toBeTruthy();
    expect(screen.getByTestId('meal-name').props.value).toBe('Chicken shawarma wrap');
    expect(screen.getByTestId('meal-kcal').props.value).toBe('550');
    // The member corrects the calories before adding.
    await fireEvent.changeText(screen.getByTestId('meal-kcal'), '600');
    await fireEvent.press(screen.getByTestId('meal-add'));
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Chicken shawarma wrap',
        kcal: 600,
        source: 'text',
        ai_estimate: estimate,
      }),
    );
  });

  it('estimates from a photo uploaded to the member’s folder', async () => {
    mockPaid = true;
    mockPick.mockResolvedValue({ base64: 'abc', uri: 'file://x.jpg' });
    mockUpload.mockResolvedValue('u1/photo.jpg');
    mockCall.mockResolvedValue({
      estimate: {
        name: 'Mandi',
        kcal: 900,
        protein_g: 45,
        carbs_g: 100,
        fat_g: 30,
        confidence: 'low',
      },
    });
    await render(<FoodScreen />);
    await fireEvent.press(screen.getByText('Take a photo'));
    expect(await screen.findByText(/Rough estimate/)).toBeTruthy();
    expect(mockPick).toHaveBeenCalledWith('camera');
    expect(mockUpload).toHaveBeenCalledWith('meal-photos', 'u1', 'abc');
    expect(mockCall).toHaveBeenCalledWith('meal-estimate', {
      text: undefined,
      photoPath: 'u1/photo.jpg',
    });
    await fireEvent.press(screen.getByTestId('meal-add'));
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'photo', photo_path: 'u1/photo.jpg' }),
    );
  });

  it('explains limits and failures', async () => {
    mockPaid = true;
    const { AiError } = jest.requireActual('@/features/ai/errors');
    mockCall.mockRejectedValue(new AiError('quota_exceeded'));
    await render(<FoodScreen />);
    await fireEvent.changeText(screen.getByTestId('ai-describe'), 'kabsa');
    await fireEvent.press(screen.getByTestId('ai-estimate'));
    expect(await screen.findByText(/reached today's limit/)).toBeTruthy();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('does nothing when the member cancels the camera', async () => {
    mockPaid = true;
    mockPick.mockResolvedValue(null);
    await render(<FoodScreen />);
    await fireEvent.press(screen.getByText('Choose a photo'));
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockCall).not.toHaveBeenCalled();
  });
});
