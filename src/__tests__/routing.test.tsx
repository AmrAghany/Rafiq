// Where members land after the auth state changes, using the real route files.
import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useSettings } from '@/stores/settings';

let mockSession: { user: { id: string } } | null = null;
let mockOnboarded = false;

jest.mock('@/features/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ session: mockSession, isLoaded: true }),
}));
jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({
    isPending: false,
    isError: false,
    data: {
      display_name: 'Sam',
      onboarding_completed_at: mockOnboarded ? '2026-10-06T00:00:00Z' : null,
    },
  }),
  useActivePlan: () => ({ isPending: true }),
  useCompleteOnboarding: () => ({ mutate: jest.fn(), isPending: false, isError: false }),
}));
jest.mock('@/features/membership/PurchasesSync', () => ({ PurchasesSync: () => null }));
jest.mock('@/features/reminders/useReminderSync', () => ({ useReminderSync: () => {} }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }));

beforeEach(() => {
  useSettings.setState({ hasHydrated: true });
});

describe('routing', () => {
  it('signed-out members see sign-in', async () => {
    mockSession = null;
    await renderRouter('./src/app');
    expect(
      await screen
        .findByText('Create your account', { exact: false })
        .catch(() => screen.getByTestId('submit-email')),
    ).toBeTruthy();
    expect(screen.queryByText('Try Pro free')).toBeNull();
  });

  it('a new member goes to onboarding, never the paywall', async () => {
    mockSession = { user: { id: 'u1' } };
    mockOnboarded = false;
    await renderRouter('./src/app');
    expect(await screen.findByTestId('accept-notice')).toBeTruthy();
    expect(screen.queryByTestId('paywall-buy')).toBeNull();
    expect(screen.queryByText(/Subscriptions aren't available/)).toBeNull();
  });
});
