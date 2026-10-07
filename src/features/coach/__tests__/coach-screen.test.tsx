import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import CoachScreen from '@/app/(tabs)/coach';
import { AiError } from '@/features/ai/errors';

let mockPaid = true;
let mockHistory: { id: string; role: 'user' | 'assistant'; content: string }[] = [];
const mockStream = jest.fn();

jest.mock('@/features/membership/useTier', () => ({
  useEntitlements: () => ({
    tier: mockPaid ? 'pro' : 'free',
    isPaid: mockPaid,
    can: () => mockPaid,
    isLoading: false,
  }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/profile/api', () => ({
  useProfile: () => ({ data: { display_name: 'Layla A' } }),
}));
jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: async () => ({ data: [...mockHistory].reverse(), error: null }) }),
        }),
      }),
    }),
  },
}));
jest.mock('@/features/ai/api', () => ({ streamCoach: (...a: unknown[]) => mockStream(...a) }));

function renderCoach() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CoachScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockPaid = true;
  mockHistory = [];
  mockStream.mockReset();
});

describe('Coach screen', () => {
  it('is locked for free members', async () => {
    mockPaid = false;
    await renderCoach();
    expect(screen.getByText('Your AI coach is part of Pro')).toBeTruthy();
    expect(screen.getByTestId('open-paywall')).toBeTruthy();
    expect(screen.queryByTestId('coach-input')).toBeNull();
  });

  it('greets the member and shows saved history', async () => {
    mockHistory = [
      { id: '1', role: 'user', content: 'أنا في مطعم الآن، ماذا أطلب؟' },
      { id: '2', role: 'assistant', content: 'اطلب مشاوي مع سلطة.' },
    ];
    await renderCoach();
    expect(screen.getByText(/Hi Layla! I'm your coach/)).toBeTruthy();
    expect(await screen.findByText('اطلب مشاوي مع سلطة.')).toBeTruthy();
  });

  it('streams the reply into a bubble as it arrives', async () => {
    let finish: () => void = () => {};
    mockStream.mockImplementation((req: { message: string }, onDelta: (t: string) => void) => {
      onDelta('Use the ');
      onDelta('leg press.');
      return new Promise((resolve) => {
        finish = () => resolve({ id: 'm1' });
      });
    });
    await renderCoach();
    await fireEvent.changeText(screen.getByTestId('coach-input'), '  The rack is busy ');
    await fireEvent.press(screen.getByTestId('coach-send'));
    expect(mockStream.mock.calls[0][0]).toMatchObject({
      message: 'The rack is busy',
      localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(await screen.findByText('Use the leg press.')).toBeTruthy();
    expect(screen.getByTestId('coach-stop')).toBeTruthy();
    expect(screen.getByTestId('coach-input').props.value).toBe('');
    await act(async () => finish());
    await waitFor(() => expect(screen.getByTestId('coach-send')).toBeTruthy());
  });

  it('sends a suggestion chip', async () => {
    mockStream.mockResolvedValue({ id: 'm2' });
    await renderCoach();
    await fireEvent.press(screen.getByText('Make my program harder'));
    expect(mockStream.mock.calls[0][0].message).toBe('Make my program harder');
  });

  it('explains when the daily limit is reached', async () => {
    mockStream.mockRejectedValue(new AiError('quota_exceeded'));
    await renderCoach();
    await fireEvent.changeText(screen.getByTestId('coach-input'), 'hello');
    await fireEvent.press(screen.getByTestId('coach-send'));
    expect(await screen.findByText(/reached today's limit/)).toBeTruthy();
  });
});
