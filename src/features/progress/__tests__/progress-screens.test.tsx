import { fireEvent, render, screen } from '@testing-library/react-native';

import ProgressScreen from '@/app/progress';
import RescanScreen from '@/app/rescan';
import { buildPlan, type HealthFlag, type PlanInput } from '@/features/plan/engine';

import type { BodyScan } from '../rescan';
import { RescanCard } from '../RescanCard';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRecord = jest.fn();
let mockScans: BodyScan[] = [];
let mockFlags: HealthFlag[] = [];
let mockToday = '2026-09-20';

jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
  },
}));
jest.mock('@/features/today/api', () => ({ useTodayKey: () => mockToday }));
jest.mock('@/features/onboarding/ScanPhoto', () => ({ ScanPhoto: () => null }));
jest.mock('../api', () => ({
  useScans: () => ({ isPending: false, isError: false, data: mockScans }),
  useRecordScan: () => ({ mutate: mockRecord, isPending: false, isError: false }),
}));
jest.mock('@/features/profile/api', () => {
  const { buildPlan: build } = jest.requireActual('@/features/plan/engine');
  return {
    useActivePlan: () => {
      const input = {
        sex: 'male',
        weightKg: 82,
        goal: 'recomp',
        trainingDays: 4,
        experience: 'intermediate',
        bodyFatPct: 18.4,
        bmrKcal: 1810,
        healthFlags: mockFlags,
      };
      return { isPending: false, data: { id: 'p1', version: 2, input, plan: build(input) } };
    },
  };
});

const scan = (scannedOn: string, w: number, bf: number | null, smm: number | null): BodyScan => ({
  id: scannedOn,
  scannedOn,
  source: 'manual',
  weightKg: w,
  bodyFatPct: bf,
  skeletalMuscleKg: smm,
  bmrKcal: null,
});

beforeEach(() => {
  [mockPush, mockReplace, mockRecord].forEach((m) => m.mockReset());
  mockFlags = [];
  mockToday = '2026-09-20';
  mockScans = [scan('2026-08-04', 86, 22.5, 36.1), scan('2026-09-10', 82.5, 19.6, 36.9)];
});

describe('RescanCard', () => {
  it('stays out of the way on Today until a scan is due', async () => {
    await render(<RescanCard />);
    expect(screen.queryByText('Body scan')).toBeNull();
    mockToday = '2026-10-08'; // 28 days after 10 Sep
    await render(<RescanCard />);
    expect(screen.getByText(/Time for a new scan/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('start-rescan'));
    expect(mockPush).toHaveBeenCalledWith('/rescan');
  });

  it('shows the next due date on Me', async () => {
    await render(<RescanCard always />);
    expect(screen.getByText(/Next scan due on/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('open-progress'));
    expect(mockPush).toHaveBeenCalledWith('/progress');
  });

  it('shows nothing before the first scan', async () => {
    mockScans = [];
    await render(<RescanCard always />);
    expect(screen.queryByText('Body scan')).toBeNull();
  });
});

describe('Progress screen', () => {
  it('charts each measurement with a readable summary and lists every scan', async () => {
    await render(<ProgressScreen />);
    expect(screen.getByText('Weight')).toBeTruthy();
    expect(screen.getByText('−3.5 kg since your first scan')).toBeTruthy();
    expect(screen.getByText('+0.8 kg since your first scan')).toBeTruthy();
    const chart = screen.getByTestId('chart-weightKg');
    expect(chart.props.accessibilityLabel).toMatch(
      /Weight chart: 86 kg on .* to 82.5 kg on .*−3.5 kg/,
    );
    expect(screen.getAllByTestId('scan-row')).toHaveLength(2);
  });

  it('reads another scan when its dot is tapped', async () => {
    await render(<ProgressScreen />);
    // Lay the chart out so the dots render.
    await fireEvent(screen.getByTestId('chart-weightKg'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 132 } },
    });
    expect(screen.getByTestId('chart-weightKg-value')).toHaveTextContent(/82.5 kg/);
    const dots = screen.getAllByRole('button', { name: /86 kg/ });
    await fireEvent.press(dots[0]);
    expect(screen.getByTestId('chart-weightKg-value')).toHaveTextContent(/86 kg/);
  });

  it('leaves out body charts for the eating-disorder answer', async () => {
    mockFlags = ['eating_disorder'];
    await render(<ProgressScreen />);
    expect(screen.queryByTestId('chart-weightKg')).toBeNull();
    expect(screen.queryAllByTestId('scan-row')).toHaveLength(0);
    expect(screen.getByText(/how you feel and how your training goes/)).toBeTruthy();
  });
});

describe('Rescan screen', () => {
  it('needs a weight, previews the new plan and saves it', async () => {
    await render(<RescanScreen />);
    expect(screen.getByTestId('rescan-weightKg').props.placeholder).toBe('Last time: 82.5 kg');
    await fireEvent.press(screen.getByTestId('rescan-save'));
    expect(screen.getByText('Enter your weight to rebuild your plan.')).toBeTruthy();
    expect(mockRecord).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('rescan-weightKg'), '79.5');
    await fireEvent.changeText(screen.getByTestId('rescan-bodyFatPct'), '16.2');
    expect(screen.getByText('Your new plan')).toBeTruthy();
    const input: PlanInput = {
      sex: 'male',
      weightKg: 82,
      goal: 'recomp',
      trainingDays: 4,
      experience: 'intermediate',
      bodyFatPct: 18.4,
      bmrKcal: 1810,
      healthFlags: [],
    };
    const before = buildPlan(input).targetKcal;
    const after = buildPlan({
      ...input,
      weightKg: 79.5,
      bodyFatPct: 16.2,
      bmrKcal: null,
    }).targetKcal;
    expect(screen.getByText(`${before} → ${after}`)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('rescan-save'));
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ weightKg: '79.5', bodyFatPct: '16.2' }),
      }),
      expect.anything(),
    );
    mockRecord.mock.calls[0][1].onSuccess();
    expect(mockReplace).toHaveBeenCalledWith('/plan');
  });

  it('shows no calorie or body numbers for careful flags', async () => {
    mockFlags = ['eating_disorder'];
    await render(<RescanScreen />);
    expect(screen.queryByTestId('rescan-bmrKcal')).toBeNull();
    expect(screen.getByTestId('rescan-weightKg').props.placeholder).toBeUndefined();
    await fireEvent.changeText(screen.getByTestId('rescan-weightKg'), '79.5');
    expect(screen.queryByText('Daily calories')).toBeNull();
    expect(screen.queryByText(/kcal/)).toBeNull();
  });
});
