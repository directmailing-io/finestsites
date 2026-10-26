import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Logo } from '@/components/ui';
import { colors } from '@/theme/tokens';

let heroCount = 0;

/**
 * Lila-Verlauf-Kopf der Neuigkeit (Konzept Bild 2: 135°, #7C3AED → #C4B5FD) mit weißer Wortmarke
 * unten links. Gezeichnet mit react-native-svg (schon in der App), ohne weiteres Paket.
 */
export function NewsHero({ height = 112 }: { height?: number }) {
  // Eigene Verlauf-Kennung je Instanz, falls zwei Köpfe auf einem Bildschirm stehen
  const [id] = useState(() => `news-hero-${(heroCount = (heroCount + 1) % 1000)}`);
  return (
    <View style={[styles.hero, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.accentDashed} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
        {/* weiche Lichtkreise wie Glas auf dem Sperrbildschirm */}
        <Circle cx="86%" cy="18%" r="64" fill={colors.white} opacity={0.14} />
        <Circle cx="70%" cy="105%" r="54" fill={colors.white} opacity={0.1} />
      </Svg>
      <View style={styles.brand}>
        <Logo height={16} color={colors.white} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden', justifyContent: 'flex-end' },
  brand: { paddingHorizontal: 20, paddingBottom: 16 },
});
