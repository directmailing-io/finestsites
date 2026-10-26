import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useNews } from '@/api/queries';
import { LoadError, Screen, Skeleton, Text } from '@/components/ui';
import { NewsGradient } from '@/features/news/NewsHero';
import { NewsRow } from '@/features/news/NewsRow';
import { plural } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

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
          <Skeleton width="40%" height={14} style={styles.leadSkeleton} />
          <Skeleton height={248} radius={radius.card} />
          <Skeleton height={248} radius={radius.card} />
        </View>
      ) : items.length === 0 ? (
        <NewsEmpty />
      ) : (
        <View style={styles.list}>
          <Text style={styles.lead} accessibilityRole="summary">
            {unread > 0 ? plural(unread, 'neue Neuigkeit', 'neue Neuigkeiten') : 'Alles gelesen'}
          </Text>
          {items.map(n => (
            <NewsRow key={n.id} item={n} onPress={() => router.push({ pathname: '/account/news/[id]', params: { id: n.id } })} />
          ))}
        </View>
      )}
    </Screen>
  );
}

/** Ruhiger Leerzustand: kleine Verlauf-Miniatur statt Symbol, Titel, ein Satz. */
function NewsEmpty() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyBand} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <NewsGradient seed="finestsites" />
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
  emptyBand: { width: 60, height: 36, borderRadius: 10, overflow: 'hidden', marginBottom: 20 },
  emptyTitle: { fontFamily: fonts.semibold, marginBottom: 6 },
  emptyText: { color: colors.tertiary, maxWidth: 300, lineHeight: 21 },
});
