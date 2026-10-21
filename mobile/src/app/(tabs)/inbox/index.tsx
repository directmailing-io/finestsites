import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, MessageSquare, Search, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, findNodeHandle, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View, type HostInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSites, useSubmissions } from '@/api/queries';
import type { Submission, SubmissionStatus } from '@/api/types';
import { EmptyState, Input, LoadError, PageHeader, Skeleton, Text, UnderlineTabs } from '@/components/ui';
import { SubmissionDetail } from '@/features/inbox/SubmissionDetail';
import { SubmissionRow } from '@/features/inbox/SubmissionRow';
import { useLayout } from '@/lib/layout';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Postfach aller Seiten. iPhone: Liste → Detail. iPad (breit): Liste links, Anfrage rechts.
 */
export default function InboxScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ site?: string }>();
  const insets = useSafeAreaInsets();
  const { regular, gutter, top, listWidth } = useLayout();
  const pickerRef = useRef<HostInstance>(null);
  const [status, setStatus] = useState<SubmissionStatus>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pulling, setPulling] = useState(false);
  const [siteId, setSiteId] = useState<string | undefined>(params.site);
  const [selected, setSelected] = useState<Submission | null>(null);

  useEffect(() => setSiteId(params.site), [params.site]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useSubmissions(status, debounced, siteId);
  const sites = useSites();
  const items = useMemo(() => q.data?.submissions ?? [], [q.data]);
  const unreadInList = items.filter(s => !s.read_at).length;
  const total = q.data?.total ?? 0;
  const siteOptions = (sites.data ?? []).filter(s => s.status !== 'deleted');
  // Auswahlfeld „Alle Seiten“ wie das <select> im Web (erst ab zwei Seiten)
  const options = [{ id: undefined as string | undefined, title: 'Alle Seiten' }, ...siteOptions.map(s => ({ id: s.id as string | undefined, title: s.templates?.title ?? 'Seite' }))];
  const current = options.find(o => o.id === siteId) ?? options[0];
  const pickSite = () => {
    const titles = options.map(o => o.title);
    if (Platform.OS === 'ios') {
      const tag = pickerRef.current ? findNodeHandle(pickerRef.current) : null;
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...titles, 'Abbrechen'], cancelButtonIndex: titles.length, anchor: tag ?? undefined },
        i => {
          if (i < titles.length) setSiteId(options[i].id);
        },
      );
    } else {
      Alert.alert('Seite', undefined, [...options.map(o => ({ text: o.title, onPress: () => setSiteId(o.id) })), { text: 'Abbrechen', style: 'cancel' as const }]);
    }
  };

  // iPad: erste Anfrage automatisch zeigen, Auswahl bei Filterwechsel prüfen
  useEffect(() => {
    if (!regular) return;
    if (!selected || !items.some(i => i.id === selected.id)) setSelected(items[0] ?? null);
  }, [regular, items, selected]);

  const open = (s: Submission) => {
    if (regular) setSelected(s);
    else router.push({ pathname: '/inbox/[id]', params: { id: s.id } });
  };

  const header = (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      <PageHeader
        title="Anfragen"
        subtitle={
          q.isLoading
            ? ' '
            : total === 0
              ? 'Noch keine Anfragen'
              : `${total} ${total === 1 ? 'Anfrage' : 'Anfragen'}${unreadInList > 0 ? ` · ${unreadInList} ungelesen` : ''}`
        }
      />
      <UnderlineTabs
        items={[
          { key: 'all', label: 'Alle' },
          { key: 'unread', label: 'Ungelesen', badge: status === 'unread' ? 0 : unreadInList },
          { key: 'archived', label: 'Archiviert' },
        ]}
        value={status}
        onChange={setStatus}
      />
      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Nach Name, E-Mail oder Inhalt suchen…"
        returnKeyType="search"
        autoCorrect={false}
        left={<Search size={16} color={colors.faint} style={{ marginLeft: 16 }} />}
        right={
          search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={10} style={{ paddingHorizontal: 14 }} accessibilityLabel="Suche leeren">
              <X size={14} color={colors.faint} strokeWidth={3} />
            </Pressable>
          ) : undefined
        }
      />
      {siteOptions.length > 1 && (
        <Pressable
          ref={pickerRef}
          onPress={pickSite}
          accessibilityRole="button"
          accessibilityLabel={`Seite: ${current.title}`}
          style={({ pressed }) => [styles.select, pressed && { borderColor: colors.foreground }]}>
          <Text style={styles.selectText} numberOfLines={1}>
            {current.title}
          </Text>
          <ChevronDown size={16} color={colors.faint} strokeWidth={1.75} />
        </Pressable>
      )}
    </View>
  );

  const empty = q.isError ? (
    <LoadError onRetry={() => void q.refetch()} />
  ) : q.isLoading ? (
    <View style={{ gap: 18, paddingTop: 8 }}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <Skeleton width={48} height={48} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="35%" height={13} />
            <Skeleton width="70%" height={11} />
          </View>
        </View>
      ))}
    </View>
  ) : status === 'unread' ? (
    <EmptyState icon={MessageSquare} title="Alles gelesen" text="Keine ungelesenen Anfragen." />
  ) : status === 'archived' ? (
    <EmptyState icon={MessageSquare} title="Keine archivierten Anfragen" text="Archivierte Anfragen erscheinen hier." />
  ) : debounced ? (
    <EmptyState icon={MessageSquare} title="Keine Ergebnisse" text={`Nichts gefunden zu „${debounced}“.`} />
  ) : (
    <EmptyState
      icon={MessageSquare}
      title="Noch keine Anfragen"
      text="Sobald jemand ein Formular auf deiner Webseite ausfüllt, erscheint die Anfrage hier."
      actionTitle="Meine Webseiten"
      onAction={() => router.navigate('/sites')}
    />
  );

  const list = (
    <FlatList
      data={items}
      keyExtractor={i => i.id}
      renderItem={({ item }) => <SubmissionRow s={item} selected={regular && selected?.id === item.id} onPress={() => open(item)} />}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={pulling && q.isRefetching} onRefresh={() => { setPulling(true); void q.refetch().finally(() => setPulling(false)); }} tintColor={colors.faint} />}
      contentContainerStyle={{ paddingHorizontal: regular ? 20 : gutter, paddingTop: top, paddingBottom: 40 }}
      style={{ backgroundColor: colors.background }}
    />
  );

  if (!regular) return list;

  return (
    <View style={styles.split}>
      <View style={[styles.listPane, { width: listWidth + 60 }]}>{list}</View>
      <ScrollView
        style={styles.detailPane}
        contentContainerStyle={{ padding: 32, paddingTop: insets.top + 24, paddingBottom: 48 }}
        contentInsetAdjustmentBehavior="automatic">
        {selected ? (
          <View style={styles.detailCard}>
            <SubmissionDetail key={selected.id} submission={selected} onRemoved={() => setSelected(null)} />
          </View>
        ) : (
          <EmptyState icon={MessageSquare} title="Keine Anfrage ausgewählt" text="Wähle links eine Anfrage aus." />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sep: { height: 1, backgroundColor: colors.divider, marginLeft: 74 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  selectText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.foreground },
  split: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  listPane: { borderRightWidth: 1, borderRightColor: colors.border },
  detailPane: { flex: 1 },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.borderCard,
    padding: 28,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
});
