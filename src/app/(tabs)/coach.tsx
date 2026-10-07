import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Notice, Text } from '@/components/ui';
import { textDirection } from '@/features/ai/sse';
import { useChatHistory, useCoachChat } from '@/features/coach/api';
import { LockedCard } from '@/features/membership/LockedCard';
import { useEntitlements } from '@/features/membership/useTier';
import { useProfile } from '@/features/profile/api';
import { useTheme } from '@/theme/ThemeProvider';

const MAX_CHARS = 2000;

function Bubble({
  role,
  text,
  testID,
}: {
  role: 'user' | 'assistant';
  text: string;
  testID?: string;
}) {
  const { colors, radius, spacing } = useTheme();
  const mine = role === 'user';
  const dir = textDirection(text);
  return (
    <View
      testID={testID}
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '86%',
        backgroundColor: mine ? colors.accent : colors.surface,
        borderColor: colors.line,
        borderWidth: mine ? 0 : 1,
        borderRadius: radius.lg,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md + 1,
      }}>
      <Text
        color={mine ? 'onAccent' : 'ink'}
        selectable
        style={{ writingDirection: dir, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
        {text}
      </Text>
    </View>
  );
}

export default function CoachScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { can, isLoading: tierLoading } = useEntitlements();
  const unlocked = can('ai_coach');
  const { data: profile } = useProfile();
  // Free members see the locked card; don't load chat history for them.
  const history = useChatHistory({ enabled: unlocked });
  const { send, stop, pending, error, clearError } = useCoachChat();
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [history.data?.length, pending?.reply]);

  const name = profile?.display_name?.split(' ')[0] ?? '';
  const chips = t('coach.chips', { returnObjects: true }) as string[];

  if (tierLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!unlocked) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md }}>
        <Text variant="title" accessibilityRole="header">
          {t('tabs.coach')}
        </Text>
        <LockedCard title={t('coach.lockedTitle')} body={t('coach.lockedBody')} />
      </SafeAreaView>
    );
  }

  const submit = (text: string) => {
    if (!text.trim() || pending) return;
    clearError();
    void send(text);
    setDraft('');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          keyboardShouldPersistTaps="handled">
          <Text variant="title" accessibilityRole="header">
            {t('tabs.coach')}
          </Text>
          <Bubble role="assistant" text={t('coach.greeting', { name })} />
          {history.isPending ? <ActivityIndicator /> : null}
          {(history.data ?? []).map((m) => (
            <Bubble key={m.id} role={m.role} text={m.content} />
          ))}
          {pending ? (
            <>
              <Bubble role="user" text={pending.question} />
              {pending.reply ? (
                <Bubble testID="streaming-reply" role="assistant" text={pending.reply} />
              ) : (
                <View style={{ alignSelf: 'flex-start', padding: spacing.sm }}>
                  <Text color="muted" accessibilityLiveRegion="polite">
                    {t('coach.thinking')}
                  </Text>
                </View>
              )}
            </>
          ) : null}
          {error ? <Notice tone="warn">{t(`ai.errors.${error.code}`)}</Notice> : null}
          <Text
            variant="small"
            color="muted"
            style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {t('app.notMedicalAdvice')}
          </Text>
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.bg,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
          }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.xs + 2 }}>
            {chips.map((chip) => (
              <Pressable
                key={chip}
                accessibilityRole="button"
                disabled={!!pending}
                onPress={() => submit(chip)}
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.line,
                  backgroundColor: colors.surface,
                  borderRadius: radius.pill,
                  paddingVertical: 7,
                  paddingHorizontal: spacing.md,
                  opacity: pending ? 0.5 : 1,
                }}>
                <Text
                  variant="small"
                  style={{ fontSize: 14, writingDirection: textDirection(chip) }}>
                  {chip}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
            <TextInput
              testID="coach-input"
              accessibilityLabel={t('coach.placeholder')}
              placeholder={t('coach.placeholder')}
              placeholderTextColor={colors.muted}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={MAX_CHARS}
              style={{
                flex: 1,
                maxHeight: 120,
                color: colors.ink,
                backgroundColor: colors.surface,
                borderColor: colors.line,
                borderWidth: 1.5,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
                fontSize: 16,
                writingDirection: draft ? textDirection(draft) : undefined,
                textAlign: draft ? (textDirection(draft) === 'rtl' ? 'right' : 'left') : 'auto',
              }}
            />
            <View style={{ minWidth: 92 }}>
              {pending ? (
                <Button
                  testID="coach-stop"
                  variant="ghost"
                  label={t('coach.stop')}
                  onPress={stop}
                />
              ) : (
                <Button
                  testID="coach-send"
                  label={t('coach.send')}
                  disabled={!draft.trim()}
                  onPress={() => submit(draft)}
                />
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
