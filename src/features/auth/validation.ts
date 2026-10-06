export const MIN_PASSWORD_LENGTH = 8;

export type CredentialError = 'emailInvalid' | 'passwordShort';

export interface CredentialErrors {
  email?: CredentialError;
  password?: CredentialError;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email: string, password: string): CredentialErrors {
  const errors: CredentialErrors = {};
  if (!EMAIL_RE.test(email.trim())) errors.email = 'emailInvalid';
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = 'passwordShort';
  return errors;
}
