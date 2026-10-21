import { useRouter } from 'expo-router';
import { MessageCircle, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConversations } from '@/api/queries';
import { Button, EmptyState, LoadError, PageHeader, Skeleton, Text } from '@/components/ui';
import { ChatThread } from '@/features/support/ChatThread';
import { ConversationRow } from '@/features/support/ConversationRow';
import { useLayout } from '@/lib/layout';
import { colors, radius } from '@/theme/tokens';

function isLiveHours() {
  const h = new Date().getHours();
  return h >= 8 && h < 20;
}

/** Hilfe: Gespräche mit dem Support. iPad: Liste links, Chat rechts. */
export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { regular, gutter, listWidth } = useLayout();
  const q = useConversations(regular);
  const convs = q.data?.conversations ?? [];
  const [selected, setSelected] = useState<string | 'new' | null>(null);

  useEffect(() => {
    if (regular && selected === null && convs.length > 0) setSelected(convs[0].id);
  }, [regular, selected, convs]);

  const open = (id: string | 'new') => {
    if (regular) setSelected(id);
    else router.push({ pathname: '/help/[id]', params: { id } });
  };

  const live = isLiveHours();
  const header = (
    <View style={{ gap: 16, paddingBottom: 12 }}>
      <PageHeader title="Hilfe" subtitle="Schreib uns, wir helfen dir gern." />
      <View style={styles.status}>
        <View style={[styles.statusDot, { backgroundColor: live ? '#FBBF24' : colors.faint }]} />
        <Text variant="callout">{live ? 'Antwortet meist am gleichen Tag' : 'Antwortet innerhalb von 24 Std.'}</Text>
      </View>
      <Button title="Neues Gespräch" icon={Plus} onPress={() => open('new')} />
      {convs.length > 0 && <Text variant="overline">Deine Gespräche</Text>}
    </View>
  );

  const list = (
    <FlatList
      data={convs}
      keyExtractor={c => c.id}
      renderItem={({ item }) => <ConversationRow c={item} selected={regular && selected === item.id} onPress={() => open(item.id)} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        q.isError ? (
          <LoadError onRetry={() => void q.refetch()} />
        ) : q.isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={56} radius={radius.input} />
            <Skeleton height={56} radius={radius.input} />
          </View>
        ) : (
          <EmptyState icon={MessageCircle} title="Wie können wir dir helfen?" text="Unser Team antwortet normalerweise in wenigen Stunden." compact />
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 33 }} />}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.faint} />}
      contentContainerStyle={{ paddingHorizontal: regular ? 20 : gutter, paddingTop: insets.top + 16, paddingBottom: 40 }}
      style={{ backgroundColor: colors.background }}
    />
  );

  if (!regular) return list;

  return (
    <View style={styles.split}>
      <View style={[styles.listPane, { width: listWidth + 40 }]}>{list}</View>
      <View style={[styles.chatPane, { paddingTop: insets.top }]}>
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
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  split: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  listPane: { borderRightWidth: 1, borderRightColor: colors.border },
  chatPane: { flex: 1, backgroundColor: colors.white },
});
