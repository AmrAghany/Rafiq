import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Share } from 'react-native';

import { Button, Notice, Panel, Text } from '@/components/ui';
import { callFunction } from '@/features/ai/api';
import { AiError } from '@/features/ai/errors';
import { supabase } from '@/lib/supabase';

/** Data export and account deletion (both run in Edge Functions). */
export function PrivacySettings() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<null | 'export' | 'delete'>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) =>
    setError(t(`ai.errors.${e instanceof AiError ? e.code : 'internal'}`));

  async function exportData() {
    setError(null);
    setBusy('export');
    try {
      const data = await callFunction<unknown>('export-data', {});
      await Share.share({ title: t('me.exportTitle'), message: JSON.stringify(data, null, 2) });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setError(null);
    setBusy('delete');
    try {
      await callFunction('delete-account', { confirm: 'DELETE' });
      // The account no longer exists on the server; clear the local session.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      fail(e);
      setBusy(null);
    }
  }

  function confirmDelete() {
    Alert.alert(t('me.deleteConfirmTitle'), t('me.deleteBody'), [
      { text: t('me.cancel'), style: 'cancel' },
      { text: t('me.deleteConfirm'), style: 'destructive', onPress: () => void deleteAccount() },
    ]);
  }

  return (
    <Panel>
      <Text variant="heading" accessibilityRole="header">
        {t('me.privacy')}
      </Text>
      <Button
        testID="export-data"
        variant="ghost"
        label={t('me.export')}
        loading={busy === 'export'}
        disabled={!!busy}
        onPress={() => void exportData()}
      />
      <Text variant="small" color="muted">
        {t('me.deleteBody')}
      </Text>
      <Button
        testID="delete-account"
        variant="ghost"
        label={t('me.delete')}
        loading={busy === 'delete'}
        disabled={!!busy}
        onPress={confirmDelete}
      />
      {error ? <Notice tone="warn">{error}</Notice> : null}
    </Panel>
  );
}
