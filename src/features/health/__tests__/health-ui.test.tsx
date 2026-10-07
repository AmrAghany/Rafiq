import * as HealthConnect from 'react-native-health-connect';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { HealthSettings } from '@/features/settings/HealthSettings';
import { emptyDailyLog } from '@/features/today/api';
import { CheckinCard, HealthCard } from '@/features/today/components';
import { useSettings } from '@/stores/settings';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const setOS = (os: 'ios' | 'android') =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

beforeEach(() => {
  setOS('ios');
  useSettings.setState({ healthEnabled: false });
});

describe('Check-in with Health', () => {
  it('pre-selects the sleep answer from last night and lets the member change it', async () => {
    const onSave = jest.fn();
    await render(
      <CheckinCard
        log={emptyDailyLog}
        onSave={onSave}
        sleepMinutes={412}
        healthProvider="apple_health"
      />,
    );
    expect(screen.getByTestId('sleep-from-health')).toHaveTextContent(
      "6 h 52 min of sleep from Apple Health. Change the answer if it doesn't feel right.",
    );
    expect(screen.getByRole('radio', { name: 'OK' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Normal' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'None' }));
    await fireEvent.press(screen.getByTestId('checkin-submit'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ sleep: 2, energy: 2, soreness: 3 }),
    );

    onSave.mockReset();
    await fireEvent.press(screen.getByRole('radio', { name: 'Great' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Normal' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'None' }));
    await fireEvent.press(screen.getByTestId('checkin-submit'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sleep: 3 }));
  });

  it('asks as before without Health data', async () => {
    await render(<CheckinCard log={emptyDailyLog} onSave={jest.fn()} />);
    expect(screen.queryByTestId('sleep-from-health')).toBeNull();
    expect(screen.getByRole('radio', { name: 'OK' }).props.accessibilityState.selected).toBe(false);
  });

  it('shows sleep and steps on Today only when recorded', async () => {
    await render(
      <HealthCard health={{ sleep_minutes: 460, steps: 6240, health_source: 'health_connect' }} />,
    );
    expect(screen.getByLabelText('7 h 40 min sleep last night')).toBeTruthy();
    expect(screen.getByLabelText('6,240 steps today')).toBeTruthy();
    expect(screen.getByText('From Health Connect')).toBeTruthy();
    await render(<HealthCard health={{ sleep_minutes: null, steps: null, health_source: null }} />);
    expect(screen.queryByText(/From/)).toBeNull();
  });
});

describe('Health settings', () => {
  it('connects Apple Health', async () => {
    await render(<HealthSettings />);
    await fireEvent.press(screen.getByTestId('connect-health'));
    expect(useSettings.getState().healthEnabled).toBe(true);
  });

  it('explains a missing Health Connect app on Android', async () => {
    setOS('android');
    jest.mocked(HealthConnect.getSdkStatus).mockResolvedValueOnce(1);
    await render(<HealthSettings />);
    expect(screen.getByText('Health Connect')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('connect-health'));
    expect(await screen.findByText(/Install Health Connect from Google Play/)).toBeTruthy();
    expect(useSettings.getState().healthEnabled).toBe(false);
  });

  it('does not turn on when the member refuses on Android', async () => {
    setOS('android');
    jest.mocked(HealthConnect.requestPermission).mockResolvedValueOnce([]);
    await render(<HealthSettings />);
    await fireEvent.press(screen.getByTestId('connect-health'));
    expect(await screen.findByText(/didn't get access/)).toBeTruthy();
    expect(useSettings.getState().healthEnabled).toBe(false);
  });

  it('can be turned off', async () => {
    useSettings.setState({ healthEnabled: true });
    await render(<HealthSettings />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Off' }));
    expect(useSettings.getState().healthEnabled).toBe(false);
  });
});
