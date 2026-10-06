import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

import { parseAuthParams } from './redirect';

export class AuthCancelledError extends Error {
  constructor() {
    super('auth_cancelled');
  }
}

/** Deep link Supabase redirects back to after browser OAuth (add it to the allowed redirect URLs). */
export const authRedirectUrl = () => Linking.createURL('auth/callback');

async function signInWithBrowser(provider: 'google' | 'apple') {
  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new AuthCancelledError();

  const params = parseAuthParams(result.url);
  if (params.error) throw new Error(params.error_description || params.error);
  if (!params.code) throw new Error('Missing auth code in redirect');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code, {
    flowId: params.sb_flow_id,
  });
  if (exchangeError) throw exchangeError;
}

export function signInWithGoogle() {
  return signInWithBrowser('google');
}

/** Native Sign in with Apple on iOS; browser OAuth elsewhere. */
export async function signInWithApple() {
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) {
    return signInWithBrowser('apple');
  }

  // Apple receives the hashed nonce; Supabase verifies the raw one against the token.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new AuthCancelledError();
    throw e;
  }
  if (!credential.identityToken) throw new Error('Apple did not return an identity token');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}
