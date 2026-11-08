import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { theme } from '../theme';

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'quiet' | 'danger';
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        kind === 'primary' && styles.primaryButton,
        kind === 'quiet' && styles.quietButton,
        kind === 'danger' && styles.dangerButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
      ]}
    >
      <Text style={[
        styles.buttonText,
        kind === 'primary' && styles.primaryText,
        kind === 'danger' && styles.dangerText,
      ]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  multiline,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={error ? 'Erro: ' + error : undefined}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={theme.color.muted}
        style={[styles.input, multiline && styles.multiline, error && styles.inputError]}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Notice({
  children,
  tone = 'info',
}: PropsWithChildren<{ tone?: 'info' | 'warning' | 'success' | 'error' }>) {
  const toneStyle = {
    info: styles.noticeInfo,
    warning: styles.noticeWarning,
    success: styles.noticeSuccess,
    error: styles.noticeError,
  }[tone];
  return <View accessibilityLiveRegion="polite" style={[styles.notice, toneStyle]}><Text style={styles.noticeText}>{children}</Text></View>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.line,
    borderWidth: 1,
    borderRadius: theme.radius.card,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: theme.space.md,
    paddingVertical: 12,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: { backgroundColor: theme.color.ink, borderColor: theme.color.ink },
  quietButton: { backgroundColor: theme.color.surface },
  dangerButton: { backgroundColor: '#FFF1EE', borderColor: '#F0C4BB' },
  disabledButton: { opacity: 0.48 },
  pressedButton: { opacity: 0.78 },
  buttonText: { color: theme.color.ink, fontWeight: '700', fontSize: 14 },
  primaryText: { color: theme.color.surface },
  dangerText: { color: theme.color.danger },
  field: { gap: 6 },
  label: { color: theme.color.ink, fontWeight: '700', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: theme.color.surface,
    color: theme.color.ink,
    fontSize: 15,
  },
  multiline: { minHeight: 92, paddingTop: 12 },
  inputError: { borderColor: theme.color.danger },
  error: { color: theme.color.danger, fontSize: 12 },
  eyebrow: { color: theme.color.coral, fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  notice: { padding: 13, borderRadius: theme.radius.control, borderWidth: 1 },
  noticeInfo: { backgroundColor: '#EAF0F4', borderColor: '#CBD8E0' },
  noticeWarning: { backgroundColor: '#FFF7D9', borderColor: '#E6D38C' },
  noticeSuccess: { backgroundColor: '#E7F3ED', borderColor: '#BFD9CA' },
  noticeError: { backgroundColor: '#FFF0ED', borderColor: '#EFC7BF' },
  noticeText: { color: theme.color.ink, fontSize: 13, lineHeight: 19 },
  sectionTitle: { gap: 6, marginBottom: 4 },
  sectionHeading: { color: theme.color.ink, fontWeight: '800', fontSize: theme.type.section },
  subtitle: { color: theme.color.muted, fontSize: 13, lineHeight: 19 },
});
