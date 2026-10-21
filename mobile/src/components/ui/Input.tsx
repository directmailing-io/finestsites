import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { Text } from './Text';

interface Props extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string | null;
  right?: ReactNode;
  left?: ReactNode;
  password?: boolean;
  /** Mehrzeilige Felder (Nachricht) */
  multilineHeight?: number;
}

/**
 * Feld wie in den Einstellungen: Label text-sm font-semibold #374151, Rahmen 1.5px #E5E7EB,
 * beim Fokus #1a1a1a, rounded-2xl, 16 pt Schrift (gut lesbar, kein Zoom).
 */
export const Input = forwardRef<TextInputInstance, Props>(function Input(
  { label, hint, error, right, left, password, multilineHeight, onFocus, onBlur, editable = true, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const borderColor = error ? '#FCA5A5' : focused ? colors.foreground : colors.border;

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.field, { borderColor }, !editable && styles.readonly]}>
        {left}
        <TextInput
          ref={ref}
          {...rest}
          editable={editable}
          secureTextEntry={password && !visible}
          placeholderTextColor={colors.placeholder}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label ?? rest.placeholder}
          style={[
            styles.input,
            multilineHeight ? { minHeight: multilineHeight, textAlignVertical: 'top', paddingTop: 12 } : null,
            !editable && { color: colors.mutedForeground },
          ]}
        />
        {password && (
          <Pressable
            onPress={() => setVisible(v => !v)}
            hitSlop={10}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}>
            {visible ? <EyeOff size={18} color={colors.faint} /> : <Eye size={18} color={colors.faint} />}
          </Pressable>
        )}
        {right}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text variant="footnote" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.label },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.input,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  readonly: { backgroundColor: '#F9FAFB' },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  eye: { paddingHorizontal: 14, alignSelf: 'stretch', justifyContent: 'center' },
  hint: { paddingHorizontal: 4, lineHeight: 17 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.dangerStrong, paddingHorizontal: 4 },
});
