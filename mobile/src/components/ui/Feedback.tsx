import { AlertCircle, CheckCircle2, Info, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, shadows } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

/** Leerer Zustand wie in „Anfragen“: weiße Icon-Kachel mit Schatten, Titel, Satz, optional Knopf. */
export function EmptyState({
  icon: Icon,
  title,
  text,
  actionTitle,
  onAction,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  actionTitle?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && { paddingVertical: 40 }]}>
      <View style={styles.emptyIcon}>
        <Icon size={26} color={colors.hairline} strokeWidth={1.5} />
      </View>
      <Text variant="headline" style={styles.emptyTitle} align="center">
        {title}
      </Text>
      {text && (
        <Text variant="callout" align="center" style={styles.emptyText}>
          {text}
        </Text>
      )}
      {actionTitle && onAction && <Button title={actionTitle} onPress={onAction} size="sm" style={{ marginTop: 16 }} />}
    </View>
  );
}

/** Pulsierender Platzhalter (animate-pulse, bg-gray-100). */
export function Skeleton({
  width = '100%',
  height = 14,
  radius: r = radius.full,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: colors.muted, opacity }, style]} />;
}

type NoticeTone = 'success' | 'warning' | 'danger' | 'info' | 'accent';

const NOTICE: Record<NoticeTone, { bg: string; border: string; fg: string; icon: LucideIcon }> = {
  success: { bg: colors.successSoft, border: colors.successBorder, fg: colors.successInk, icon: CheckCircle2 },
  warning: { bg: colors.warningWash, border: colors.warningBorder, fg: colors.warningInk, icon: AlertCircle },
  danger: { bg: colors.dangerSoft, border: colors.dangerBorder, fg: colors.dangerInk, icon: AlertCircle },
  info: { bg: colors.infoSoft, border: colors.infoBorder, fg: '#1E3A8A', icon: Info },
  accent: { bg: colors.accentSoft, border: colors.accentSoftBorder, fg: colors.accentDeep, icon: Info },
};

/** Hinweis-Kasten (rounded-2xl, getönte Fläche) wie die Banner im Dashboard. */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const t = NOTICE[tone];
  const Icon = t.icon;
  return (
    <View style={[styles.notice, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityRole="summary">
      <Icon size={18} color={t.fg} strokeWidth={2} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title && <Text style={[styles.noticeTitle, { color: t.fg }]}>{title}</Text>}
        {typeof children === 'string' ? <Text style={[styles.noticeText, { color: t.fg }]}>{children}</Text> : children}
        {action}
      </View>
    </View>
  );
}

/** Fehler beim Laden mit „Nochmal versuchen“. */
export function LoadError({ onRetry, text }: { onRetry: () => void; text?: string }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Konnte nicht geladen werden"
      text={text ?? 'Bitte prüfe deine Internetverbindung.'}
      actionTitle="Nochmal versuchen"
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 72,
    paddingHorizontal: 24,
    borderRadius: radius.card,
    backgroundColor: colors.background,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.input,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...shadows.soft,
  },
  emptyTitle: { fontFamily: fonts.semibold, marginBottom: 4 },
  emptyText: { color: colors.tertiary, maxWidth: 320 },
  notice: { flexDirection: 'row', gap: 12, padding: 14, paddingHorizontal: 16, borderRadius: radius.input, borderWidth: 1.5 },
  noticeTitle: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19 },
  noticeText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
});
