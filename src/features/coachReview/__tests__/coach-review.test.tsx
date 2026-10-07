import { fireEvent, render, screen } from '@testing-library/react-native';

import ReviewScreen from '@/app/review/[id]';

import type { CoachReview } from '../api';
import { CoachReviewPanel } from '../CoachReviewPanel';
import { ReviewReadyCard } from '../ReviewReadyCard';

const mockPush = jest.fn();
const mockRequest = jest.fn();
const mockMarkRead = jest.fn();
let mockTier: 'pro' | 'elite' = 'elite';
let mockReviews: CoachReview[] = [];
let mockRequestError: Error | null = null;

jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => ({ id: 'r1' }),
}));
jest.mock('@/features/today/api', () => ({ useTodayKey: () => '2026-10-07' }));
jest.mock('@/features/membership/useTier', () => ({
  useEntitlements: () => ({
    tier: mockTier,
    isLoading: false,
    can: (f: string) => f !== 'coach_review' || mockTier === 'elite',
  }),
}));
jest.mock('../api', () => {
  const actual = jest.requireActual('../api');
  return {
    ...actual,
    useMyReviews: () => ({ data: mockReviews, isPending: false }),
    useRequestReview: () => ({ mutate: mockRequest, isPending: false, error: mockRequestError }),
    useMarkReviewRead: () => ({ mutate: mockMarkRead }),
  };
});

const review = (over: Partial<CoachReview> = {}): CoachReview => ({
  id: 'r1',
  period: '2026-10-01',
  status: 'requested',
  member_note: null,
  coach_name: null,
  summary: null,
  training: null,
  nutrition: null,
  focus: null,
  requested_at: '2026-10-05T10:00:00Z',
  delivered_at: null,
  read_at: null,
  ...over,
});

const delivered = review({
  status: 'delivered',
  coach_name: 'Coach Omar',
  summary: 'Strong month.',
  training: 'Pause squats.',
  nutrition: 'شوفان قبل التمرين',
  focus: null,
  delivered_at: '2026-10-08T10:00:00Z',
});

beforeEach(() => {
  [mockPush, mockRequest, mockMarkRead].forEach((m) => m.mockReset());
  mockTier = 'elite';
  mockReviews = [];
  mockRequestError = null;
});

describe('Coach review on Me', () => {
  it('is an Elite upsell for Pro members', async () => {
    mockTier = 'pro';
    await render(<CoachReviewPanel />);
    expect(screen.getByText('A monthly review by a real coach')).toBeTruthy();
    await fireEvent.press(screen.getByText('See Elite'));
    expect(mockPush).toHaveBeenCalledWith('/paywall');
  });

  it('lets an Elite member request this month with a note, after saying what the coach sees', async () => {
    await render(<CoachReviewPanel />);
    expect(screen.getByText(/never sees your chats/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('review-note'), 'Bench has stalled');
    await fireEvent.press(screen.getByTestId('request-review'));
    expect(mockRequest).toHaveBeenCalledWith('Bench has stalled', expect.anything());
  });

  it('explains a failed request', async () => {
    mockRequestError = new Error('already_requested');
    await render(<CoachReviewPanel />);
    expect(screen.getByText("You've already requested this month's review.")).toBeTruthy();
  });

  it('follows the review from request to delivery', async () => {
    mockReviews = [review()];
    await render(<CoachReviewPanel />);
    expect(screen.getByTestId('review-status')).toHaveTextContent(/is requested/);
    expect(screen.queryByTestId('request-review')).toBeNull();

    mockReviews = [review({ status: 'in_review', coach_name: 'Coach Omar' })];
    await render(<CoachReviewPanel />);
    expect(screen.getByTestId('review-status')).toHaveTextContent(
      /\u2068Coach Omar\u2069 is reviewing/,
    );

    mockReviews = [delivered, review({ id: 'r0', period: '2026-09-01', status: 'delivered' })];
    await render(<CoachReviewPanel />);
    await fireEvent.press(screen.getByTestId('open-review'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/review/[id]', params: { id: 'r1' } });
    expect(screen.getByText(/September 2026 review/)).toBeTruthy();
  });
});

describe('Review ready on Today', () => {
  it('shows only for an unread delivered review', async () => {
    mockReviews = [review()];
    await render(<ReviewReadyCard />);
    expect(screen.queryByTestId('read-review-today')).toBeNull();
    mockReviews = [delivered];
    await render(<ReviewReadyCard />);
    expect(screen.getByText('\u2068Coach Omar\u2069 has reviewed your month.')).toBeTruthy();
    mockReviews = [{ ...delivered, read_at: '2026-10-08T12:00:00Z' }];
    await render(<ReviewReadyCard />);
    expect(screen.queryByTestId('read-review-today')).toBeNull();
  });
});

describe('Review screen', () => {
  it("shows the sections, in each text's own direction, and marks the review read", async () => {
    mockReviews = [delivered];
    await render(<ReviewScreen />);
    expect(screen.getByText('October 2026')).toBeTruthy();
    expect(screen.getByTestId('review-summary')).toHaveTextContent('Strong month.');
    expect(screen.getByTestId('review-nutrition').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ writingDirection: 'rtl' })]),
    );
    expect(screen.queryByTestId('review-focus')).toBeNull();
    expect(mockMarkRead).toHaveBeenCalledWith('r1');
  });

  it('never shows an undelivered review', async () => {
    mockReviews = [review({ status: 'in_review' })];
    await render(<ReviewScreen />);
    expect(screen.getByText("This review isn't ready yet.")).toBeTruthy();
    expect(mockMarkRead).not.toHaveBeenCalled();
  });
});
