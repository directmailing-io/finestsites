import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { Text } from './Text';

/**
 * Gruppierte Liste im iOS-Einstellungsstil, gezeichnet mit den Werten der Webapp:
 * weiße Fläche, Rahmen 1.5px #E5E7EB, rounded-2xl, Trennlinien #F1F5F9.
 */
export function ListSection({
  title,
  footer,
  children,
  style,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.section, style]}>
      {title && (
        <Text variant="overline" style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
      )}
      <View style={styles.group}>
        {items.map((child, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={styles.divider} />}
            {child}
          </Fragment>
        ))}
      </View>
      {footer && (
        <Text variant="footnote" style={styles.footer}>
          {footer}
        </Text>
      )}
    </View>
  );
}

interface RowProps {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  right?: ReactNode;
  accessibilityHint?: string;
  disabled?: boolean;
}

export function ListRow({
  title,
  subtitle,
  value,
  icon: Icon,
  iconColor = colors.ink,
  iconBg = colors.muted,
  onPress,
  chevron = !!onPress,
  destructive,
  right,
  accessibilityHint,
  disabled,
}: RowProps) {
  const content = (
    <>
      {Icon && (
        <View style={[styles.icon, { backgroundColor: iconBg }]}>
          <Icon size={17} color={destructive ? colors.dangerStrong : iconColor} strokeWidth={2} />
        </View>
      )}
      <View style={styles.texts}>
        <Text style={[styles.title, destructive && { color: colors.dangerStrong }]}>{title}</Text>
        {subtitle ? <Text variant="callout" style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text variant="callout" style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {chevron && <ChevronRight size={18} color={colors.faint} strokeWidth={2} />}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && { opacity: 0.5 }]}>
      {content}
    </Pressable>
  );
}

export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
  badge,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <View style={styles.titleLine}>
          <Text style={styles.title}>{title}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle ? <Text variant="callout" style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.successDot, false: '#D1D5DB' }}
        ios_backgroundColor="#D1D5DB"
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { paddingHorizontal: 4 },
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.divider, marginLeft: 16 },
  footer: { paddingHorizontal: 4, lineHeight: 17 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  pressed: { backgroundColor: colors.background },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.ink },
  subtitle: { color: colors.mutedForeground },
  value: { color: colors.secondary, maxWidth: '45%' },
  badge: { backgroundColor: colors.muted, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.mutedForeground },
});
