import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import AboutStep from '@/app/(onboarding)/about';
import SummaryStep from '@/app/(onboarding)/summary';

import { useOnboarding } from '../store';
import { emptyDraft, type OnboardingDraft } from '../validation';

const mockPush = jest.fn();
const mockRpc = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`redirect:${href}`}</Text>;
  },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));

const complete: OnboardingDraft = {
  ...emptyDraft,
  name: 'Sam',
  sex: 'male',
  birthDay: '14',
  birthMonth: '2',
  birthYear: '1997',
  heightCm: '178',
  weightKg: '82',
  goal: 'recomp',
  trainingDays: 4,
  experience: 'intermediate',
  medicalNoticeAcceptedAt: '2026-10-06T08:00:00.000Z',
};

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  useOnboarding.getState().reset();
  mockPush.mockReset();
  mockRpc.mockReset();
});

describe('About step', () => {
  it('shows every missing answer and does not continue', async () => {
    await render(<AboutStep />);
    await fireEvent.press(screen.getByTestId('about-next'));
    expect(screen.getByText('Add your first name.')).toBeTruthy();
    expect(screen.getByText('Check your date of birth.')).toBeTruthy();
    expect(screen.getByText('Enter a height between 120 and 230 cm.')).toBeTruthy();
    expect(screen.getByText('Choose your main goal.')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('blocks members under 18', async () => {
    const year = String(new Date().getFullYear() - 16);
    useOnboarding.getState().update({ ...complete, birthYear: year });
    await render(<AboutStep />);
    await fireEvent.press(screen.getByTestId('about-next'));
    expect(screen.getByTestId('birth-error')).toHaveTextContent(/Rafiq is for adults 18 and over/);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('collects answers through the form and moves to the scan step', async () => {
    await render(<AboutStep />);
    await fireEvent.changeText(screen.getByTestId('name-input'), 'Sam');
    await fireEvent.press(screen.getByLabelText('Male'));
    await fireEvent.changeText(screen.getByTestId('birth-day'), '14');
    await fireEvent.changeText(screen.getByTestId('birth-month'), '2');
    await fireEvent.changeText(screen.getByTestId('birth-year'), '1997');
    await fireEvent.changeText(screen.getByTestId('height-input'), '178');
    await fireEvent.changeText(screen.getByTestId('weight-input'), '82');
    await fireEvent.press(screen.getByLabelText('Both'));
    await fireEvent.press(screen.getByLabelText('4 days'));
    await fireEvent.press(screen.getByLabelText('Intermediate'));
    await fireEvent.press(screen.getByTestId('about-next'));
    expect(mockPush).toHaveBeenCalledWith('/scan');
    expect(useOnboarding.getState().draft).toMatchObject({
      sex: 'male',
      goal: 'recomp',
      trainingDays: 4,
      experience: 'intermediate',
    });
  });
});

describe('Summary step', () => {
  it('sends the member back to the start if the draft was lost', async () => {
    await renderWithQuery(<SummaryStep />);
    expect(screen.getByText('redirect:/welcome')).toBeTruthy();
  });

  it('shows the plan and saves it in one call', async () => {
    mockRpc.mockResolvedValue({ data: 'plan-id', error: null });
    useOnboarding.getState().update(complete);
    await renderWithQuery(<SummaryStep />);
    expect(screen.getByText('Sam, your plan is ready')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('start-my-day'));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    const [fn, args] = mockRpc.mock.calls[0];
    expect(fn).toBe('complete_onboarding');
    expect(args.p_profile).toMatchObject({ display_name: 'Sam', date_of_birth: '1997-02-14' });
    expect(args.p_plan).toMatchObject({ trainingDays: 4, bodyFatAssumed: true });
  });

  it('tells the member when saving fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    useOnboarding.getState().update(complete);
    await renderWithQuery(<SummaryStep />);
    await fireEvent.press(screen.getByTestId('start-my-day'));
    expect(
      await screen.findByText("We couldn't save your plan. Check your connection and try again."),
    ).toBeTruthy();
  });
});
