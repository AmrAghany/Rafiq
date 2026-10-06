import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, Notice, Text, TextField } from '@/components/ui';
import { callFunction } from '@/features/ai/api';
import { AiError } from '@/features/ai/errors';
import { pickPhoto, PhotoError, uploadPhoto, type PhotoSource } from '@/features/ai/photos';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

export interface Estimate {
  name: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence: 'low' | 'medium' | 'high';
}

interface Props {
  onEstimate: (
    estimate: Estimate,
    origin: { source: 'text' | 'photo'; photoPath: string | null },
  ) => void;
}

/** Describe a meal or photograph it; the result pre-fills the log form for checking. */
export function MealEstimate({ onEstimate }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { session } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'warn' | 'medium'; text: string } | null>(null);

  async function run(photoSource: PhotoSource | null) {
    setMessage(null);
    try {
      let photoPath: string | null = null;
      if (photoSource) {
        const photo = await pickPhoto(photoSource);
        if (!photo) return;
        setBusy(true);
        photoPath = await uploadPhoto('meal-photos', session!.user.id, photo.base64);
      } else {
        setBusy(true);
      }
      const res = await callFunction<{ estimate: Estimate | null }>('meal-estimate', {
        text: text.trim() || undefined,
        photoPath: photoPath ?? undefined,
      });
      if (!res.estimate) {
        setMessage({ tone: 'medium', text: t('food.aiNotRecognised') });
        return;
      }
      onEstimate(res.estimate, { source: photoPath ? 'photo' : 'text', photoPath });
      setText('');
      setMessage({
        tone: 'medium',
        text:
          res.estimate.confidence === 'low'
            ? `${t('food.aiCheck')} ${t('food.aiConfidenceLow')}`
            : t('food.aiCheck'),
      });
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
      <Text variant="label">{t('food.aiTitle')}</Text>
      <TextField
        testID="ai-describe"
        label={t('food.aiDescribe')}
        placeholder={t('food.aiDescribePlaceholder')}
        value={text}
        onChangeText={setText}
        maxLength={500}
      />
      <Button
        testID="ai-estimate"
        label={t('food.aiEstimate')}
        disabled={busy || !text.trim()}
        onPress={() => void run(null)}
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            variant="ghost"
            label={t('food.aiCamera')}
            disabled={busy}
            onPress={() => void run('camera')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="ghost"
            label={t('food.aiLibrary')}
            disabled={busy}
            onPress={() => void run('library')}
          />
        </View>
      </View>
      {busy ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <ActivityIndicator />
          <Text color="muted">{t('food.aiWorking')}</Text>
        </View>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </View>
  );
}
