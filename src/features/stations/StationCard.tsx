import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, LinkButton, Notice, Panel, Text, TextField } from '@/components/ui';
import { exerciseName } from '@/features/plan/names';
import { isolate } from '@/i18n/bidi';

import {
  normaliseCode,
  useEndPairing,
  usePairStation,
  type PairError,
  type StationPairing,
} from './api';

/**
 * Train tab, at partner gyms: pair with a smart station by typing the code on its
 * screen, and the station logs your barbell sets while you lift.
 */
export function StationCard({ pairing }: { pairing: StationPairing | null }) {
  const { t, i18n } = useTranslation();
  const pair = usePairStation();
  const end = useEndPairing();
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);

  if (pairing) {
    const lifts = pairing.exercise_keys
      .map((k) => exerciseName(k, i18n.language))
      .join(i18n.language === 'ar' ? '، ' : ', ');
    return (
      <Panel>
        <Text variant="heading" accessibilityRole="header">
          {t('stations.pairedTitle', { station: isolate(pairing.label) })}
        </Text>
        <Text testID="station-paired" accessibilityLiveRegion="polite">
          {t('stations.pairedBody', { gym: isolate(pairing.gym_name), lifts })}
        </Text>
        <LinkButton label={t('stations.end')} onPress={() => end.mutate()} />
      </Panel>
    );
  }

  const errorCode = invalid ? 'invalid_code' : (pair.error?.message as PairError | undefined);
  return (
    <Panel>
      <Text variant="heading" accessibilityRole="header">
        {t('stations.title')}
      </Text>
      <Text variant="small" color="muted">
        {t('stations.body')}
      </Text>
      <TextField
        testID="station-code"
        label={t('stations.codeLabel')}
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setInvalid(false);
        }}
        keyboardType="number-pad"
        maxLength={7}
        textContentType="oneTimeCode"
      />
      {errorCode ? <Notice tone="warn">{t(`stations.errors.${errorCode}`)}</Notice> : null}
      <Button
        testID="station-pair"
        variant="ghost"
        label={t('stations.pair')}
        loading={pair.isPending}
        onPress={() => {
          const clean = normaliseCode(code);
          if (!clean) return setInvalid(true);
          pair.mutate(clean, { onSuccess: () => setCode('') });
        }}
      />
    </Panel>
  );
}
