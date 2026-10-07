import { parseAuthParams } from '../redirect';
import { MIN_PASSWORD_LENGTH, validateCredentials } from '../validation';

describe('validateCredentials', () => {
  it('accepts a valid email and long enough password', () => {
    expect(validateCredentials(' sam@example.com ', 'x'.repeat(MIN_PASSWORD_LENGTH))).toEqual({});
  });

  it('flags a bad email and a short password', () => {
    expect(validateCredentials('sam@', 'short')).toEqual({
      email: 'emailInvalid',
      password: 'passwordShort',
    });
  });
});

describe('parseAuthParams', () => {
  it('reads the PKCE code and flow id from the query string', () => {
    expect(parseAuthParams('rafiq://auth/callback?code=abc-123&sb_flow_id=f1')).toEqual({
      code: 'abc-123',
      sb_flow_id: 'f1',
    });
  });

  it('reads errors from the fragment and decodes them', () => {
    expect(
      parseAuthParams('rafiq://auth/callback#error=access_denied&error_description=User+said%20no'),
    ).toEqual({ error: 'access_denied', error_description: 'User said no' });
  });

  it('returns an empty object when there are no parameters', () => {
    expect(parseAuthParams('rafiq://auth/callback')).toEqual({});
  });
});
