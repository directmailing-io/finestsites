import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { dismissNews } from '@/api/endpoints';
import { qk } from '@/api/queries';
import type { NewsCard, Overview } from '@/api/types';
import { Text } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

import { NEWS_UI, NewsEdge, newsSheetInner, newsSheetOuter } from './NewsAccent';

const CARD_RADIUS = 20;

/**
 * Startkarte: die neueste Neuigkeit, die weder gelesen noch weggewischt ist – über
 * „Neue Webseite erstellen“. Weiße Karte ohne Bild: Kicker „Neu bei FinestSites“ in Grau, Titel,
 * eine Zeile Kurztext, „Mehr erfahren ›“. Einziges Gestaltungselement ist die Pastell-Unterkante
 * der Neuigkeit (volle Breite, folgt den Rundungen). Tipp → Detail, Kreuz → weggewischt (gilt auch
 * für das Web-Dashboard).
 */
export function NewsStartCard({ card }: { card: NewsCard }) {
  const router = useRouter();
  const qc = useQueryClient();

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
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.sheet}>
          <Text style={styles.kicker}>Neu bei FinestSites</Text>
          <Text style={styles.title} numberOfLines={2}>
            {card.title}
          </Text>
          <Text style={styles.summary} numberOfLines={1}>
            {card.summary}
          </Text>
          <Text style={styles.more}>Mehr erfahren ›</Text>
          <NewsEdge seed={card.id} />
        </View>
      </Pressable>
      <Pressable
        onPress={dismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Hinweis ausblenden"
        style={({ pressed }) => [styles.close, pressed && { backgroundColor: colors.muted }]}>
        <X size={14} color={colors.tertiary} strokeWidth={2.25} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: newsSheetOuter(CARD_RADIUS),
  // rechts Platz für das Kreuz (28 pt + 8 pt Rand)
  sheet: { ...newsSheetInner(CARD_RADIUS), paddingVertical: 16, paddingLeft: 18, paddingRight: 44, gap: 2 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.96 },
  kicker: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.mutedForeground, marginBottom: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 21, letterSpacing: -0.15, color: colors.ink },
  summary: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: NEWS_UI.summary },
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
