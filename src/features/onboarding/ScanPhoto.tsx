import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, Notice, Text } from '@/components/ui';
import { callFunction } from '@/features/ai/api';
import { AiError } from '@/features/ai/errors';
import { pickPhoto, PhotoError, uploadPhoto, type PhotoSource } from '@/features/ai/photos';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTier } from '@/features/membership/useTier';
import { useTheme } from '@/theme/ThemeProvider';

import { useOnboarding } from './store';

interface Reading {
  weight_kg: number | null;
  body_fat_percent: number | null;
  skeletal_muscle_kg: number | null;
  bmr_kcal: number | null;
}

/**
 * Reads the InBody sheet from a photo and fills the scan fields. The member always sees
 * and can correct the numbers before continuing.
 */
export function ScanPhoto() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { session } = useAuth();
  const { isPaid } = useTier();
  const update = useOnboarding((s) => s.update);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'warn' | 'medium' | 'ok'; text: string } | null>(
    null,
  );

  if (!isPaid) {
    return <Notice tone="medium">{t('onboarding.scan.photoLocked')}</Notice>;
  }

  async function read(source: PhotoSource) {
    setMessage(null);
    try {
      const photo = await pickPhoto(source);
      if (!photo) return;
      setBusy(true);
      const path = await uploadPhoto('scan-photos', session!.user.id, photo.base64);
      const res = await callFunction<{ reading: Reading | null }>('scan-read', { photoPath: path });
      if (!res.reading) {
        setMessage({ tone: 'warn', text: t('onboarding.scan.photoNotRecognised') });
        return;
      }
      const r = res.reading;
      const s = (v: number | null) => (v == null ? '' : String(v));
      update({
        bodyFatPct: s(r.body_fat_percent),
        skeletalMuscleKg: s(r.skeletal_muscle_kg),
        bmrKcal: s(r.bmr_kcal),
        scanPhotoPath: path,
        scanAiReading: { ...r },
      });
      setMessage({ tone: 'ok', text: t('onboarding.scan.photoRead') });
    } catch (e) {
      const key =
        e instanceof PhotoError
          ? (`ai.photoErrors.${e.code}` as const)
          : (`ai.errors.${e instanceof AiError ? e.code : 'internal'}` as const);
      setMessage({ tone: 'warn', text: t(key) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label">{t('onboarding.scan.photoTitle')}</Text>
      <Button
        testID="scan-camera"
        label={t('onboarding.scan.photoCamera')}
        disabled={busy}
        onPress={() => void read('camera')}
      />
      <Button
        variant="ghost"
        label={t('onboarding.scan.photoLibrary')}
        disabled={busy}
        onPress={() => void read('library')}
      />
      {busy ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <ActivityIndicator />
          <Text color="muted">{t('onboarding.scan.photoReading')}</Text>
        </View>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </View>
  );
}
