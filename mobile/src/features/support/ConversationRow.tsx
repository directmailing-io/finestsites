import { Pressable, StyleSheet, View } from 'react-native';

import type { ConversationSummary } from '@/api/types';
import { CountBadge, Text } from '@/components/ui';
import { chatTitle, smartTime } from '@/lib/format';
import { colors, fonts } from '@/theme/tokens';

import { chatPreviewText } from './ChatText';

function preview(c: ConversationSummary) {
  const m = c.lastMessage;
  if (!m) return 'Noch keine Nachrichten';
  if (m.contentType === 'image') return '📷 Bild';
  if (m.contentType === 'system') return '🔐 Zugriffsanfrage';
  const t = chatPreviewText(m.content, m.senderType === 'admin');
  return t.length > 60 ? `${t.slice(0, 60)}…` : t;
}

const STATUS = {
  open: { color: '#22C55E', label: 'Offen' },
  waiting: { color: '#F59E0B', label: 'Wartend' },
  closed: { color: '#D1D5DB', label: 'Geschlossen' },
} as const;

export function ConversationRow({ c, selected, onPress }: { c: ConversationSummary; selected?: boolean; onPress: () => void }) {
  const st = STATUS[c.status] ?? STATUS.closed;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${chatTitle(c.subject, c.createdAt)}, ${st.label}${c.unreadByUser ? `, ${c.unreadByUser} neu` : ''}`}
      style={({ pressed }) => [styles.row, (pressed || selected) && { backgroundColor: colors.white }]}>
      <View style={[styles.dot, { backgroundColor: st.color }]} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.top}>
          <Text numberOfLines={1} style={[styles.title, c.unreadByUser > 0 && { fontFamily: fonts.bold }]}>
            {chatTitle(c.subject, c.createdAt)}
          </Text>
          <Text variant="footnote">{smartTime(c.updatedAt ?? c.createdAt)}</Text>
        </View>
        <View style={styles.top}>
          <Text numberOfLines={1} variant="callout" style={{ flex: 1 }}>
            {preview(c)}
          </Text>
          <CountBadge count={c.unreadByUser} inverted />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 14, minHeight: 64, borderRadius: 16 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
