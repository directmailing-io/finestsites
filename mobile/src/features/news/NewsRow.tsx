import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { NewsItem } from '@/api/types';
import { Text } from '@/components/ui';
import { longDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

import { NEWS_UI, NewsEdge, newsPalette, newsSheetInner, newsSheetOuter } from './NewsAccent';

/**
 * Eine Neuigkeit in der Liste – weiße, typografische Karte ohne Bild: Datum klein in Versalien,
 * solange ungelesen rechts die Pille „Neu“ (helle Fläche im Ton der Neuigkeit, Schrift in Tinte),
 * Überschrift, Kurztext in zwei Zeilen, „Weiterlesen ›“ rechts unten. Einziges Gestaltungselement
 * ist die Pastell-Unterkante der Karte (volle Breite, folgt den Rundungen). Kein Punkt, kein Icon.
 * Gleiche Karte wie /neuigkeiten im Web.
 */
export const NewsRow = memo(function NewsRow({ item, onPress }: { item: NewsItem; onPress: () => void }) {
  const unread = !item.readAt;
  const date = longDate(item.publishedAt);
  const p = newsPalette(item.id);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Ungelesen. ' : ''}${item.title}, ${date}. ${item.summary}`}
      accessibilityHint="Öffnet die Neuigkeit"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.sheet}>
        <View style={styles.kicker}>
          <Text style={styles.date} numberOfLines={1}>
            {date}
          </Text>
          {unread && (
            <View style={[styles.pill, { backgroundColor: p.tint }]}>
              <Text style={styles.pillText}>Neu</Text>
            </View>
          )}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.summary} numberOfLines={2}>
          {item.summary}
        </Text>
        <View style={styles.more}>
          <Text style={styles.moreText}>Weiterlesen ›</Text>
        </View>
        <NewsEdge seed={item.id} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: newsSheetOuter(radius.card),
  sheet: { ...newsSheetInner(radius.card), padding: 22, paddingBottom: 24 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.96 },
  kicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, minHeight: 22 },
  date: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: NEWS_UI.date },
  pill: { height: 22, paddingHorizontal: 9, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25, letterSpacing: -0.3, color: colors.ink, marginBottom: 4 },
  summary: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: NEWS_UI.summary },
  more: { alignItems: 'flex-end', marginTop: 16 },
  moreText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.ink },
});
