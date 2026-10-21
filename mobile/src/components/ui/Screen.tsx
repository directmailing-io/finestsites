import { useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayout } from '@/lib/layout';
import { colors, readableWidth } from '@/theme/tokens';

import { Text } from './Text';

interface Props extends Omit<ScrollViewProps, 'refreshControl'> {
  children: ReactNode;
  /** Inhalt auf iPad mittig mit max. ~720 pt (Formulare, Konto, Partner) */
  readable?: boolean;
  /** Breiter Inhalt (Seiten-Raster): max. 1280 */
  wide?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Bildschirme ohne native Kopfzeile brauchen oben den Sicherheitsabstand */
  topInset?: boolean;
}

/**
 * Scrollbarer Bildschirm mit Hintergrund #FAFAFA, Rändern wie im Dashboard (20 / 32 pt)
 * und Pull-to-Refresh. Passt sich jeder Fenstergröße an (320 pt bis Vollbild).
 */
export function Screen({
  children,
  readable,
  wide,
  refreshing,
  onRefresh,
  contentStyle,
  topInset,
  ...rest
}: Props) {
  const { gutter } = useLayout();
  const insets = useSafeAreaInsets();
  // Kreisel nur beim Herunterziehen zeigen, nicht bei jedem Nachladen im Hintergrund (Tab-Wechsel)
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (!refreshing) setPulling(false);
  }, [refreshing]);
  const pull = () => {
    setPulling(true);
    onRefresh?.();
  };
  const maxWidth = readable ? readableWidth : wide ? 1280 : 1024;
  return (
    <ScrollView
      {...rest}
      style={styles.flex}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={pulling && !!refreshing} onRefresh={pull} tintColor={colors.faint} /> : undefined
      }
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: gutter, paddingTop: topInset ? insets.top + 16 : 16 },
      ]}>
      <View style={[styles.inner, { maxWidth }, contentStyle]}>{children}</View>
    </ScrollView>
  );
}

/** Seitenkopf wie die h1 im Dashboard: text-2xl/3xl bold, Untertitel slate-500. */
export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text variant="bodyLarge" color={colors.secondary}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Abschnittskopf wie TabSection in den Einstellungen. */
export function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text variant="callout">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 48, flexGrow: 1 },
  inner: { width: '100%', alignSelf: 'center', gap: 24 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  section: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: -8 },
});
