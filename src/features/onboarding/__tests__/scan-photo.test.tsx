import { fireEvent, render, screen } from '@testing-library/react-native';

import { AiError } from '@/features/ai/errors';

import { ScanPhoto } from '../ScanPhoto';
import { useOnboarding } from '../store';

let mockPaid = true;
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
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
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

beforeEach(() => {
  mockPaid = true;
  useOnboarding.getState().reset();
  [mockCall, mockPick, mockUpload].forEach((m) => m.mockReset());
  mockPick.mockResolvedValue({ base64: 'abc', uri: 'file://scan.jpg' });
  mockUpload.mockResolvedValue('u1/scan.jpg');
});

describe('ScanPhoto', () => {
  it('fills the scan fields from the photo and keeps what was read', async () => {
    const reading = {
      weight_kg: 82.1,
      body_fat_percent: 18.4,
      skeletal_muscle_kg: 38.2,
      bmr_kcal: null,
    };
    mockCall.mockResolvedValue({ reading, photoPath: 'u1/scan.jpg' });
    await render(<ScanPhoto />);
    await fireEvent.press(screen.getByTestId('scan-camera'));
    expect(await screen.findByText(/Check each number against your sheet/)).toBeTruthy();
    expect(mockUpload).toHaveBeenCalledWith('scan-photos', 'u1', 'abc');
    expect(mockCall).toHaveBeenCalledWith('scan-read', { photoPath: 'u1/scan.jpg' });
    expect(useOnboarding.getState().draft).toMatchObject({
      bodyFatPct: '18.4',
      skeletalMuscleKg: '38.2',
      bmrKcal: '',
      scanPhotoPath: 'u1/scan.jpg',
      scanAiReading: reading,
    });
  });

  it('says so when the photo is not a scan sheet', async () => {
    mockCall.mockResolvedValue({ reading: null });
    await render(<ScanPhoto />);
    await fireEvent.press(screen.getByTestId('scan-camera'));
    expect(await screen.findByText(/couldn't read a body composition sheet/)).toBeTruthy();
    expect(useOnboarding.getState().draft.scanPhotoPath).toBeNull();
  });

  it('shows server errors in plain words', async () => {
    mockCall.mockRejectedValue(new AiError('ai_unavailable'));
    await render(<ScanPhoto />);
    await fireEvent.press(screen.getByTestId('scan-camera'));
    expect(await screen.findByText(/busy right now/)).toBeTruthy();
  });

  it('asks free members to type the numbers and uploads nothing', async () => {
    mockPaid = false;
    await render(<ScanPhoto />);
    expect(screen.getByText(/Reading the sheet from a photo is part of Pro/)).toBeTruthy();
    expect(screen.getByText('Try Pro free')).toBeTruthy();
    expect(screen.queryByTestId('scan-camera')).toBeNull();
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
