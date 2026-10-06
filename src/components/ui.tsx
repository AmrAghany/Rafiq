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
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  testID,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
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
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
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
              onPress={() => onChange(o.value)}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.sm,
                borderWidth: 1.5,
                borderColor: selected ? colors.accent : colors.line,
                backgroundColor: selected ? colors.accent : 'transparent',
              }}>
              <Text variant="label" color={selected ? 'onAccent' : 'ink'}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
