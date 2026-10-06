import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps as RNTextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import type { Palette, TypographyVariant } from '@/theme/tokens';

// Layout uses start/end (never left/right) so it mirrors correctly in Arabic.

interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: keyof Palette;
}

export function Text({ variant = 'body', color = 'ink', style, ...rest }: TextProps) {
  const { typography, colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={2}
      style={[typography[variant], { color: colors[color], textAlign: 'auto' }, style]}
      {...rest}
    />
  );
}

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
}: PropsWithChildren<{ scroll?: boolean; edges?: Edge[] }>) {
  const { colors, spacing } = useTheme();
  const content = { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md };
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Panel({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  testID?: string;
  /** Defaults to the visible label. */
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: primary ? colors.accent : 'transparent',
        borderWidth: primary ? 0 : 1.5,
        borderColor: colors.line,
        opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
      })}>
      {loading ? <ActivityIndicator color={primary ? colors.onAccent : colors.ink} /> : icon}
      <Text variant="label" style={{ fontSize: 17 }} color={primary ? 'onAccent' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          typography.body,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.warn : colors.line,
            borderWidth: 1.5,
            borderRadius: radius.sm,
            padding: spacing.md,
            textAlign: 'auto',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="small" color="warn" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T | null;
  error?: string;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: SegmentedProps<T>) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: spacing.xs + 2 }}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={{
                flex: 1,
                paddingHorizontal: spacing.xs,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.sm,
                borderWidth: 1.5,
                borderColor: selected ? colors.accent : colors.line,
                backgroundColor: selected ? colors.accent : 'transparent',
              }}>
              <Text
                variant="label"
                color={selected ? 'onAccent' : 'ink'}
                style={{ textAlign: 'center' }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text variant="small" color="warn" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Highlighted notice (prototype .alert). */
export function Notice({ children, tone = 'high' }: PropsWithChildren<{ tone?: keyof Palette }>) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        borderStartWidth: 5,
        borderStartColor: colors[tone],
        backgroundColor: colors.soft,
        borderRadius: radius.sm,
        padding: spacing.md,
      }}>
      <Text variant="body" style={{ fontSize: 15 }}>
        {children}
      </Text>
    </View>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.sm / 2,
          borderWidth: 2,
          borderColor: checked ? colors.accent : colors.line,
          backgroundColor: checked ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {checked ? (
          <Text variant="label" color="onAccent" style={{ lineHeight: 18 }}>
            ✓
          </Text>
        ) : null}
      </View>
      <Text style={{ flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

export function StepHeader({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ flexDirection: 'row', gap: spacing.xs + 2, marginBottom: spacing.xs }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 3,
            backgroundColor: i < current ? colors.accent : colors.line,
          }}
        />
      ))}
    </View>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingVertical: spacing.sm,
        alignSelf: 'flex-start',
        minHeight: 44,
        justifyContent: 'center',
      }}>
      <Text variant="label" color="accent">
        {label}
      </Text>
    </Pressable>
  );
}

export function ProgressBar({
  value,
  color = 'ok',
  height = 10,
  label,
}: {
  /** 0 to 1 */
  value: number;
  color?: keyof Palette;
  height?: number;
  label?: string;
}) {
  const { colors } = useTheme();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{
        height,
        backgroundColor: colors.soft,
        borderRadius: height / 2,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: colors[color],
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={{ flex: 1 }}>
      <Text variant="title" style={{ fontSize: 26, lineHeight: 30 }}>
        {value}
      </Text>
      <Text variant="small" color="muted">
        {label}
      </Text>
    </View>
  );
}

export function Pill({ label, dot }: { label: string; dot?: keyof Palette }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        alignSelf: 'flex-start',
        backgroundColor: colors.soft,
        borderRadius: radius.pill,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md - 2,
      }}>
      {dot ? (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors[dot] }} />
      ) : null}
      <Text variant="label" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </View>
  );
}

/** Round check button (prototype .chk). */
export function CheckButton({
  checked,
  onPress,
  label,
  size = 32,
  testID,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
  size?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: checked ? colors.ok : colors.line,
        backgroundColor: checked ? colors.ok : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {checked ? (
        <Text variant="label" color="onAccent">
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}
