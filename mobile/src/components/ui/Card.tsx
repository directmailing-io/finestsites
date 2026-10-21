import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, shadows } from '@/theme/tokens';

interface Props extends ViewProps {
  /** Rahmen wie Seiten-Karten (1.5px #E2E8F0) oder Einstellungs-Kacheln (1.5px #E5E7EB) */
  tone?: 'site' | 'plain' | 'accent' | 'success' | 'warning' | 'danger' | 'subtle';
  padded?: boolean;
  elevated?: boolean;
  highlight?: boolean;
}

const TONES = {
  site: { bg: colors.card, border: colors.borderCard },
  plain: { bg: colors.card, border: colors.border },
  accent: { bg: colors.accentSoft, border: colors.accentSoftBorder },
  success: { bg: colors.successSoft, border: colors.successBorder },
  warning: { bg: colors.warningWash, border: colors.warningBorder },
  danger: { bg: colors.dangerSoft, border: colors.dangerBorder },
  subtle: { bg: colors.surfaceSubtle, border: colors.border },
} as const;

/** Karte: rounded-3xl (24), Rahmen 1.5px, weicher Schatten wie im Dashboard. */
export function Card({ tone = 'site', padded = true, elevated = true, highlight, style, children, ...rest }: Props) {
  const t = TONES[tone];
  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: t.bg, borderColor: highlight ? colors.successDot : t.border },
        padded && styles.padded,
        elevated && tone !== 'subtle' && shadows.siteCard,
        highlight && styles.highlight,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderWidth: 1.5 },
  padded: { padding: 20 },
  highlight: { borderColor: colors.successDot, shadowColor: colors.successDot, shadowOpacity: 0.3, shadowRadius: 15 },
});
