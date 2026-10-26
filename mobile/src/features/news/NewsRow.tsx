import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { NewsItem } from '@/api/types';
import { Text } from '@/components/ui';
import { longDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

import { NEWS_ON_SOLID, NEWS_UI, NewsFramed, NewsSolid, newsPalette } from './NewsAccent';

/**
 * Eine Neuigkeit in der Liste – gleiche Karte wie /neuigkeiten im Web. Die neueste (`prominent`)
 * ist eine Vollton-Karte im Pastellverlauf mit schwarzer „Weiterlesen“-Pille, alle weiteren weiße
 * Blätter mit feinem Verlaufsrahmen. Datum klein in Versalien, solange ungelesen die Pille „Neu“,
 * Überschrift, Kurztext in zwei Zeilen. Kein Punkt, kein Icon, kein Bild.
 */
export const NewsRow = memo(function NewsRow({ item, prominent = false, onPress }: { item: NewsItem; prominent?: boolean; onPress: () => void }) {
  const unread = !item.readAt;
  const date = longDate(item.publishedAt);
  const p = newsPalette(item.id, item.color);
  const Surface = prominent ? NewsSolid : NewsFramed;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Ungelesen. ' : ''}${item.title}, ${date}. ${item.summary}`}
      accessibilityHint="Öffnet die Neuigkeit"
      style={({ pressed }) => pressed && styles.pressed}>
      <Surface palette={p} radius={radius.card} contentStyle={prominent ? styles.sheetSolid : styles.sheet}>
        <View style={styles.kicker}>
          <Text style={[styles.date, prominent && { color: NEWS_ON_SOLID.kicker }]} numberOfLines={1}>
            {date}
          </Text>
          {unread && (
            <View style={[styles.pill, { backgroundColor: prominent ? NEWS_ON_SOLID.pill : p.tint }]}>
              <Text style={styles.pillText}>Neu</Text>
            </View>
          )}
        </View>
        <Text style={[styles.title, prominent && styles.titleSolid]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.summary, prominent && { color: NEWS_ON_SOLID.text }]} numberOfLines={2}>
          {item.summary}
        </Text>
        <View style={[styles.more, prominent && { marginTop: 18 }]}>
          {prominent ? (
            <View style={styles.moreButton}>
              <Text style={styles.moreButtonText}>Weiterlesen ›</Text>
            </View>
          ) : (
            <Text style={styles.moreText}>Weiterlesen ›</Text>
          )}
        </View>
      </Surface>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  sheet: { padding: 22, paddingBottom: 24 },
  sheetSolid: { padding: 24, paddingBottom: 24 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.96 },
  kicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, minHeight: 22 },
  date: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: NEWS_UI.date },
  pill: { height: 22, paddingHorizontal: 9, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25, letterSpacing: -0.3, color: colors.ink, marginBottom: 4 },
  titleSolid: { fontSize: 21, lineHeight: 27, letterSpacing: -0.4 },
  summary: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: NEWS_UI.summary },
  more: { alignItems: 'flex-end', marginTop: 16 },
  moreText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.ink },
  moreButton: { height: 38, paddingLeft: 16, paddingRight: 14, borderRadius: radius.full, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  moreButtonText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.white },
});
