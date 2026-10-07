import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, Notice, Panel, Screen, Text, TextField } from '@/components/ui';
import { ScanPhoto } from '@/features/onboarding/ScanPhoto';
import { LIMITS } from '@/features/onboarding/validation';
import { buildPlan } from '@/features/plan/engine';
import { useActivePlan } from '@/features/profile/api';
import { useRecordScan, useScans } from '@/features/progress/api';
import {
  emptyRescan,
  latestScan,
  planChanges,
  rescanInput,
  validateRescan,
  type RescanDraft,
  type RescanField,
} from '@/features/progress/rescan';
import { useTheme } from '@/theme/ThemeProvider';

const FIELDS: {
  field: RescanField;
  label: 'weight' | 'bodyFat' | 'muscle' | 'bmr';
  keyboard: 'decimal-pad' | 'number-pad';
  required?: boolean;
}[] = [
  { field: 'weightKg', label: 'weight', keyboard: 'decimal-pad', required: true },
  { field: 'bodyFatPct', label: 'bodyFat', keyboard: 'decimal-pad' },
  { field: 'skeletalMuscleKg', label: 'muscle', keyboard: 'decimal-pad' },
  { field: 'bmrKcal', label: 'bmr', keyboard: 'number-pad' },
];

/** A new body scan: the member confirms the numbers, sees what changes, and saves. */
export default function RescanScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const active = useActivePlan();
  const scans = useScans();
  const record = useRecordScan();
  const [draft, setDraft] = useState<RescanDraft>(emptyRescan);
  const [submitted, setSubmitted] = useState(false);
  const update = (patch: Partial<RescanDraft>) => setDraft((d) => ({ ...d, ...patch }));

  if (active.isPending || scans.isPending) {
    return (
      <Screen edges={[]}>
        <ActivityIndicator />
      </Screen>
    );
  }
  const current = active.data;
  if (!current) {
    return (
      <Screen edges={[]}>
        <Text color="muted">{t('plan.notFound')}</Text>
      </Screen>
    );
  }

  const last = latestScan(scans.data ?? []);
  const unit: Record<RescanField, string> = {
    weightKg: t('common.kg'),
    bodyFatPct: '%',
    skeletalMuscleKg: t('common.kg'),
    bmrKcal: t('common.kcal'),
  };
  const errors = validateRescan(draft);
  const shownErrors = submitted ? errors : {};
  const valid = Object.keys(errors).length === 0;
  const hideCalories = current.plan.safety.hideCalories;
  const changes = valid
    ? planChanges(current.plan, buildPlan(rescanInput(current.input, draft)))
    : [];
  const fields = FIELDS.filter((f) => !(hideCalories && f.field === 'bmrKcal'));

  function save() {
    setSubmitted(true);
    if (!valid || !current) return;
    record.mutate({ current, draft }, { onSuccess: () => router.replace('/plan') });
  }

  return (
    <Screen edges={['bottom']}>
      <Text color="muted">{t('rescan.subtitle')}</Text>
      <Panel style={{ gap: spacing.md }}>
        <ScanPhoto
          onRead={(r, path) => {
            const s = (v: number | null) => (v == null ? '' : String(v));
            update({
              weightKg: r.weight_kg == null ? draft.weightKg : s(r.weight_kg),
              bodyFatPct: s(r.body_fat_percent),
              skeletalMuscleKg: s(r.skeletal_muscle_kg),
              bmrKcal: s(r.bmr_kcal),
              photoPath: path,
              aiReading: { ...r },
            });
          }}
        />
        {fields.map(({ field, label, keyboard, required }) => {
          const previous = last?.[field];
          const error = shownErrors[field];
          return (
            <TextField
              key={field}
              testID={`rescan-${field}`}
              label={
                required
                  ? t(`rescan.${label}`)
                  : `${t(`rescan.${label}`)} · ${t('common.optional')}`
              }
              placeholder={
                previous != null && !hideCalories
                  ? t('rescan.lastTime', { value: `${previous} ${unit[field]}` })
                  : undefined
              }
              value={draft[field]}
              onChangeText={(value) => update({ [field]: value })}
              error={
                error === 'required'
                  ? t('rescan.weightRequired')
                  : error
                    ? t('onboarding.errors.outOfRange', LIMITS[field])
                    : undefined
              }
              keyboardType={keyboard}
            />
          );
        })}
      </Panel>

      {changes.length ? (
        <Panel>
          <Text variant="heading" accessibilityRole="header">
            {t('rescan.newPlan')}
          </Text>
          {changes.map((c) => (
            <View
              key={c.key}
              accessible
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
              <Text>{t(`rescan.change.${c.key}`)}</Text>
              <Text variant="label">
                {c.before === c.after
                  ? t('rescan.unchanged', { value: c.after })
                  : t('rescan.fromTo', { from: c.before, to: c.after })}
              </Text>
            </View>
          ))}
          <Text variant="small" color="muted">
            {t('rescan.keepsHistory')}
          </Text>
        </Panel>
      ) : null}

      {record.isError ? <Notice tone="warn">{t('auth.errors.generic')}</Notice> : null}
      <Button
        testID="rescan-save"
        label={t('rescan.save')}
        loading={record.isPending}
        onPress={save}
      />
    </Screen>
  );
}
