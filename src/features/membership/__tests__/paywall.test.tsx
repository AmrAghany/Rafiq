import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import PaywallScreen from '@/app/paywall';

let mockAvailable = true;
let mockTier = 'free';
const mockBuy = jest.fn();
const mockRestore = jest.fn();
const mockRefresh = jest.fn();
const mockLoad = jest.fn();

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/lib/env', () => ({
  env: { termsUrl: 'https://rafiq.app/terms', privacyUrl: 'https://rafiq.app/privacy' },
}));
jest.mock('../useTier', () => ({
  useEntitlements: () => ({ tier: mockTier, refresh: mockRefresh }),
}));
jest.mock('../purchases', () => {
  const actual = jest.requireActual('../purchases');
  return {
    PurchaseError: actual.PurchaseError,
    purchasesAvailable: () => mockAvailable,
    loadPlans: () => mockLoad(),
    buy: (...a: unknown[]) => mockBuy(...a),
    restore: () => mockRestore(),
  };
});
jest.mock('@/features/ai/api', () => ({ callFunction: jest.fn() }));

const plans = [
  {
    tier: 'pro',
    pkg: {
      identifier: 'pro',
      product: {
        identifier: 'rafiq_pro_monthly',
        priceString: '$12.99',
        introPrice: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7, cycles: 1 },
      },
    },
  },
  {
    tier: 'elite',
    pkg: {
      identifier: 'elite',
      product: { identifier: 'rafiq_elite_monthly', priceString: '$49.00', introPrice: null },
    },
  },
];

function renderPaywall() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaywallScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockAvailable = true;
  mockTier = 'free';
  [mockBuy, mockRestore, mockRefresh, mockLoad].forEach((m) => m.mockReset());
  mockLoad.mockResolvedValue(plans);
});

describe('Paywall', () => {
  it('shows both plans with store prices and the Pro trial', async () => {
    await renderPaywall();
    expect(await screen.findByText('Try Pro free for 7 days')).toBeTruthy();
    expect(screen.getByText('$12.99 / month')).toBeTruthy();
    expect(screen.getByText('7 days free, then $12.99 / month')).toBeTruthy();
    expect(screen.getByText('$49.00 / month')).toBeTruthy();
    expect(screen.getByText('Start free trial')).toBeTruthy();
    expect(screen.getByText(/renew automatically unless cancelled/)).toBeTruthy();
    expect(screen.getByText('Terms of use')).toBeTruthy();
  });

  it('switches to Elite, which has no trial', async () => {
    await renderPaywall();
    await fireEvent.press(await screen.findByTestId('plan-elite'));
    expect(screen.getByText('Choose your plan')).toBeTruthy();
    expect(screen.getByText('Subscribe')).toBeTruthy();
  });

  it('buys the selected plan and confirms it', async () => {
    mockBuy.mockResolvedValue('purchased');
    await renderPaywall();
    await fireEvent.press(await screen.findByTestId('paywall-buy'));
    expect(mockBuy).toHaveBeenCalledWith(plans[0].pkg);
    expect(mockRefresh).toHaveBeenCalled();
    expect(await screen.findByText('Welcome to Pro! Everything is unlocked.')).toBeTruthy();
  });

  it('stays quiet when the member cancels, and explains failures', async () => {
    mockBuy.mockResolvedValueOnce('cancelled');
    await renderPaywall();
    await fireEvent.press(await screen.findByTestId('paywall-buy'));
    expect(screen.queryByText(/Welcome to/)).toBeNull();
    const { PurchaseError } = jest.requireActual('../purchases');
    mockBuy.mockRejectedValueOnce(new PurchaseError('network'));
    await fireEvent.press(screen.getByTestId('paywall-buy'));
    expect(await screen.findByText(/No connection/)).toBeTruthy();
  });

  it('restores purchases', async () => {
    mockRestore.mockResolvedValue(undefined);
    await renderPaywall();
    await fireEvent.press(await screen.findByText('Restore purchases'));
    expect(await screen.findByText('Purchases restored.')).toBeTruthy();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('says so when this build has no store connection', async () => {
    mockAvailable = false;
    await renderPaywall();
    expect(screen.getByText(/Subscriptions aren't available in this build/)).toBeTruthy();
    expect(mockLoad).not.toHaveBeenCalled();
    expect(screen.queryByTestId('paywall-buy')).toBeNull();
  });

  it('does not sell the plan the member already has', async () => {
    mockTier = 'pro';
    await renderPaywall();
    expect(await screen.findByText('Your current plan')).toBeTruthy();
    expect(screen.getByTestId('paywall-buy')).toBeDisabled();
  });
});
