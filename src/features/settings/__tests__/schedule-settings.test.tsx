import { fireEvent, render, screen } from '@testing-library/react-native';

import { useSettings } from '@/stores/settings';

import { ScheduleSettings } from '../ScheduleSettings';

const mockMutate = jest.fn();
const mockRequest = jest.fn();

jest.mock('@/features/today/api', () => ({
  useSchedule: () => ({ schedule: { wakeTime: '06:30', workoutTime: '17:30' }, ramadan: false }),
  useUpdateSchedule: () => ({ mutate: mockMutate, isPending: false, isSuccess: false }),
}));
jest.mock('@/features/reminders/notifications', () => ({
  requestPermission: () => mockRequest(),
}));

beforeEach(() => {
  mockMutate.mockReset();
  mockRequest.mockReset();
  useSettings.setState({ remindersEnabled: false });
});

describe('ScheduleSettings', () => {
  it('starts from the saved times and saves tidied-up times', async () => {
    await render(<ScheduleSettings />);
    expect(screen.getByTestId('wake-time').props.value).toBe('06:30');
    await fireEvent.changeText(screen.getByTestId('wake-time'), '5:45');
    await fireEvent.changeText(screen.getByTestId('workout-time'), '0700');
    await fireEvent.press(screen.getByTestId('save-schedule'));
    expect(mockMutate).toHaveBeenCalledWith({ wakeTime: '05:45', workoutTime: '07:00' });
  });

  it('rejects a workout outside the waking day', async () => {
    await render(<ScheduleSettings />);
    await fireEvent.changeText(screen.getByTestId('workout-time'), '06:45');
    await fireEvent.press(screen.getByTestId('save-schedule'));
    expect(screen.getByText(/between 1 and 15 hours after you wake up/)).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('turns reminders on only when the phone allows it', async () => {
    mockRequest.mockResolvedValue(false);
    await render(<ScheduleSettings />);
    await fireEvent.press(screen.getByLabelText('On'));
    expect(useSettings.getState().remindersEnabled).toBe(false);
    expect(await screen.findByText(/Notifications are off for Rafiq/)).toBeTruthy();

    mockRequest.mockResolvedValue(true);
    await fireEvent.press(screen.getByLabelText('On'));
    expect(useSettings.getState().remindersEnabled).toBe(true);
  });
});
