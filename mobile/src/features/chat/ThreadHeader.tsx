import { Ellipsis } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ChatConversation } from '@/api/types';
import { Text } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

import { ChatAvatar } from './ChatAvatar';
import { presenceText } from './helpers';

/**
 * Kopf eines Gesprächs: Avatar, Name, online-Punkt bzw. „zuletzt online …“, Seitenhost.
 * compact = als Titel der nativen Kopfzeile (iPhone); sonst eigene Leiste im iPad-Fenster mit „…“-Menü.
 */
export function ThreadHeader({ conversation: c, compact, onMenu }: { conversation: ChatConversation; compact?: boolean; onMenu?: () => void }) {
  const presence = presenceText(c.visitor);
  const status = c.status === 'blocked' ? 'Besucher gesperrt' : c.status === 'archived' ? 'Archiviert' : presence;
  const dotColor = c.status === 'open' && c.visitor.online ? colors.successDot : null;
  const body = (
    <>
      <ChatAvatar visitor={c.visitor} size={compact ? 34 : 42} showOnline={false} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[styles.name, compact && { fontSize: 15, lineHeight: 19 }]}>
          {c.visitor.displayName}
        </Text>
        <View style={styles.statusLine}>
          {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
          <Text numberOfLines={1} style={[styles.status, { color: dotColor ? colors.successDot : colors.secondary }]}>
            {status}
            {!compact ? ` · ${c.siteHost}` : ''}
          </Text>
        </View>
      </View>
    </>
  );

  if (compact) {
    return (
      <View style={styles.compact} accessibilityRole="header" accessibilityLabel={`${c.visitor.displayName}, ${status}`}>
        {body}
      </View>
    );
  }
  return (
    <View style={styles.bar}>
      <View style={styles.barInner} accessibilityRole="header" accessibilityLabel={`${c.visitor.displayName}, ${status}, ${c.siteHost}`}>
        {body}
      </View>
      {onMenu && (
        <Pressable onPress={onMenu} style={({ pressed }) => [styles.menu, pressed && { backgroundColor: colors.muted }]} accessibilityRole="button" accessibilityLabel="Mehr Aktionen">
          <Ellipsis size={20} color={colors.ink} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 260 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  barInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  name: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, color: colors.ink },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  status: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, flexShrink: 1 },
  menu: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
