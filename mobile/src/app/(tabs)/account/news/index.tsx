import { Stack, useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useNews } from '@/api/queries';
import { EmptyState, LoadError, Screen, Skeleton, Text } from '@/components/ui';
import { NewsRow } from '@/features/news/NewsRow';
import { plural } from '@/lib/format';
import { radius } from '@/theme/tokens';

/**
 * Neuigkeiten von FinestSites (neue Funktionen, Aktionen) – neueste zuerst, höchstens 50.
 * Gleiche Liste wie /neuigkeiten im Web. Ungelesene sind markiert; Öffnen setzt „gelesen“.
 */
export default function NewsListScreen() {
  const router = useRouter();
  const q = useNews();
  const items = q.data?.items ?? [];
  const unread = q.data?.unreadCount ?? 0;

  return (
    <Screen readable refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: 'Neuigkeiten' }} />
      {q.isError && !q.data ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : q.isLoading ? (
        <View style={styles.list}>
          <Skeleton height={118} radius={radius.card} />
          <Skeleton height={118} radius={radius.card} />
          <Skeleton height={118} radius={radius.card} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon={Sparkles} title="Noch keine Neuigkeiten" text="Neue Funktionen und Aktionen von FinestSites erscheinen hier." />
      ) : (
        <View style={styles.list}>
          <Text variant="callout" style={styles.lead}>
            {unread > 0 ? `${plural(unread, 'neue Neuigkeit', 'neue Neuigkeiten')} · höchstens eine am Tag.` : 'Alles gelesen. Neue Funktionen und Aktionen erscheinen hier.'}
          </Text>
          {items.map(n => (
            <NewsRow key={n.id} item={n} onPress={() => router.push({ pathname: '/account/news/[id]', params: { id: n.id } })} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  lead: { paddingHorizontal: 4, marginBottom: 2 },
});
