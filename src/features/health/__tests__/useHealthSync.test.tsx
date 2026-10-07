import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useSettings } from '@/stores/settings';

import { useHealthSync } from '../useHealthSync';

const mockRead = jest.fn();
const mockSave = jest.fn();

jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/features/today/api', () => ({
  useTodayKey: () => '2026-10-07',
  dailyLogKey: (uid: string, date: string) => ['daily_log', uid, date],
}));
jest.mock('../sync', () => ({
  readHealthDay: (...a: unknown[]) => mockRead(...a),
  saveHealthDay: (...a: unknown[]) => mockSave(...a),
}));

const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => {
  mockRead.mockReset().mockResolvedValue({ sleepMinutes: 450, steps: 1200 });
  mockSave.mockReset().mockResolvedValue(true);
});

describe('useHealthSync', () => {
  it('reads and saves today when Health is connected', async () => {
    useSettings.setState({ healthEnabled: true });
    await renderHook(() => useHealthSync(), { wrapper });
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockRead.mock.calls[0][1]).toBe('2026-10-07');
    expect(mockSave).toHaveBeenCalledWith(
      'u1',
      '2026-10-07',
      { sleepMinutes: 450, steps: 1200 },
      'apple_health',
    );
  });

  it('reads nothing when Health is off', async () => {
    useSettings.setState({ healthEnabled: false });
    await renderHook(() => useHealthSync(), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(mockRead).not.toHaveBeenCalled();
  });
});
