import { memo } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent, type AccessibilityActionInfo } from 'react-native';

import type { ChatConversation } from '@/api/types';
import { Text } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

import { ChatAvatar } from './ChatAvatar';
import { listTime, previewOf } from './helpers';

/**
 * Zeile wie WhatsApp mit den Werten aus „Anfragen“: Avatar 52 mit Online-Punkt, Name fett bei ungelesen,
 * Zeit rechts, Vorschau einzeilig („Du: “ bei eigener Nachricht), Badge mit Zahl, Seitentitel klein.
 * accessibilityActions: VoiceOver-Aktionen (Archivieren/Löschen/Gelesen) ohne Wischen – siehe SwipeableConversationRow.
 */
export const ChatConversationRow = memo(function ChatConversationRow({
  c,
  selected,
  onPress,
  accessibilityActions,
  onAccessibilityAction,
}: {
  c: ChatConversation;
  selected?: boolean;
  onPress: () => void;
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (e: AccessibilityActionEvent) => void;
}) {
  const unread = c.unread > 0;
  const name = c.visitor.displayName;
  const preview = previewOf(c);
  const time = c.lastMessage ? listTime(c.lastMessage.at) : listTime(c.updatedAt);
  const marker = c.status === 'blocked' ? 'Gesperrt' : c.status === 'archived' ? 'Archiviert' : c.reportedAt ? 'Gemeldet' : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? `${c.unread} ungelesen. ` : ''}${name}, ${time}. ${preview}. ${c.siteTitle}`}
      accessibilityState={{ selected: !!selected }}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      style={({ pressed }) => [styles.row, (pressed || selected) && styles.active]}>
      <ChatAvatar visitor={c.visitor} size={52} />
      <View style={styles.content}>
        <View style={styles.line}>
          <Text
            numberOfLines={1}
            style={[styles.name, { fontFamily: unread ? fonts.bold : fonts.medium, color: unread ? colors.inkStrong : colors.ink }]}>
            {name}
          </Text>
          <Text style={[styles.time, { color: unread ? colors.foreground : colors.faint, fontFamily: unread ? fonts.semibold : fonts.regular }]}>
            {time}
          </Text>
        </View>
        <View style={styles.line}>
          <Text numberOfLines={1} style={[styles.preview, { color: unread ? colors.body : colors.mutedForeground, fontFamily: unread ? fonts.medium : fonts.regular }]}>
            {preview}
          </Text>
          {unread && (
            <View style={styles.badge} accessibilityElementsHidden>
              <Text style={styles.badgeText}>{c.unread > 99 ? '99+' : String(c.unread)}</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={styles.meta}>
          {c.siteTitle}
          {marker ? ` · ${marker}` : ''}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 76,
    borderRadius: 16,
  },
  active: { backgroundColor: colors.white },
  content: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  time: { fontSize: 12 },
  preview: { flex: 1, fontSize: 14, lineHeight: 19 },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.foreground, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, color: colors.white },
  meta: { fontFamily: fonts.medium, fontSize: 11, color: colors.tertiary },
});
