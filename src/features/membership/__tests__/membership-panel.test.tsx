import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { MembershipPanel } from '../MembershipPanel';

let mockState: { tier: string; subscription: unknown } = { tier: 'free', subscription: null };
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('../useTier', () => ({ useEntitlements: () => mockState }));
jest.mock('@/features/ai/api', () => ({ callFunction: jest.fn() }));

beforeEach(() => mockPush.mockReset());

describe('MembershipPanel', () => {
  it('invites free members to try Pro', async () => {
    await render(<MembershipPanel />);
    expect(screen.getByTestId('membership-plan')).toHaveTextContent('Your plan: Free');
    await fireEvent.press(screen.getByTestId('see-plans'));
    expect(mockPush).toHaveBeenCalledWith('/paywall');
  });

  it('shows when a trial ends and opens the store to manage it', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockState = {
      tier: 'pro',
      subscription: {
        tier: 'pro',
        status: 'trial',
        is_trial: true,
        current_period_ends_at: '2026-10-13T12:00:00Z',
        will_renew: true,
        management_url: 'https://apps.apple.com/account/subscriptions',
      },
    };
    await render(<MembershipPanel />);
    expect(screen.getByTestId('membership-plan')).toHaveTextContent('Your plan: Pro');
    expect(screen.getByText(/Free trial ends on October 13, 2026/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Manage subscription'));
    expect(open).toHaveBeenCalledWith('https://apps.apple.com/account/subscriptions');
  });

  it('warns about billing problems and cancelled plans', async () => {
    mockState = {
      tier: 'elite',
      subscription: {
        tier: 'elite',
        status: 'billing_issue',
        is_trial: false,
        current_period_ends_at: '2026-10-20T00:00:00Z',
        will_renew: true,
        management_url: null,
      },
    };
    await render(<MembershipPanel />);
    expect(screen.getByText(/problem with your payment/)).toBeTruthy();
    mockState = {
      tier: 'pro',
      subscription: {
        tier: 'pro',
        status: 'cancelled',
        is_trial: false,
        current_period_ends_at: '2026-11-01T00:00:00Z',
        will_renew: false,
        management_url: null,
      },
    };
    await render(<MembershipPanel />);
    expect(screen.getByText(/It won't renew/)).toBeTruthy();
  });
});
