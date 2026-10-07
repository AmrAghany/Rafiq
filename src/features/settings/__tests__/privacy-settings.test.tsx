import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';

import { AiError } from '@/features/ai/errors';

import { PrivacySettings } from '../PrivacySettings';

const mockCall = jest.fn();
const mockSignOut = jest.fn();
jest.mock('@/features/ai/api', () => ({ callFunction: (...a: unknown[]) => mockCall(...a) }));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: (...a: unknown[]) => mockSignOut(...a) } },
}));

beforeEach(() => {
  mockCall.mockReset();
  mockSignOut.mockReset();
});

describe('PrivacySettings', () => {
  it('exports the member’s data through the share sheet', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    mockCall.mockResolvedValue({ user_id: 'u1', plans: [] });
    await render(<PrivacySettings />);
    await fireEvent.press(screen.getByTestId('export-data'));
    expect(mockCall).toHaveBeenCalledWith('export-data', {});
    expect(share).toHaveBeenCalledWith({
      title: 'Rafiq data export',
      message: JSON.stringify({ user_id: 'u1', plans: [] }, null, 2),
    });
  });

  it('deletes the account only after confirmation, then signs out', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockCall.mockResolvedValue({ deleted: true });
    await render(<PrivacySettings />);
    await fireEvent.press(screen.getByTestId('delete-account'));
    expect(mockCall).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Delete']);
    await act(async () => {
      await buttons[1].onPress!();
    });
    expect(mockCall).toHaveBeenCalledWith('delete-account', { confirm: 'DELETE' });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('shows a failure and stays signed in', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockCall.mockRejectedValue(new AiError('network'));
    await render(<PrivacySettings />);
    await fireEvent.press(screen.getByTestId('delete-account'));
    await act(async () => {
      await alert.mock.calls.at(-1)![2]![1].onPress!();
    });
    expect(await screen.findByText(/No connection/)).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
