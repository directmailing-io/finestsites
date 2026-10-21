import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ConversationSummary } from '@/api/types';
import { Text } from '@/components/ui';
import { chatTitle, supportTime } from '@/lib/format';
import { colors, fonts } from '@/theme/tokens';

import { chatPreviewText } from './ChatText';

const AVATAR = require('../../../assets/support/avatar.jpg');

/** Foto des Support-Teams wie SupportAvatar im Web. */
export function SupportAvatar({ size }: { size: number }) {
  return <Image source={AVATAR} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityIgnoresInvertColors />;
}

/** Vorschau der letzten Nachricht wie truncatePreview() im Web. */
function preview(c: ConversationSummary) {
  const m = c.lastMessage;
  if (!m) return 'Kein Inhalt';
  if (m.contentType === 'image') return '📷 Bild';
  if (m.contentType === 'system') return '🔐 Zugriffsanfrage';
  const t = chatPreviewText(m.content, m.senderType === 'admin');
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

/**
 * Gesprächskarte wie ConvRow im Web (support/page.tsx): weiße Karte, Support-Foto, Titel, Uhrzeit,
 * letzte Nachricht, darunter „Gespräch löschen“ (zweistufig).
 */
export function ConversationRow({
  c,
  selected,
  onPress,
  onDelete,
}: {
  c: ConversationSummary;
  selected?: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const time = c.lastMessageAt ?? c.lastMessage?.createdAt ?? null;
  return (
    <View style={[styles.card, selected && styles.selected]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${chatTitle(c.subject, c.createdAt)}${c.unreadByUser ? `, ${c.unreadByUser} neu` : ''}`}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
        <SupportAvatar size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.top}>
            <Text numberOfLines={1} style={styles.title}>
              {chatTitle(c.subject, c.createdAt)}
            </Text>
            <View style={styles.meta}>
              {c.unreadByUser > 0 && (
                <View style={styles.unread}>
                  <Text style={styles.unreadText}>{c.unreadByUser}</Text>
                </View>
              )}
              <Text style={styles.time}>{time ? supportTime(time) : ''}</Text>
            </View>
          </View>
          <Text numberOfLines={1} style={styles.preview}>
            {preview(c)}
          </Text>
        </View>
      </Pressable>
      {onDelete &&
        (confirmDel ? (
          <View style={styles.confirm}>
            <Pressable onPress={() => setConfirmDel(false)} style={[styles.confirmBtn, { backgroundColor: colors.muted }]} accessibilityRole="button">
              <Text style={[styles.confirmText, { color: colors.body }]}>Abbrechen</Text>
            </Pressable>
            <Pressable onPress={onDelete} style={[styles.confirmBtn, { backgroundColor: '#FEE2E2' }]} accessibilityRole="button">
              <Text style={[styles.confirmText, { color: colors.dangerStrong }]}>Löschen</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmDel(true)} style={styles.delete} accessibilityRole="button">
            <Text style={styles.deleteText}>Gespräch löschen</Text>
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  selected: { borderWidth: 1.5, borderColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: '#111111' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unread: { backgroundColor: '#111111', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  unreadText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
  time: { fontFamily: fonts.regular, fontSize: 11, color: colors.faint },
  preview: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#777777', marginTop: 3 },
  delete: { paddingVertical: 8, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#F5F5F5', minHeight: 36, justifyContent: 'center' },
  deleteText: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint },
  confirm: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  confirmBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', minHeight: 36, justifyContent: 'center' },
  confirmText: { fontFamily: fonts.semibold, fontSize: 13 },
});
