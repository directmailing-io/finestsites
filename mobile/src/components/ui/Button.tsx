import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type HostInstance, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, hit, radius, shadows } from '@/theme/tokens';

import { Text } from './Text';

/**
 * Buttons exakt wie im Dashboard:
 * - primary:   #111827, weiß, fett, rounded-2xl, min-h-12   („Bearbeiten“)
 * - accent:    #7C3AED mit violettem Schatten, min-h-14     („Neue Webseite erstellen“)
 * - secondary: #F1F5F9, dunkler Text, halbfett              („Seite ansehen“, „Link kopieren“)
 * - muted:     #F3F4F6, #374151                             (Einstellungen „Foto ändern“)
 * - success:   #DCFCE7/#15803D                              („Link kopiert“)
 * - danger:    #DC2626, weiß                                („Ja, löschen“)
 * - outline:   weiß mit Rahmen #E5E7EB                      („Abbrechen“)
 * - dangerText / link: nur Text
 */
export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'muted'
  | 'success'
  | 'danger'
  | 'outline'
  | 'dangerText'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  haptic?: boolean;
}

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border?: string; font: string; shadow?: ViewStyle }> = {
  primary: { bg: colors.ink, fg: colors.white, font: fonts.bold },
  accent: { bg: colors.accent, fg: colors.white, font: fonts.bold, shadow: shadows.accentButton },
  secondary: { bg: colors.surfaceSoft, fg: colors.ink, font: fonts.semibold },
  muted: { bg: colors.muted, fg: colors.body, font: fonts.semibold },
  success: { bg: colors.successSoft, fg: colors.success, font: fonts.semibold },
  danger: { bg: colors.dangerStrong, fg: colors.white, font: fonts.bold },
  outline: { bg: colors.white, fg: colors.ink, border: colors.border, font: fonts.semibold },
  dangerText: { bg: 'transparent', fg: colors.dangerStrong, font: fonts.semibold },
  link: { bg: 'transparent', fg: colors.secondary, font: fonts.medium },
};

const SIZES: Record<ButtonSize, { minHeight: number; px: number; fontSize: number; icon: number; radius: number }> = {
  sm: { minHeight: hit.min, px: 14, fontSize: 14, icon: 15, radius: radius.buttonSmall },
  md: { minHeight: hit.primary, px: 16, fontSize: 15, icon: 17, radius: radius.button },
  lg: { minHeight: hit.large, px: 28, fontSize: 16, icon: 20, radius: radius.button },
};

export const Button = forwardRef<HostInstance, Props>(function Button(
  {
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    loading,
    disabled,
    fullWidth,
    style,
    accessibilityLabel,
    accessibilityHint,
    haptic = false,
  },
  ref,
) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const inactive = disabled || loading;
  const isText = variant === 'link' || variant === 'dangerText';

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        if (haptic) void Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      hitSlop={isText ? 8 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: s.minHeight,
          paddingHorizontal: isText ? 4 : s.px,
          borderRadius: s.radius,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
        },
        !inactive && v.shadow,
        fullWidth && styles.full,
        inactive && styles.disabled,
        pressed && !inactive && (isText ? styles.pressedText : styles.pressed),
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        Icon && <Icon size={s.icon} color={v.fg} strokeWidth={2.25} />
      )}
      <Text
        numberOfLines={2}
        style={[
          { fontFamily: v.font, fontSize: s.fontSize, lineHeight: s.fontSize + 5, color: v.fg },
          variant === 'link' && styles.underline,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  full: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  pressedText: { opacity: 0.6 },
  underline: { textDecorationLine: 'underline' },
});
