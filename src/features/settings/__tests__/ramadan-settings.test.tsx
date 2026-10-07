import { fireEvent, render, screen } from '@testing-library/react-native';

import { RamadanSettings } from '../RamadanSettings';

const mockMutate = jest.fn();
let mockOn = false;

jest.mock('@/features/today/api', () => ({
  useSchedule: () => ({
    schedule: { wakeTime: '06:30', workoutTime: '17:30' },
    ramadan: mockOn,
    ramadanTimes: { suhoorTime: '03:45', iftarTime: '18:05' },
  }),
  useUpdateRamadan: () => ({ mutate: mockMutate, isPending: false, isError: false }),
}));

beforeEach(() => {
  mockMutate.mockReset();
  mockOn = false;
});

describe('RamadanSettings', () => {
  it('turns Ramadan mode on', async () => {
    await render(<RamadanSettings />);
    expect(screen.queryByTestId('suhoor-time')).toBeNull();
    await fireEvent.press(screen.getByLabelText('On'));
    expect(mockMutate).toHaveBeenCalledWith({ ramadan_mode: true });
  });

  it('saves tidied-up suhoor and iftar times when on', async () => {
    mockOn = true;
    await render(<RamadanSettings />);
    expect(screen.getByTestId('suhoor-time').props.value).toBe('03:45');
    await fireEvent.changeText(screen.getByTestId('suhoor-time'), '4:10');
    await fireEvent.changeText(screen.getByTestId('iftar-time'), '1812');
    await fireEvent.press(screen.getByTestId('save-ramadan'));
    expect(mockMutate).toHaveBeenCalledWith(
      { suhoor_time: '04:10', iftar_time: '18:12' },
      expect.anything(),
    );
  });

  it('rejects an implausible fast', async () => {
    mockOn = true;
    await render(<RamadanSettings />);
    await fireEvent.changeText(screen.getByTestId('iftar-time'), '11:00');
    await fireEvent.press(screen.getByTestId('save-ramadan'));
    expect(screen.getByText(/10 to 18 hours after suhoor/)).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
