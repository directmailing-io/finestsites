import { useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Logo } from '@/components/ui';
import { colors } from '@/theme/tokens';

/**
 * Vier Marken-Verläufe für die Neuigkeiten (Apple-„Today“-Gefühl, 1:1 mit dem Web):
 * welcher Verlauf, entscheidet die Kennung der Neuigkeit – immer gleich, in Liste, Detail und Startkarte.
 */
export const NEWS_PALETTES = [
  { name: 'violet', from: '#7C3AED', to: '#C4B5FD' },
  { name: 'indigo', from: '#4C1D95', to: '#8B5CF6' },
  { name: 'dusk', from: '#5B21B6', to: '#EC4899' },
  { name: 'aurora', from: '#6D28D9', to: '#22D3EE' },
] as const;

export type NewsPalette = (typeof NEWS_PALETTES)[number];

/** Deterministisch aus der Kennung (gleiche Formel wie im Web): Summe der Zeichen modulo 4. */
export function newsPalette(seed: string): NewsPalette {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % 9973;
  return NEWS_PALETTES[h % NEWS_PALETTES.length];
}

/** Karten-Schatten der Neuigkeiten: wie shadows.card, einen Hauch kräftiger (weiß auf #FAFAFA braucht Tiefe). */
export const newsCardShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.09, shadowRadius: 14 },
  default: { elevation: 5 },
});

let gradientCount = 0;

/**
 * Verlauf-Fläche mit zwei bis drei großen, sehr weichen Lichtkreisen – keine Symbole. Füllt den
 * Elternrahmen (absolut), deshalb braucht der Rahmen Breite/Höhe und overflow hidden.
 */
export function NewsGradient({ seed, style }: { seed: string; style?: StyleProp<ViewStyle> }) {
  // Eigene Verlauf-Kennung je Instanz (mehrere Verläufe auf einem Bildschirm dürfen sich nicht teilen)
  const [id] = useState(() => `news-grad-${(gradientCount = (gradientCount + 1) % 10000)}`);
  const p = newsPalette(seed);
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.from} />
            <Stop offset="1" stopColor={p.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
      </Svg>
      {/* Lichtkreise in echten Pixeln (nicht verzerrt), über dem gestreckten Verlauf: radial weich auslaufend, kein Rand */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.white} stopOpacity={0.36} />
            <Stop offset="0.5" stopColor={colors.white} stopOpacity={0.12} />
            <Stop offset="1" stopColor={colors.white} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="80%" cy="16%" r="60%" fill={`url(#${id}-glow)`} />
        <Circle cx="44%" cy="122%" r="66%" fill={`url(#${id}-glow)`} opacity={0.85} />
        <Circle cx="2%" cy="34%" r="36%" fill={`url(#${id}-glow)`} opacity={0.55} />
      </Svg>
    </View>
  );
}

/**
 * Verlauf-Kopf einer Neuigkeit mit kleiner weißer Wortmarke oben links.
 * Liste: 96 pt · Detail: 160 pt.
 */
export function NewsHero({ seed, height = 96, logoHeight = 12 }: { seed: string; height?: number; logoHeight?: number }) {
  return (
    <View style={[styles.hero, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <NewsGradient seed={seed} />
      <View style={styles.brand}>
        <Logo height={logoHeight} color={colors.white} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden' },
  brand: { position: 'absolute', top: 16, left: 20, opacity: 0.92 },
});
