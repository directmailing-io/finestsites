import { ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import type { NewsItem } from '@/api/types';
import { Text } from '@/components/ui';
import { longDate } from '@/lib/format';
import { colors, fonts, radius } from '@/theme/tokens';

import { NEWS_ON_SOLID, NewsSolid, newsPalette } from './NewsAccent';
import { NewsBody } from './NewsBody';

/**
 * Eine Neuigkeit in der Liste – gleiche Karte wie /neuigkeiten im Web (Daniel 26.10.2026: nur eine
 * Ansicht, Vorschau aufklappen). Vollton-Karte im Pastellverlauf: Datum, solange ungelesen „Neu“,
 * Überschrift, zwei Zeilen Kurztext, „Weiterlesen“ als schwarze Pille. Aufgeklappt zeigt dieselbe
 * Karte darunter den ganzen Inhalt, den Knopf und „Zuklappen“; die Höhe gleitet (LinearTransition).
 */
export const NewsRow = memo(function NewsRow({ item, expanded, onToggle, onCta }: {
  item: NewsItem;
  expanded: boolean;
  onToggle: () => void;
  onCta: () => void;
}) {
  const unread = !item.readAt;
  const date = longDate(item.publishedAt);
  const p = newsPalette(item.id, item.color);
  return (
    <Animated.View layout={LinearTransition.duration(260)}>
      <NewsSolid palette={p} radius={radius.card}>
        <Pressable
          onPress={expanded ? undefined : onToggle}
          disabled={expanded}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${unread ? 'Ungelesen. ' : ''}${item.title}, ${date}. ${item.summary}`}
          accessibilityHint={expanded ? undefined : 'Klappt die Neuigkeit auf'}
          style={({ pressed }) => [styles.head, expanded && styles.headOpen, pressed && !expanded && styles.pressed]}>
          <View style={styles.kicker}>
            <Text style={styles.date} numberOfLines={1}>
              {date}
            </Text>
            {unread && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>Neu</Text>
              </View>
            )}
          </View>
          <Text style={styles.title} numberOfLines={expanded ? undefined : 2}>
            {item.title}
          </Text>
          {!expanded && (
            <Animated.View exiting={FadeOut.duration(120)}>
              <Text style={styles.summary} numberOfLines={2}>
                {item.summary}
              </Text>
              <View style={styles.more}>
                <View style={styles.moreButton}>
                  <Text style={styles.moreButtonText}>Weiterlesen</Text>
                  <ChevronRight size={15} color={colors.white} strokeWidth={2.5} style={{ opacity: 0.85 }} />
                </View>
              </View>
            </Animated.View>
          )}
        </Pressable>

        {expanded && (
          <Animated.View entering={FadeIn.duration(220).delay(60)} exiting={FadeOut.duration(120)} style={styles.bodyWrap}>
            <View style={styles.line} />
            <NewsBody body={item.body} onSolid />
            <View style={styles.actions}>
              {item.cta ? (
                <Pressable
                  onPress={onCta}
                  accessibilityRole="button"
                  accessibilityLabel={item.cta.label}
                  style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
                  <Text style={styles.ctaText} numberOfLines={1}>
                    {item.cta.label}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={onToggle}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Zuklappen"
                style={({ pressed }) => [styles.collapse, pressed && { backgroundColor: NEWS_ON_SOLID.wash }]}>
                <Text style={styles.collapseText}>Zuklappen</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </NewsSolid>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  head: { padding: 24, paddingBottom: 24 },
  headOpen: { paddingBottom: 0 },
  pressed: { opacity: 0.92 },
  kicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, minHeight: 22 },
  date: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: NEWS_ON_SOLID.kicker },
  pill: { height: 22, paddingHorizontal: 9, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: NEWS_ON_SOLID.pill },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 27, letterSpacing: -0.4, color: colors.ink, marginBottom: 4 },
  summary: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: NEWS_ON_SOLID.text },
  more: { alignItems: 'flex-end', marginTop: 18 },
  moreButton: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 38, paddingLeft: 16, paddingRight: 12, borderRadius: radius.full, backgroundColor: colors.ink },
  moreButtonText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.white },
  bodyWrap: { paddingHorizontal: 24, paddingBottom: 24 },
  line: { height: StyleSheet.hairlineWidth * 2, backgroundColor: NEWS_ON_SOLID.line, marginTop: 10, marginBottom: 20 },
  actions: { marginTop: 24, gap: 6 },
  cta: { height: 50, borderRadius: radius.full, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  ctaPressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  ctaText: { fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 21, color: colors.white },
  collapse: { alignSelf: 'center', minHeight: 40, paddingHorizontal: 16, justifyContent: 'center', borderRadius: radius.full },
  collapseText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.ink, opacity: 0.75 },
});
