import { render, waitFor } from '@testing-library/react-native';

import { PurchasesSync } from '../PurchasesSync';

let mockUid: string | null = 'user-1';
let mockListener: (() => void) | null = null;
const mockIdentify = jest.fn(async (_id: string) => {});
const mockForget = jest.fn(async () => {});
const mockSync = jest.fn(async () => ({}));
const mockRefresh = jest.fn();

jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: mockUid ? { user: { id: mockUid } } : null }),
}));
jest.mock('../useTier', () => ({ useEntitlements: () => ({ refresh: mockRefresh }) }));
jest.mock('../purchases', () => ({
  identify: (id: string) => mockIdentify(id),
  forget: () => mockForget(),
  syncSubscription: () => mockSync(),
  onCustomerInfoChange: (l: () => void) => {
    mockListener = l;
    return () => {
      mockListener = null;
    };
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUid = 'user-1';
  mockListener = null;
});

describe('PurchasesSync', () => {
  it('identifies the member and resyncs when their purchases change', async () => {
    await render(<PurchasesSync />);
    await waitFor(() => expect(mockListener).not.toBeNull());
    expect(mockIdentify).toHaveBeenCalledWith('user-1');
    mockListener!();
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    expect(mockSync).toHaveBeenCalled();
  });

  it('logs out of RevenueCat when nobody is signed in', async () => {
    mockUid = null;
    await render(<PurchasesSync />);
    expect(mockForget).toHaveBeenCalled();
    expect(mockIdentify).not.toHaveBeenCalled();
  });
});
