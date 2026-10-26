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

import { newsCardShadow, NewsGradient } from './NewsHero';

/**
 * Startkarte (Konzept Bild 4): die neueste Neuigkeit, die weder gelesen noch weggewischt ist – über
 * „Neue Webseite erstellen“. Schlanke „Tipp“-Karte: links die Verlauf-Kachel der Neuigkeit (ohne Symbol),
 * Kicker „NEU BEI FINESTSITES“, Titel, eine Zeile Kurztext, „Mehr erfahren ›“. Tipp → Detail,
 * Kreuz → weggewischt (gilt auch für das Web-Dashboard). Ein-/Ausblenden bleibt sanft.
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
        <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <NewsGradient seed={card.id} />
        </View>
        <View style={styles.content}>
          <Text style={styles.kicker}>NEU BEI FINESTSITES</Text>
          <Text style={styles.title} numberOfLines={2}>
            {card.title}
          </Text>
          <Text style={styles.summary} numberOfLines={1}>
            {card.summary}
          </Text>
          <Text style={styles.more}>Mehr erfahren ›</Text>
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
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingLeft: 14,
    paddingRight: 40,
    paddingVertical: 14,
    ...newsCardShadow,
  },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.96 },
  tile: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden', marginTop: 1 },
  content: { flex: 1, gap: 2 },
  kicker: { fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.8, color: colors.accent, marginBottom: 1 },
  title: { fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 21, letterSpacing: -0.15, color: colors.ink },
  summary: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.secondary },
  more: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.accent, marginTop: 4 },
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
