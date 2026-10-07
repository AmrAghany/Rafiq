import Purchases from 'react-native-purchases';

const mockCall = jest.fn();
jest.mock('@/features/ai/api', () => ({ callFunction: (...a: unknown[]) => mockCall(...a) }));
jest.mock('@/lib/env', () => ({
  env: { revenueCatIosKey: 'appl_test', revenueCatAndroidKey: 'goog_test' },
}));

const P = Purchases as jest.Mocked<typeof Purchases>;

// Load after the mocks so the module reads the mocked env.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const purchases = require('../purchases') as typeof import('../purchases');

const pkg = { identifier: '$rc_monthly', product: { identifier: 'rafiq_pro_monthly' } } as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockCall.mockResolvedValue({ subscription: { tier: 'pro' } });
});

describe('purchases', () => {
  it('configures RevenueCat with the member id once, then switches users with logIn', async () => {
    expect(purchases.purchasesAvailable()).toBe(true);
    await purchases.identify('user-1');
    expect(P.configure).toHaveBeenCalledWith({ apiKey: 'appl_test', appUserID: 'user-1' });
    await purchases.identify('user-2');
    expect(P.configure).toHaveBeenCalledTimes(1);
    expect(P.logIn).toHaveBeenCalledWith('user-2');
  });

  it('syncs the server mirror after a purchase', async () => {
    await expect(purchases.buy(pkg)).resolves.toBe('purchased');
    expect(P.purchasePackage).toHaveBeenCalledWith(pkg);
    expect(mockCall).toHaveBeenCalledWith('sync-subscription', {});
  });

  it('treats cancel and pending as outcomes, not errors', async () => {
    P.purchasePackage.mockRejectedValueOnce({ code: '1' });
    await expect(purchases.buy(pkg)).resolves.toBe('cancelled');
    P.purchasePackage.mockRejectedValueOnce({ code: '20' });
    await expect(purchases.buy(pkg)).resolves.toBe('pending');
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('maps store errors', async () => {
    P.purchasePackage.mockRejectedValueOnce({ code: '10' });
    await expect(purchases.buy(pkg)).rejects.toMatchObject({ code: 'network' });
    P.purchasePackage.mockRejectedValueOnce({ code: '3' });
    await expect(purchases.buy(pkg)).rejects.toMatchObject({ code: 'not_allowed' });
    P.restorePurchases.mockRejectedValueOnce({ code: '99' });
    await expect(purchases.restore()).rejects.toMatchObject({ code: 'store' });
  });

  it('restores and syncs', async () => {
    await purchases.restore();
    expect(P.restorePurchases).toHaveBeenCalled();
    expect(mockCall).toHaveBeenCalledWith('sync-subscription', {});
  });

  it('loads the current offering as ordered plans', async () => {
    P.getOfferings.mockResolvedValueOnce({
      current: {
        availablePackages: [
          { identifier: 'elite', product: { identifier: 'rafiq_elite_monthly' } },
          { identifier: 'pro', product: { identifier: 'rafiq_pro_monthly' } },
        ],
      },
    } as never);
    expect((await purchases.loadPlans()).map((p) => p.tier)).toEqual(['pro', 'elite']);
  });
});
