import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { markNewsRead } from '@/api/endpoints';
import { qk, useNewsItem } from '@/api/queries';
import type { NewsAction, NewsList, Overview } from '@/api/types';
import { EmptyState, LoadError, Screen, Skeleton } from '@/components/ui';
import { NewsDetailCard } from '@/features/news/NewsDetailCard';
import { radius } from '@/theme/tokens';
import { Megaphone } from 'lucide-react-native';

/**
 * Eine Neuigkeit (Ziel der Push-Mitteilung finestsites://news/<id>). Beim Öffnen wird sie als
 * gelesen gemeldet; Zähler unter „Mehr“, Startkarte und Liste aktualisieren sich darüber.
 */
export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useNewsItem(id ?? null);
  const markedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!id || markedFor.current === id) return;
    markedFor.current = id;
    markNewsRead(id)
      .then((res: NewsAction) => {
        // Stand aus der Antwort übernehmen, dann alles nachladen (Zähler, Startkarte)
        qc.setQueryData(qk.newsItem(id), res.item);
        qc.setQueryData<NewsList>(qk.news, prev =>
          prev ? { ...prev, unreadCount: res.unreadCount, items: prev.items.map(n => (n.id === id ? res.item : n)) } : prev,
        );
        qc.setQueryData<Overview>(qk.overview, prev =>
          prev ? { ...prev, news: { unread: res.unreadCount, latest: prev.news.latest?.id === id ? null : prev.news.latest } } : prev,
        );
      })
      .catch(() => {})
      .then(() => {
        void qc.invalidateQueries({ queryKey: qk.news });
        void qc.invalidateQueries({ queryKey: qk.overview });
      });
  }, [id, qc]);

  // „Später“ und Zurück: zur Liste, wenn die App direkt hier geöffnet wurde (Push, Kaltstart)
  const back = () => (router.canGoBack() ? router.back() : router.replace('/account/news'));
  const gone = q.isError && q.error instanceof ApiError && q.error.status === 404;

  return (
    <Screen readable>
      <Stack.Screen options={{ title: 'Neuigkeit' }} />
      {q.data ? (
        <NewsDetailCard item={q.data} onLater={back} />
      ) : gone ? (
        <EmptyState icon={Megaphone} title="Diese Neuigkeit gibt es nicht mehr" text="Alle aktuellen Neuigkeiten findest du in der Liste." actionTitle="Zu den Neuigkeiten" onAction={back} />
      ) : q.isError ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : (
        <View style={{ gap: 12 }}>
          <Skeleton height={160} radius={28} />
          <Skeleton width="36%" height={12} style={{ marginTop: 8 }} />
          <Skeleton width="88%" height={26} radius={radius.sm} />
          <Skeleton height={14} style={{ marginTop: 8 }} />
          <Skeleton height={14} />
          <Skeleton width="70%" height={14} />
          <Skeleton height={52} radius={radius.full} style={{ marginTop: 16 }} />
        </View>
      )}
    </Screen>
  );
}
