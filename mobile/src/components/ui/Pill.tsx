import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

import { Text } from './Text';

export type PillTone = 'online' | 'draft' | 'offline' | 'changes' | 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'archived';

/** Farben aus STATUS_META (sites/page.tsx) und den Badges im Dashboard. */
const TONES: Record<PillTone, { bg: string; fg: string; dot?: string }> = {
  online: { bg: colors.successSoft, fg: colors.success, dot: colors.successDot },
  draft: { bg: colors.surfaceSoft, fg: colors.neutralPill, dot: colors.neutralDot },
  offline: { bg: colors.dangerSoft, fg: colors.danger, dot: colors.dangerStrong },
  changes: { bg: colors.warningSoft, fg: colors.warning, dot: colors.warningDot },
  neutral: { bg: colors.surfaceSoft, fg: colors.neutralPill },
  accent: { bg: colors.accentSoft, fg: colors.accentDeep },
  success: { bg: '#ECFDF5', fg: '#065F46' },
  warning: { bg: colors.warningSoft, fg: '#B45309' },
  info: { bg: colors.infoSoft, fg: colors.info },
  archived: { bg: '#FEF3C7', fg: '#92400E' },
};

interface Props {
  label: string;
  tone?: PillTone;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Status-Pill: text-xs font-bold px-2.5 py-1 rounded-full, optional mit Punkt. */
export function Pill({ label, tone = 'neutral', dot, style }: Props) {
  const t = TONES[tone];
  const showDot = dot ?? !!t.dot;
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]} accessibilityLabel={label}>
      {showDot && <View style={[styles.dot, { backgroundColor: t.dot ?? t.fg }]} />}
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/** Rote Zähl-Badge (Anfragen) wie in der Seitenleiste. */
export function CountBadge({ count, inverted }: { count: number; inverted?: boolean }) {
  if (count <= 0) return null;
  return (
    <View style={[styles.count, { backgroundColor: inverted ? colors.ink : '#FEE2E2' }]}>
      <Text style={[styles.countText, { color: inverted ? colors.white : colors.dangerStrong }]}>
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14 },
});
