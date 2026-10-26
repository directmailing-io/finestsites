import { useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * Fünf Pastell-Verläufe für die Neuigkeiten (1:1 mit dem Web, src/components/news/news-ui.ts):
 * jede Neuigkeit bekommt eine Farbe – als feine Linie, nie als Fläche, Bild oder Symbol.
 * `tint` = helle Fläche (Pille „Neu“, Häkchen-Kreis), `ink` = lesbare Schriftfarbe desselben Tons.
 */
export const NEWS_PALETTES = [
  { name: 'peach', from: '#F7C4B4', to: '#F6DFA9', tint: '#FDF3EF', ink: '#B45F4A' },
  { name: 'mint', from: '#CDE8D3', to: '#BBD6F2', tint: '#F0F8F2', ink: '#3F7A5A' },
  { name: 'lavender', from: '#D9D3F3', to: '#F5C9DC', tint: '#F4F1FB', ink: '#6B5BB5' },
  { name: 'apricot', from: '#F6DFA9', to: '#CDE8D3', tint: '#FCF6EA', ink: '#9A7A2C' },
  { name: 'sky', from: '#BBD6F2', to: '#D9D3F3', tint: '#EFF5FC', ink: '#3F6BA8' },
] as const;

export type NewsPalette = (typeof NEWS_PALETTES)[number];

/** Deterministisch aus der Kennung (gleiche Formel wie im Web): gewichtete Zeichensumme modulo Tabellenlänge. */
export function newsPalette(seed: string): NewsPalette {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % 9973;
  return NEWS_PALETTES[h % NEWS_PALETTES.length];
}

/** Grautöne der Neuigkeiten-Karten (wie im Web): Rahmen, Datum, Kurztext, Vorspann. */
export const NEWS_UI = {
  line: '#ECEEF2',
  date: '#8A94A6',
  summary: '#5B6472',
  lead: '#1F2937',
} as const;

/** Sehr weicher Karten-Schatten: weiße Karte auf #FAFAFA, Rahmen 1 pt trägt die Kontur. */
export const newsCardShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: { shadowColor: '#101828', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 14 },
  default: { elevation: 3 },
});

/** Regenbogen des Leerzustands (Pfirsich → Aprikose → Minze → Himmel), oben links nach unten rechts. */
const RAINBOW = [
  { offset: 0, color: '#F4B9AE' },
  { offset: 0.35, color: '#F5DBA2' },
  { offset: 0.68, color: '#CBE6CD' },
  { offset: 1, color: '#B8D2F1' },
] as const;

let gradientCount = 0;
/** Eigene Verlauf-Kennung je Instanz (mehrere Verläufe auf einem Bildschirm dürfen sich nicht teilen). */
function useGradientId(prefix: string) {
  const [id] = useState(() => `${prefix}-${(gradientCount = (gradientCount + 1) % 100000)}`);
  return id;
}

/**
 * Die Pastell-Linie einer Neuigkeit: 3 pt hoch (oder 4 pt breit, `vertical`), beide Enden rund,
 * Zwei-Stopp-Verlauf von `from` nach `to`. Füllt die Breite/Höhe des Elternrahmens.
 */
export function NewsAccentLine({
  seed,
  thickness = 3,
  vertical = false,
  style,
}: {
  seed: string;
  thickness?: number;
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useGradientId('news-line');
  const p = newsPalette(seed);
  const r = thickness / 2;
  return (
    <View
      style={[vertical ? { width: thickness, alignSelf: 'stretch' } : { height: thickness, alignSelf: 'stretch' }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
            <Stop offset="0" stopColor={p.from} />
            <Stop offset="1" stopColor={p.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={r} ry={r} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Das „f“ der Wortmarke (public/logos/logo-black.svg, Seitenverhältnis 68.71:126), gefüllt mit dem Pastell-Regenbogen. */
export function NewsGlyph({ height = 44 }: { height?: number }) {
  const id = useGradientId('news-glyph');
  const width = (height * 68.71) / 126;
  return (
    <View style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height} viewBox="0 0 68.71 126">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {RAINBOW.map(s => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </LinearGradient>
        </Defs>
        <Path
          fill={`url(#${id})`}
          d="M18.33,126a18.31,18.31,0,0,1-9.26-2.58c-6.17-3.73-9.36-10.86-9-17.94C.87,85.92,14.13,77.23,28.63,71.84c-.06-2.72-.13-5.61-.21-8.9A59.28,59.28,0,0,1,1,64.07L3.75,50.56a46.28,46.28,0,0,0,24.32-2c-.07-3.32-.14-6.67-.19-10,0-1.3-.07-2.62-.12-4-.23-6.6-.49-14.08,2-21.06C32.77,5,40.25-.32,48.8,0S64.16,6.18,66.48,14.88c2.45,9.17-1,17.83-4.32,23.48a52.69,52.69,0,0,1-20.09,19c.09,3.38.17,6.76.26,10.14a88,88,0,0,0,14.31-5.26q2.56-1.24,5-2.69,2.59,4.47,5.21,8.9l1.76,3a84.83,84.83,0,0,1-21.4,9c-1.57.45-3.09.89-4.56,1.33.09,3.45.19,7.11.32,11.45.31,10.12-2.9,22.3-11.48,28.5A22.28,22.28,0,0,1,18.33,126ZM29,86.59c-9.35,4.18-14.77,9.59-15.2,19.49-.1,2.34.65,4.53,1.88,5.42a4.81,4.81,0,0,0,3.19.72c8.6-.72,10.52-12.46,10.33-18.56C29.13,91.1,29.06,88.78,29,86.59Zm19.08-72.8c-1.87,0-4.2,1.14-5.34,4.37-1.6,4.51-1.39,10.33-1.19,16,.05,1.43.1,2.84.12,4.22,0,.91,0,1.83,0,2.74a36.14,36.14,0,0,0,8.55-9.72c1.63-2.77,4.17-8.12,2.89-12.91-.77-2.86-2.55-4.56-4.9-4.65Z"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: { alignItems: 'center', justifyContent: 'center' },
});
