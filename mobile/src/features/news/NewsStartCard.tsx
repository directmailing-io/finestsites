import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { dismissNews } from '@/api/endpoints';
import { qk } from '@/api/queries';
import type { NewsCard, Overview } from '@/api/types';
import { Text } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

import { NEWS_ON_SOLID, NewsSolid, newsPalette } from './NewsAccent';

const CARD_RADIUS = 20;

/**
 * Startkarte: die neueste Neuigkeit, die weder gelesen noch weggewischt ist – über
 * „Neue Webseite erstellen“. Vollton-Karte im Pastellverlauf der Neuigkeit (sie ist immer die
 * neueste): Kicker „Neu bei FinestSites“, Titel, eine Zeile Kurztext, „Mehr erfahren ›“.
 * Tipp → Detail, Kreuz → weggewischt (gilt auch für das Web-Dashboard).
 */
export function NewsStartCard({ card }: { card: NewsCard }) {
  const router = useRouter();
  const qc = useQueryClient();
  const p = newsPalette(card.id, card.color);

  const dismiss = () => {
    // Sofort aus der Übersicht nehmen (sonst käme die Karte bis zur nächsten Antwort kurz zurück)
    qc.setQueryData<Overview>(qk.overview, prev => (prev ? { ...prev, news: { ...prev.news, latest: null } } : prev));
    void dismissNews(card.id)
      .catch(() => {})
      .then(() => {
        void qc.invalidateQueries({ queryKey: qk.news });
        void qc.invalidateQueries({ queryKey: qk.overview });
      });
  };

  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)} layout={LinearTransition.duration(220)}>
      <Pressable
        onPress={() => router.push({ pathname: '/account/news/[id]', params: { id: card.id } })}
        accessibilityRole="button"
        accessibilityLabel={`Neu bei FinestSites: ${card.title}. ${card.summary} Mehr erfahren`}
        style={({ pressed }) => pressed && styles.pressed}>
        <NewsSolid palette={p} radius={CARD_RADIUS} contentStyle={styles.sheet}>
          <Text style={styles.kicker}>Neu bei FinestSites</Text>
          <Text style={styles.title} numberOfLines={2}>
            {card.title}
          </Text>
          <Text style={styles.summary} numberOfLines={1}>
            {card.summary}
          </Text>
          <Text style={styles.more}>Mehr erfahren ›</Text>
        </NewsSolid>
      </Pressable>
      <Pressable
        onPress={dismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Hinweis ausblenden"
        style={({ pressed }) => [styles.close, pressed && { backgroundColor: NEWS_ON_SOLID.wash }]}>
        <X size={14} color={colors.ink} strokeWidth={2.25} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // rechts Platz für das Kreuz (28 pt + 8 pt Rand)
  sheet: { paddingVertical: 16, paddingLeft: 18, paddingRight: 44, gap: 2 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.96 },
  kicker: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: NEWS_ON_SOLID.kicker, marginBottom: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 21, letterSpacing: -0.15, color: colors.ink },
  summary: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: NEWS_ON_SOLID.text },
  more: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 4 },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
