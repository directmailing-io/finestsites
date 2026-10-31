import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteConversation } from '@/api/endpoints';
import { qk, useConversations } from '@/api/queries';
import { EmptyState, LoadError, Skeleton, Text, useToast } from '@/components/ui';
import { ChatThread } from '@/features/support/ChatThread';
import { ConversationRow, SupportAvatar } from '@/features/support/ConversationRow';
import { useLayout } from '@/lib/layout';
import { colors, fonts } from '@/theme/tokens';

/** Erreichbarkeit wie isLiveHours() im Web (support/page.tsx): 9–18 Uhr. */
function isLiveHours() {
  const h = new Date().getHours();
  return h >= 9 && h < 18;
}

/**
 * Support wie /support im Web: Foto + „Support“ + Erreichbarkeit, „Neues Gespräch starten“,
 * Gesprächskarten mit „Gespräch löschen“. iPad: Liste links, Chat rechts.
 */
export default function SupportScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { regular, gutter, listTop, listWidth } = useLayout();
  const q = useConversations(regular);
  const convs = q.data?.conversations ?? [];
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = convs.filter(c => !hidden.includes(c.id));

  useEffect(() => {
    if (regular && selected === null && visible.length > 0) setSelected(visible[0].id);
  }, [regular, selected, visible]);

  const open = (id: string | 'new') => {
    if (regular) setSelected(id);
    else router.push({ pathname: '/help/[id]', params: { id } });
  };

  const remove = async (id: string) => {
    setHidden(h => [...h, id]);
    if (selected === id) setSelected(null);
    try {
      await deleteConversation(id);
      void qc.invalidateQueries({ queryKey: qk.conversations });
    } catch {
      setHidden(h => h.filter(x => x !== id));
      toast.show('Gespräch konnte nicht gelöscht werden.', 'error');
    }
  };

  // iPad: Tab-Leiste oben. Je nach Zeitpunkt enthält insets.top sie schon oder nicht – mindestens
  // Statusleiste + Leiste (24 + 56) freihalten, sonst liegt die erste Nachricht darunter.
  const padTop = Math.max(insets.top, 80);
  const live = isLiveHours();
  const header = (
    <View style={{ marginBottom: 20 }}>
      <View style={styles.head}>
        <SupportAvatar size={36} />
        <View>
          <Text style={styles.h1} accessibilityRole="header">
            Support
          </Text>
          <View style={styles.status}>
            <View style={[styles.statusDot, { backgroundColor: live ? '#22C55E' : '#F97316' }]} />
            <Text style={[styles.statusText, { color: live ? colors.successDot : '#EA580C' }]}>
              {live ? 'Jetzt erreichbar' : 'Außerhalb der Zeiten'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const newButton = (
    <Pressable onPress={() => open('new')} style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <Text style={styles.newPlus}>+</Text>
      <Text style={styles.newText}>Neues Gespräch starten</Text>
    </Pressable>
  );

  const empty = q.isError ? (
    <LoadError onRetry={() => void q.refetch()} />
  ) : q.isLoading ? (
    <View style={{ gap: 12 }}>
      <Skeleton height={72} radius={14} />
      <Skeleton height={72} radius={14} />
    </View>
  ) : (
    <View style={styles.empty}>
      <View style={styles.wave}>
        <Text style={{ fontSize: 32, lineHeight: 40 }}>👋</Text>
      </View>
      <Text style={styles.emptyTitle}>Wie können wir helfen?</Text>
      <Text style={styles.emptyText}>Unser Team antwortet normalerweise innerhalb weniger Stunden.</Text>
      <Pressable onPress={() => open('new')} style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        <Text style={styles.startText}>Gespräch starten →</Text>
      </Pressable>
    </View>
  );

  const list = (
    <FlatList
      data={visible}
      keyExtractor={c => c.id}
      renderItem={({ item }) => (
        <ConversationRow c={item} selected={regular && selected === item.id} onPress={() => open(item.id)} onDelete={() => void remove(item.id)} />
      )}
      ListHeaderComponent={
        <View>
          {header}
          {visible.length > 0 && <View style={{ marginBottom: 12 }}>{newButton}</View>}
        </View>
      }
      ListEmptyComponent={empty}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      // iPad (Liste neben dem Chat): feste Abstände unter der Tab-Leiste oben, gleich hoch wie der Chat
      contentInsetAdjustmentBehavior={regular ? 'never' : 'automatic'}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.faint} />}
      contentContainerStyle={{ paddingHorizontal: regular ? 20 : gutter, paddingTop: regular ? padTop + 16 : listTop, paddingBottom: 40 }}
      style={{ backgroundColor: colors.background }}
    />
  );

  if (!regular) return list;

  return (
    <View style={styles.split}>
      <View style={[styles.listPane, { width: listWidth + 40 }]}>{list}</View>
      {/* iPad: Platz für die Tab-Leiste oben, sonst liegt die erste Nachricht darunter */}
      <View style={[styles.chatPane, { paddingTop: padTop }]}>
        {selected ? (
          <ChatThread key={selected} conversationId={selected === 'new' ? null : selected} onCreated={id => setSelected(id)} />
        ) : (
          <EmptyState icon={MessageCircle} title="Kein Gespräch ausgewählt" text="Wähle links ein Gespräch aus oder starte ein neues." />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // h1 text-xl font-bold leading-tight
  h1: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 25, color: colors.ink },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: fonts.regular, fontSize: 12 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  newPlus: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 22, color: '#555555' },
  newText: { fontFamily: fonts.semibold, fontSize: 14, color: '#555555' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  wave: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 20, color: '#111111', marginBottom: 10, textAlign: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: '#777777', maxWidth: 280, textAlign: 'center', marginBottom: 32 },
  startBtn: { paddingVertical: 14, paddingHorizontal: 28, backgroundColor: '#111111', borderRadius: 14, minHeight: 48, justifyContent: 'center' },
  startText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.white },
  split: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  listPane: { borderRightWidth: 1, borderRightColor: colors.border },
  chatPane: { flex: 1, backgroundColor: colors.white },
});
