import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { NewsItem } from '@/api/types';
import { Text } from '@/components/ui';
import { longDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

import { openNewsCta } from './cta';
import { NEWS_UI, newsCardShadow, NewsAccentLine, newsPalette } from './NewsAccent';
import { NewsBody } from './NewsBody';

/**
 * Die Neuigkeit wie im Web: weißes Blatt (Radius 28) ohne Kopfbild – Datum-Kicker in der Tinte der
 * Neuigkeit, große Überschrift (28/700), darunter die kurze Pastell-Linie (64 × 3), Vorspann, Inhalt,
 * schwarzer Pillen-Knopf, „Später“ als stiller Textlink.
 */
export function NewsDetailCard({ item, onLater }: { item: NewsItem; onLater: () => void }) {
  const router = useRouter();
  const date = longDate(item.publishedAt);
  const p = newsPalette(item.id);
  return (
    <View style={styles.card}>
      <Text style={[styles.kicker, { color: p.ink }]} accessibilityLabel={`Neuigkeit vom ${date}`}>
        {date}
      </Text>
      <Text style={styles.title} accessibilityRole="header">
        {item.title}
      </Text>
      <NewsAccentLine seed={item.id} style={styles.line} />
      <NewsBody body={item.body} palette={p} />
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
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: NEWS_UI.line,
    padding: 24,
    paddingTop: 26,
    ...newsCardShadow,
  },
  kicker: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.8, color: colors.ink },
  line: { width: 64, alignSelf: 'flex-start', marginTop: 14, marginBottom: 20 },
  actions: { marginTop: 32, gap: 4 },
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
