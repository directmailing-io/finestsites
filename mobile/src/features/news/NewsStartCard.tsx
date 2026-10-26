import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Sparkles, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { dismissNews } from '@/api/endpoints';
import { qk } from '@/api/queries';
import type { NewsCard, Overview } from '@/api/types';
import { Text } from '@/components/ui';
import { colors, fonts, radius } from '@/theme/tokens';

/**
 * Startkarte (Konzept Bild 4): die neueste Neuigkeit, die weder gelesen noch weggewischt ist – über
 * „Neue Webseite erstellen“. Tipp → Detail, Kreuz → weggewischt (gilt auch für das Web-Dashboard).
 * Erscheint und verschwindet mit sanftem Ein-/Ausblenden; der Knopf darunter rückt weich nach.
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
        <View style={styles.kicker}>
          <Sparkles size={13} color={colors.accent} strokeWidth={2.5} />
          <Text variant="overline" color={colors.accent}>
            Neu bei FinestSites
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {card.title}
        </Text>
        <Text variant="callout" color={colors.body} style={styles.summary}>
          {card.summary}
          <Text variant="calloutStrong" color={colors.accent}>
            {'  Mehr erfahren ›'}
          </Text>
        </Text>
      </Pressable>
      <Pressable
        onPress={dismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Hinweis ausblenden"
        style={({ pressed }) => [styles.close, pressed && { backgroundColor: colors.accentSoftBorder }]}>
        <X size={15} color={colors.secondary} strokeWidth={2.25} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accentSoftBorder,
    borderRadius: radius.input,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 44,
    gap: 3,
  },
  pressed: { backgroundColor: colors.accentWash },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, letterSpacing: -0.1, color: colors.ink },
  summary: { lineHeight: 20 },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
