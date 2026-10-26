import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { markNewsRead } from '@/api/endpoints';
import { qk, useNews } from '@/api/queries';
import type { NewsAction, NewsItem, NewsList, Overview } from '@/api/types';
import { LoadError, Screen, Skeleton, Text } from '@/components/ui';
import { openNewsCta } from '@/features/news/cta';
import { NewsGlyph } from '@/features/news/NewsAccent';
import { NewsRow } from '@/features/news/NewsRow';
import { plural } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Neuigkeiten von FinestSites – die einzige Ansicht (Daniel 26.10.2026): alle Karten in der Liste,
 * neueste zuerst, höchstens 50; eine klappt auf (eine zur Zeit) und zeigt Inhalt + Knopf. Aufklappen
 * meldet „gelesen“ (Zähler unter „Mehr“, Startkarte und Liste folgen). `?open=<id>` (Startkarte,
 * Push-Mitteilung, alte Detail-Route) klappt diese Neuigkeit direkt auf. Gleiche Liste wie /neuigkeiten im Web.
 */
export default function NewsListScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { open } = useLocalSearchParams<{ open?: string }>();
  const q = useNews();
  const items = q.data?.items ?? [];
  const unread = q.data?.unreadCount ?? 0;
  const [openId, setOpenId] = useState<string | null>(null);
  const markedFor = useRef<string | null>(null);

  // Deep-Link: ?open=<id> übernehmen (auch wenn sich der Parameter später ändert, z. B. zweite Push-Mitteilung)
  useEffect(() => {
    if (open) setOpenId(open);
  }, [open]);

  const markRead = useCallback((id: string) => {
    if (markedFor.current === id) return;
    markedFor.current = id;
    markNewsRead(id)
      .then((res: NewsAction) => {
        qc.setQueryData<NewsList>(qk.news, prev =>
          prev ? { ...prev, unreadCount: res.unreadCount, items: prev.items.map(n => (n.id === id ? res.item : n)) } : prev,
        );
        qc.setQueryData<Overview>(qk.overview, prev =>
          prev ? { ...prev, news: { unread: res.unreadCount, latest: prev.news.latest?.id === id ? null : prev.news.latest } } : prev,
        );
      })
      .catch(() => {
        markedFor.current = null;
      })
      .then(() => {
        void qc.invalidateQueries({ queryKey: qk.overview });
      });
  }, [qc]);

  // Beim Aufklappen als gelesen melden (auch für ?open=<id>, sobald die Liste da ist)
  useEffect(() => {
    if (!openId) return;
    const it = items.find(n => n.id === openId);
    if (it && !it.readAt) markRead(openId);
  }, [openId, items, markRead]);

  const toggle = (id: string) => setOpenId(prev => (prev === id ? null : id));

  return (
    <Screen readable refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: 'Neuigkeiten' }} />
      {q.isError && !q.data ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : q.isLoading ? (
        <View style={styles.list}>
          <Skeleton width="40%" height={14} style={styles.leadSkeleton} />
          <Skeleton height={176} radius={radius.card} />
          <Skeleton height={176} radius={radius.card} />
        </View>
      ) : items.length === 0 ? (
        <NewsEmpty />
      ) : (
        <View style={styles.list}>
          <Text style={styles.lead} accessibilityRole="summary">
            {unread > 0 ? plural(unread, 'neue Neuigkeit', 'neue Neuigkeiten') : 'Alles gelesen'}
          </Text>
          {items.map((n: NewsItem) => (
            <NewsRow
              key={n.id}
              item={n}
              expanded={openId === n.id}
              onToggle={() => toggle(n.id)}
              onCta={() => {
                if (n.cta) openNewsCta(n.id, n.cta, router);
              }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

/** Ruhiger Leerzustand ohne Karte: das „f“ der Wortmarke im Pastell-Regenbogen, Titel, ein Satz. */
function NewsEmpty() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyGlyph}>
        <NewsGlyph height={44} />
      </View>
      <Text variant="headline" align="center" style={styles.emptyTitle}>
        Noch keine Neuigkeiten
      </Text>
      <Text variant="callout" align="center" style={styles.emptyText}>
        Sobald es etwas Neues gibt, findest du es hier – und auf Wunsch als Mitteilung.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  lead: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.secondary, paddingHorizontal: 4, marginBottom: -4 },
  leadSkeleton: { marginLeft: 4, marginBottom: -4 },
  empty: { alignItems: 'center', paddingVertical: 72, paddingHorizontal: 24 },
  emptyGlyph: { marginBottom: 24 },
  emptyTitle: { fontFamily: fonts.semibold, marginBottom: 6 },
  emptyText: { color: colors.tertiary, maxWidth: 300, lineHeight: 21 },
});
