import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter, type Href } from 'expo-router';
import { Bell, Globe, Handshake, Inbox, MessageCircle, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { markNotificationsRead } from '@/api/endpoints';
import { qk, useNotifications } from '@/api/queries';
import { EmptyState, LoadError, Screen, Skeleton, Text } from '@/components/ui';
import { smartTime } from '@/lib/format';
import { routeFromNotification } from '@/lib/push';
import { colors, fonts, radius } from '@/theme/tokens';

/** Symbol je Mitteilungs-Typ (src/lib/push/triggers.ts); unbekannte Typen → Glocke. */
function iconFor(type: string): LucideIcon {
  if (type === 'submission') return Inbox;
  if (type === 'support_reply' || type === 'impersonation_request') return MessageCircle;
  if (type === 'domain_active' || type.startsWith('site')) return Globe;
  if (type.startsWith('partner') || type.startsWith('commission') || type.startsWith('affiliate')) return Handshake;
  return Bell;
}

/** Mitteilungen der letzten Zeit (dieselben Inhalte wie die Push-Mitteilungen). */
export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const q = useNotifications();
  const items = q.data?.items ?? [];
  const unread = q.data?.unreadCount ?? 0;

  // Beim Verlassen alles als gelesen markieren
  useEffect(
    () => () => {
      if (unread > 0) {
        void markNotificationsRead({ all: true })
          .catch(() => {})
          .then(() => {
            void qc.invalidateQueries({ queryKey: qk.notifications });
            void qc.invalidateQueries({ queryKey: qk.overview });
          });
      }
    },
    [unread, qc],
  );

  return (
    <Screen readable refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: 'Mitteilungen' }} />
      {q.isError && !q.data ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : q.isLoading ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={72} radius={radius.input} />
          <Skeleton height={72} radius={radius.input} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="Keine Mitteilungen" text="Neue Anfragen und Antworten vom Support erscheinen hier." />
      ) : (
        <View style={styles.group}>
          {items.map((n, i) => {
            const Icon = iconFor(n.type);
            const href = routeFromNotification(n.data);
            return (
              <Pressable
                key={n.id}
                disabled={!href}
                onPress={() => href && router.navigate(href as Href)}
                style={({ pressed }) => [styles.row, i > 0 && styles.border, pressed && { backgroundColor: colors.background }]}
                accessibilityRole={href ? 'button' : undefined}>
                <View style={[styles.icon, !n.readAt && { backgroundColor: colors.accentSoft }]}>
                  <Icon size={18} color={n.readAt ? colors.secondary : colors.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.top}>
                    <Text style={[styles.title, !n.readAt && { fontFamily: fonts.bold }]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text variant="footnote">{smartTime(n.createdAt)}</Text>
                  </View>
                  <Text variant="callout">{n.message}</Text>
                </View>
                {!n.readAt && <View style={styles.dot} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.white, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, padding: 16, alignItems: 'flex-start' },
  border: { borderTopWidth: 1, borderTopColor: colors.divider },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 },
});
