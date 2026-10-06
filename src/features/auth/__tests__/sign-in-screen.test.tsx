import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/app/(auth)/sign-in';

const mockSignIn = jest.fn();
const mockSignUp = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

beforeEach(() => {
  mockSignIn.mockReset().mockResolvedValue({ data: {}, error: null });
  mockSignUp.mockReset().mockResolvedValue({ data: { session: null }, error: null });
});

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('email-input'), email);
  await fireEvent.changeText(screen.getByTestId('password-input'), password);
  await fireEvent.press(screen.getByTestId('submit-email'));
}

describe('SignInScreen', () => {
  it('shows validation errors and does not call Supabase', async () => {
    await render(<SignInScreen />);
    await fill('not-an-email', 'short');
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('signs in with a trimmed email', async () => {
    await render(<SignInScreen />);
    await fill(' sam@example.com ', 'correct-horse');
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'sam@example.com',
        password: 'correct-horse',
      }),
    );
  });

  it('shows a friendly message for wrong credentials', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: { code: 'invalid_credentials' } });
    await render(<SignInScreen />);
    await fill('sam@example.com', 'wrong-password');
    expect(await screen.findByText('The email or password is not right.')).toBeTruthy();
  });

  it('asks new members to confirm their email after sign-up', async () => {
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText('New to Rafiq? Create an account'));
    await fill('new@example.com', 'long-enough');
    expect(
      await screen.findByText('Check your email to confirm your account, then sign in.'),
    ).toBeTruthy();
    expect(mockSignUp).toHaveBeenCalled();
  });
});
