import { useRouter } from 'expo-router';
import { MessagesSquare, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatConversations, useMe } from '@/api/queries';
import type { ChatConversation, ChatConversationStatus } from '@/api/types';
import { EmptyState, Input, LoadError, PageHeader, Screen, SegmentedControl, Skeleton } from '@/components/ui';
import { SwipeableConversationRow, useSwipeRegistry } from '@/features/chat/SwipeableConversationRow';
import { ThreadPane } from '@/features/chat/ThreadPane';
import { useLayout } from '@/lib/layout';
import { colors } from '@/theme/tokens';

/**
 * „Chats“: Gespräche mit Besuchern deiner Webseiten, Liste wie WhatsApp. Nur für freigeschaltete Konten
 * (me.features.visitorChat). iPhone: Liste → Gespräch. iPad (breit): Liste links, Gespräch rechts.
 */
export default function ChatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { regular, gutter, top, listWidth } = useLayout();
  const me = useMe();
  const enabled = me.data?.features.visitorChat === true;
  const [status, setStatus] = useState<ChatConversationStatus>('open');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pulling, setPulling] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // Wischen: nur eine Zeile gleichzeitig offen, beim Scrollen und Filterwechsel schließen
  const { registry, closeOpen } = useSwipeRegistry();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useChatConversations(status, debounced, enabled);
  const items = useMemo(() => q.data?.conversations ?? [], [q.data]);
  const unreadTotal = q.data?.unreadTotal ?? 0;
  const total = items.length;

  // iPad: erstes Gespräch automatisch zeigen; ein gewähltes bleibt offen, auch wenn es den Filter wechselt
  useEffect(() => {
    if (regular && selected === null && items.length > 0) setSelected(items[0].id);
  }, [regular, items, selected]);

  const open = (c: ChatConversation) => {
    if (regular) setSelected(c.id);
    else router.push({ pathname: '/chats/[id]', params: { id: c.id } });
  };

  if (me.data && !enabled) {
    return (
      <Screen topInset readable>
        <PageHeader title="Chats" />
        <EmptyState icon={MessagesSquare} title="Chat nicht freigeschaltet" text="Der Besucher-Chat ist für dein Konto noch nicht freigeschaltet." />
      </Screen>
    );
  }

  const header = (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      <PageHeader
        title="Chats"
        subtitle={
          q.isLoading || !me.data
            ? ' '
            : total === 0 && status === 'open' && !debounced
              ? 'Noch keine Chats'
              : `${total} ${total === 1 ? 'Gespräch' : 'Gespräche'}${unreadTotal > 0 ? ` · ${unreadTotal} ungelesen` : ''}`
        }
      />
      <SegmentedControl
        items={[
          { key: 'open', label: 'Offen', badge: status === 'open' ? 0 : unreadTotal },
          { key: 'archived', label: 'Archiviert' },
          { key: 'blocked', label: 'Gesperrt' },
        ]}
        value={status}
        onChange={s => {
          closeOpen();
          setStatus(s);
        }}
      />
      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Nach Name, E-Mail oder Nachricht suchen…"
        returnKeyType="search"
        autoCorrect={false}
        left={<Search size={16} color={colors.faint} style={{ marginLeft: 16 }} />}
        right={
          search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={10} style={{ paddingHorizontal: 14 }} accessibilityLabel="Suche leeren" accessibilityRole="button">
              <X size={14} color={colors.faint} strokeWidth={3} />
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );

  const empty = q.isError ? (
    <LoadError onRetry={() => void q.refetch()} />
  ) : q.isLoading || !me.data ? (
    <View style={{ gap: 18, paddingTop: 8 }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Skeleton width={52} height={52} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="40%" height={13} />
            <Skeleton width="75%" height={11} />
          </View>
        </View>
      ))}
    </View>
  ) : debounced ? (
    <EmptyState icon={MessagesSquare} title="Keine Ergebnisse" text={`Nichts gefunden zu „${debounced}“.`} />
  ) : status === 'archived' ? (
    <EmptyState icon={MessagesSquare} title="Keine archivierten Chats" text="Archivierte Gespräche erscheinen hier." />
  ) : status === 'blocked' ? (
    <EmptyState icon={MessagesSquare} title="Keine gesperrten Besucher" text="Gesperrte Besucher und ihre Gespräche erscheinen hier." />
  ) : (
    <EmptyState
      icon={MessagesSquare}
      title="Noch keine Chats"
      text="Schalte den Chat zuerst im Editor deiner Webseite ein (unter „Domain“). Sobald dann ein Besucher schreibt, erscheint das Gespräch hier – mit Mitteilung, wenn du sie erlaubt hast."
    />
  );

  const list = (
    <FlatList
      data={items}
      keyExtractor={c => c.id}
      renderItem={({ item }) => (
        <SwipeableConversationRow
          c={item}
          selected={regular && selected === item.id}
          onPress={() => open(item)}
          registry={registry}
          onDeleted={id => setSelected(prev => (prev === id ? null : prev))}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={closeOpen}
      removeClippedSubviews={false}
      refreshControl={
        <RefreshControl
          refreshing={pulling && q.isRefetching}
          onRefresh={() => {
            setPulling(true);
            void q.refetch().finally(() => setPulling(false));
          }}
          tintColor={colors.faint}
        />
      }
      contentContainerStyle={{ paddingHorizontal: regular ? 20 : gutter, paddingTop: top, paddingBottom: 40 }}
      style={{ backgroundColor: colors.background }}
    />
  );

  if (!regular) return list;

  // iPad: Tab-Leiste oben – mindestens Statusleiste + Leiste freihalten (wie im Support)
  const padTop = Math.max(insets.top, 80);
  return (
    <View style={styles.split}>
      <View style={[styles.listPane, { width: listWidth + 60 }]}>{list}</View>
      <View style={[styles.chatPane, { paddingTop: padTop }]}>
        {selected ? (
          <ThreadPane key={selected} id={selected} onDeleted={() => setSelected(null)} />
        ) : (
          <EmptyState icon={MessagesSquare} title="Kein Gespräch ausgewählt" text="Wähle links ein Gespräch aus." />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sep: { height: 1, backgroundColor: colors.divider, marginLeft: 78 },
  split: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  listPane: { borderRightWidth: 1, borderRightColor: colors.border },
  chatPane: { flex: 1, backgroundColor: colors.white },
});
