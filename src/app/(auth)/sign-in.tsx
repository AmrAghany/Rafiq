import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { AuthCancelledError, signInWithApple, signInWithGoogle } from '@/features/auth/oauth';
import {
  MIN_PASSWORD_LENGTH,
  validateCredentials,
  type CredentialErrors,
} from '@/features/auth/validation';
import { isSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

type Mode = 'signIn' | 'signUp';
type Busy = null | 'email' | 'apple' | 'google';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius, scheme } = useTheme();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [message, setMessage] = useState<{ tone: 'warn' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  async function run(kind: Exclude<Busy, null>, action: () => Promise<void>) {
    setBusy(kind);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      const text =
        e instanceof AuthCancelledError
          ? t('auth.errors.cancelled')
          : (e as { code?: string }).code === 'invalid_credentials'
            ? t('auth.errors.invalidCredentials')
            : t('auth.errors.generic');
      setMessage({ tone: 'warn', text });
    } finally {
      setBusy(null);
    }
  }

  function submitEmail() {
    const errors = validateCredentials(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    void run('email', async () => {
      const credentials = { email: email.trim(), password };
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword(credentials);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp(credentials);
        if (error) throw error;
        // With email confirmation on, there is no session until the link is tapped.
        if (!data.session) setMessage({ tone: 'ok', text: t('auth.checkEmail') });
      }
    });
  }

  const fieldError = (key: keyof CredentialErrors) => {
    const code = fieldErrors[key];
    return code ? t(`auth.errors.${code}`, { min: MIN_PASSWORD_LENGTH }) : undefined;
  };

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          marginTop: spacing.xl,
        }}>
        <View
          accessible={false}
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.pill,
            borderWidth: 8,
            borderColor: colors.high,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text variant="heading">R</Text>
        </View>
        <View>
          <Text variant="heading" accessibilityRole="header">
            {t('app.name')}
          </Text>
          <Text variant="small" color="muted">
            {t('app.tagline')}
          </Text>
        </View>
      </View>

      <Text variant="hero">{t('auth.welcomeTitle')}</Text>

      {!isSupabaseConfigured && (
        <Text variant="small" color="warn">
          {t('app.configMissing')}
        </Text>
      )}

      {Platform.OS === 'ios' ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radius.md}
          style={{ height: 50, opacity: busy ? 0.5 : 1 }}
          onPress={() => !busy && void run('apple', signInWithApple)}
        />
      ) : (
        <Button
          variant="ghost"
          label={t('auth.continueWithApple')}
          loading={busy === 'apple'}
          disabled={!!busy}
          onPress={() => void run('apple', signInWithApple)}
        />
      )}
      <Button
        variant="ghost"
        label={t('auth.continueWithGoogle')}
        loading={busy === 'google'}
        disabled={!!busy}
        onPress={() => void run('google', signInWithGoogle)}
      />

      <Text color="muted" style={{ textAlign: 'center' }}>
        {t('auth.or')}
      </Text>

      <Text variant="title" accessibilityRole="header">
        {mode === 'signIn' ? t('auth.signInTitle') : t('auth.signUpTitle')}
      </Text>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={fieldError('email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        testID="email-input"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        error={fieldError('password')}
        secureTextEntry
        autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
        textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
        testID="password-input"
      />

      {message && (
        <Text color={message.tone} accessibilityLiveRegion="polite">
          {message.text}
        </Text>
      )}

      <Button
        testID="submit-email"
        label={mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
        loading={busy === 'email'}
        disabled={!!busy}
        onPress={submitEmail}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setFieldErrors({});
          setMessage(null);
        }}
        style={{ paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' }}>
        <Text variant="label" color="accent" style={{ textAlign: 'center' }}>
          {mode === 'signIn' ? t('auth.noAccount') : t('auth.haveAccount')}
        </Text>
      </Pressable>

      <Text variant="small" color="muted" style={{ textAlign: 'center' }}>
        {t('app.notMedicalAdvice')}
      </Text>
    </Screen>
  );
}
