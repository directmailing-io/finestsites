import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { NewsItem } from '@/api/types';
import { Text } from '@/components/ui';
import { longDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

import { openNewsCta } from './cta';
import { NewsBody } from './NewsBody';
import { newsCardShadow, NewsHero } from './NewsHero';

/**
 * Die Neuigkeit wie im Web: Karte (Radius 28) mit hohem Verlauf-Kopf (160 pt), Datum-Kicker,
 * große Überschrift (26/700), Vorspann, Inhalt, schwarzer Pillen-Knopf, „Später“ als stiller Textlink.
 */
export function NewsDetailCard({ item, onLater }: { item: NewsItem; onLater: () => void }) {
  const router = useRouter();
  const date = longDate(item.publishedAt);
  return (
    <View style={styles.card}>
      <NewsHero seed={item.id} height={160} logoHeight={14} />
      <View style={styles.inner}>
        <Text style={styles.kicker} accessibilityLabel={`Neuigkeit vom ${date}`}>
          {date}
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          {item.title}
        </Text>
        <NewsBody body={item.body} />
        <View style={[styles.actions, !item.cta && { marginTop: 20 }]}>
          {item.cta ? (
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                openNewsCta(item.id, item.cta!, router);
              }}
              accessibilityRole="button"
              accessibilityLabel={item.cta.label}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
              <Text style={styles.ctaText} numberOfLines={1}>
                {item.cta.label}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onLater}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Später"
            accessibilityHint="Schließt die Neuigkeit"
            style={({ pressed }) => [styles.later, pressed && { opacity: 0.5 }]}>
            <Text style={styles.laterText}>Später</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    overflow: 'hidden',
    ...newsCardShadow,
  },
  inner: { padding: 24, paddingTop: 22 },
  kicker: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.accent, marginBottom: 10 },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: colors.ink, marginBottom: 16 },
  actions: { marginTop: 28, gap: 4 },
  cta: {
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ctaPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  ctaText: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, color: colors.white },
  later: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  laterText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.secondary },
});
