import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { NewsItem } from '@/api/types';
import { Text } from '@/components/ui';
import { longDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

import { newsCardShadow, NewsHero } from './NewsHero';

/**
 * Eine Neuigkeit in der Liste – redaktionelle Karte wie Apples „Das ist neu“: Verlauf-Kopf (96 pt)
 * mit Wortmarke, darunter Kicker (Punkt + „NEU“ solange ungelesen, Datum), Überschrift, Kurztext
 * in zwei Zeilen und „Weiterlesen ›“ rechts unten. Gleiche Karte wie /neuigkeiten im Web.
 */
export const NewsRow = memo(function NewsRow({ item, onPress }: { item: NewsItem; onPress: () => void }) {
  const unread = !item.readAt;
  const date = longDate(item.publishedAt);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Ungelesen. ' : ''}${item.title}, ${date}. ${item.summary}`}
      accessibilityHint="Öffnet die Neuigkeit"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <NewsHero seed={item.id} height={96} />
      <View style={styles.body}>
        <View style={styles.kicker}>
          {unread && <View style={styles.dot} accessibilityElementsHidden />}
          {unread && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>NEU</Text>
            </View>
          )}
          <Text style={[styles.date, unread && { color: colors.secondary }]} numberOfLines={1}>
            {date}
          </Text>
        </View>
        <Text variant="headline" style={[styles.title, unread && { color: colors.inkStrong }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text variant="callout" numberOfLines={2} color={unread ? colors.body : colors.secondary} style={styles.summary}>
          {item.summary}
        </Text>
        <View style={styles.more}>
          <Text style={styles.moreText}>Weiterlesen ›</Text>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...newsCardShadow,
  },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.96 },
  body: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 18 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  pill: {
    height: 18,
    paddingHorizontal: 7,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.7, color: colors.accentDeep },
  date: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.tertiary },
  title: { marginBottom: 4 },
  summary: { lineHeight: 21 },
  more: { alignItems: 'flex-end', marginTop: 10 },
  moreText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.accent },
});
