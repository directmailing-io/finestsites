import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors, radius } from '@/theme/tokens';

import { STEPS, type Step } from './steps';

/** Rahmen der Ersteinrichtung: mittig (max. 440 pt), Schritt-Punkte, Symbol, Titel, Text. */
export function OnboardingFrame({
  step,
  icon: Icon,
  iconBg = colors.accentSoft,
  iconColor = colors.accent,
  title,
  text,
  children,
}: {
  step: Step;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const idx = STEPS.indexOf(step);
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <View style={styles.dots} accessibilityLabel={`Schritt ${idx + 1} von ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <View key={s} style={[styles.dot, i <= idx && { backgroundColor: colors.ink }, i === idx && { width: 24 }]} />
            ))}
          </View>
          <View style={[styles.icon, { backgroundColor: iconBg }]}>
            <Icon size={26} color={iconColor} strokeWidth={2} />
          </View>
          <Text variant="display" align="center" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="callout" align="center" color={colors.mutedForeground} style={{ marginBottom: 12 }}>
            {text}
          </Text>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: 20, justifyContent: 'center' },
  inner: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 12 },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center', marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  icon: { width: 56, height: 56, borderRadius: radius.input, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
