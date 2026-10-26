import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { NewsItem } from '@/api/types';
import { Button, Card, Text } from '@/components/ui';
import { longDate } from '@/lib/format';
import { colors } from '@/theme/tokens';

import { openNewsCta } from './cta';
import { NewsBody } from './NewsBody';
import { NewsHero } from './NewsHero';

/**
 * Die Neuigkeit wie im Konzept (Bild 2) und im Web: Karte mit Lila-Verlauf-Kopf „FinestSites“,
 * Kicker „NEUIGKEIT · 4. November 2026“, Überschrift, Inhalt, Knopf, „Später“.
 */
export function NewsDetailCard({ item, onLater }: { item: NewsItem; onLater: () => void }) {
  const router = useRouter();
  return (
    <Card padded={false} style={styles.card}>
      <NewsHero />
      <View style={styles.inner}>
        <Text variant="overline" color={colors.accent} accessibilityLabel={`Neuigkeit vom ${longDate(item.publishedAt)}`}>
          {`Neuigkeit · ${longDate(item.publishedAt)}`}
        </Text>
        <Text variant="title" style={styles.title} accessibilityRole="header">
          {item.title}
        </Text>
        <NewsBody body={item.body} />
        <View style={styles.actions}>
          {item.cta ? <Button title={item.cta.label} onPress={() => openNewsCta(item.id, item.cta!, router)} fullWidth /> : null}
          <Button title="Später" variant="secondary" onPress={onLater} fullWidth />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  inner: { padding: 20, paddingTop: 18 },
  title: { marginTop: 6, marginBottom: 14 },
  actions: { marginTop: 24, gap: 10 },
});
