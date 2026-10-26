import { ChevronRight, Sparkles } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { NewsItem } from '@/api/types';
import { Text } from '@/components/ui';
import { longDate } from '@/lib/format';
import { colors, fonts, radius, shadows } from '@/theme/tokens';

/** Eine Neuigkeit in der Liste: Karte mit Datum-Kicker, Überschrift, Kurztext, Punkt „ungelesen“ (wie im Web). */
export const NewsRow = memo(function NewsRow({ item, onPress }: { item: NewsItem; onPress: () => void }) {
  const unread = !item.readAt;
  const date = longDate(item.publishedAt);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Ungelesen. ' : ''}${item.title}, ${date}. ${item.summary}`}
      style={({ pressed }) => [styles.card, unread && styles.cardUnread, pressed && styles.pressed]}>
      <View style={[styles.icon, unread && styles.iconUnread]}>
        <Sparkles size={18} color={unread ? colors.accent : colors.secondary} strokeWidth={2} />
      </View>
      <View style={styles.content}>
        <View style={styles.top}>
          <Text variant="overline" color={unread ? colors.accent : colors.tertiary} numberOfLines={1} style={{ flex: 1 }}>
            {unread ? `Neu · ${date}` : date}
          </Text>
          {unread && <View style={styles.dot} accessibilityElementsHidden />}
        </View>
        <Text style={[styles.title, unread && { color: colors.inkStrong }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text variant="callout" numberOfLines={2} color={unread ? colors.body : colors.secondary}>
          {item.summary}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.hairline} strokeWidth={2.25} style={styles.chevron} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    padding: 16,
    paddingRight: 12,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.borderCard,
    ...shadows.siteCard,
  },
  cardUnread: { borderColor: colors.accentSoftBorder },
  pressed: { backgroundColor: colors.surfaceSubtle, transform: [{ scale: 0.99 }] },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  iconUnread: { backgroundColor: colors.accentSoft },
  content: { flex: 1, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2, color: colors.ink },
  chevron: { alignSelf: 'center' },
});
