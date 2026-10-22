import { StyleSheet, View } from 'react-native';

import type { ChatVisitor } from '@/api/types';
import { Text } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

import { visitorColor } from './helpers';

/** Avatar-Kreis mit Initialen in stabiler Farbe, optional mit grünem Online-Punkt (wie WhatsApp). */
export function ChatAvatar({ visitor, size = 52, showOnline = true }: { visitor: ChatVisitor; size?: number; showOnline?: boolean }) {
  const c = visitorColor(visitor);
  const dot = Math.max(10, Math.round(size * 0.26));
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }]}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.36, color: c.fg, letterSpacing: -0.2 }}>{visitor.initials}</Text>
      </View>
      {showOnline && visitor.online && (
        <View style={[styles.online, { width: dot, height: dot, borderRadius: dot / 2, borderWidth: Math.max(2, Math.round(dot * 0.18)) }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  online: { position: 'absolute', right: -1, bottom: -1, backgroundColor: colors.successDot, borderColor: colors.white },
});
