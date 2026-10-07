import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../App';
import { applyLanguage } from '../i18n';
import type { Bundle, QueueItem } from '../types';
import { bundle as baseBundle } from './fixtures';

const api = vi.hoisted(() => ({
  isCoach: vi.fn(),
  fetchQueue: vi.fn(),
  claimReview: vi.fn(),
  releaseReview: vi.fn(),
  fetchBundle: vi.fn(),
  saveReview: vi.fn(),
}));
vi.mock('../api', () => api);

const auth = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: auth.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signInWithPassword: auth.signInWithPassword,
      signOut: auth.signOut,
    },
  },
}));

const item = (over: Partial<QueueItem>): QueueItem => ({
  id: 'r1',
  period: '2026-10-01',
  status: 'requested',
  member_first_name: 'Layla',
  member_note: 'Bench has stalled',
  requested_at: '2026-10-05T10:00:00Z',
  claimed_at: null,
  delivered_at: null,
  is_mine: false,
  ...over,
});

const renderApp = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  );

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  auth.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  auth.session = { user: { id: 'coach-1' } };
  api.isCoach.mockResolvedValue(true);
  api.fetchQueue.mockResolvedValue([item({})]);
  api.fetchBundle.mockResolvedValue(baseBundle);
  applyLanguage('en');
});
afterEach(cleanup);

describe('coach console', () => {
  it('asks a signed-out visitor to sign in', async () => {
    auth.session = null;
    renderApp();
    await userEvent.type(await screen.findByLabelText('Email'), 'omar@gym.com');
    await userEvent.type(screen.getByLabelText('Password'), 'long-enough-pw');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'omar@gym.com',
      password: 'long-enough-pw',
    });
  });

  it('turns away accounts that are not coaches', async () => {
    api.isCoach.mockResolvedValue(false);
    renderApp();
    expect(await screen.findByText(/isn't a coach account/)).toBeTruthy();
    expect(api.fetchQueue).not.toHaveBeenCalled();
  });

  it("claims a request and opens the member's month", async () => {
    renderApp();
    expect(await screen.findByText('Bench has stalled')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Take this review' }));
    expect(api.claimReview).toHaveBeenCalledWith('r1', expect.anything());
    expect(await screen.findByText('Layla, October 2026')).toBeTruthy();
    expect(screen.getByTestId('weeks').querySelectorAll('tbody tr')).toHaveLength(2);
    expect(screen.getByTestId('lifts').textContent).toContain('Flat bench press');
    expect(screen.getByTestId('scans')).toBeTruthy();
    expect(screen.getByText('1 of 6 planned workouts done')).toBeTruthy();
  });

  it('saves drafts, and sends only with a summary after confirming', async () => {
    api.fetchQueue.mockResolvedValue([item({ status: 'in_review', is_mine: true })]);
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Open' }));
    await screen.findByText('Layla, October 2026');

    await userEvent.click(screen.getByRole('button', { name: 'Send to member' }));
    expect(screen.getByText('Write a summary before sending.')).toBeTruthy();
    expect(api.saveReview).not.toHaveBeenCalled();

    await userEvent.type(screen.getByTestId('field-summary'), 'Strong month.');
    await userEvent.type(screen.getByTestId('field-training'), 'Pause bench.');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(api.saveReview).toHaveBeenLastCalledWith(
      'r1',
      { summary: 'Strong month.', training: 'Pause bench.', nutrition: '', focus: '' },
      false,
    );
    expect(await screen.findByText('Draft saved')).toBeTruthy();

    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    await userEvent.click(screen.getByRole('button', { name: 'Send to member' }));
    expect(api.saveReview).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Send to member' }));
    expect(confirm).toHaveBeenCalledWith(
      "Send this review to Layla? You can't edit it afterwards.",
    );
    expect(api.saveReview).toHaveBeenLastCalledWith('r1', expect.anything(), true);
  });

  it('warns about careful members and hides body numbers for an eating disorder', async () => {
    const careful: Bundle = {
      ...baseBundle,
      profile: { ...baseBundle.profile, health_flags: ['eating_disorder', 'injury'] },
    };
    api.fetchBundle.mockResolvedValue(careful);
    api.fetchQueue.mockResolvedValue([item({ status: 'in_review', is_mine: true })]);
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Open' }));
    const banner = await screen.findByTestId('careful-banner');
    expect(banner.textContent).toContain('no calorie numbers');
    expect(screen.getByText(/Health notes: injury or joint pain/)).toBeTruthy();
    expect(screen.queryByTestId('scans')).toBeNull();
    expect(screen.queryByText('63.5 kg')).toBeNull();
  });

  it('gives a review back to the queue', async () => {
    api.fetchQueue.mockResolvedValue([item({ status: 'in_review', is_mine: true })]);
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Open' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Give back to the queue' }));
    await waitFor(() => expect(api.releaseReview).toHaveBeenCalledWith('r1'));
    expect(await screen.findByText('Open requests')).toBeTruthy();
  });

  it('switches to Arabic, right to left', async () => {
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: 'العربية' }));
    expect(document.documentElement.dir).toBe('rtl');
    expect(await screen.findByText('طلبات مفتوحة')).toBeTruthy();
  });
});
