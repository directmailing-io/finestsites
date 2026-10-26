import type { CSSProperties } from 'react'
import { NEWS_DRIFT_CLASS, NEWS_SHADOW_CLASS, type NewsPalette } from './news-ui'

/**
 * Die zwei Flächen der Neuigkeiten (Daniel 26.10.2026, Vorschläge 03 + 04 von /exemplare):
 *
 *  Vollton       – die neueste Neuigkeit (oberste Karte der Liste, Startkarte): die ganze Karte im
 *                  Pastellverlauf, Text in Tinte, „Weiterlesen“ als schwarze Pille.
 *  Verlaufsrahmen – alle weiteren Neuigkeiten und das Detail: weißes Blatt mit 1,5 px Verlaufsrahmen.
 *
 * Beide tragen `news-drift`: der Verlauf wandert in 18 s kaum merklich hin und her (steht bei
 * „Bewegung reduzieren“). Die App baut dieselben Flächen in mobile/src/features/news/NewsAccent.tsx.
 */

export const NEWS_FRAME_WIDTH = 1.5

/** Klassen + Stil des Vollton-Elements (das Element selbst ist die Fläche, z. B. ein Link). */
export const newsSolidClass = `${NEWS_DRIFT_CLASS} relative overflow-hidden ${NEWS_SHADOW_CLASS}`
export function newsSolidStyle(palette: NewsPalette, radius: number): CSSProperties {
  return { borderRadius: radius, backgroundImage: palette.surface }
}

/** Klassen + Stil des Rahmen-Elements; darin liegt genau ein Kind mit `newsFrameInnerStyle`. */
export const newsFrameClass = `${NEWS_DRIFT_CLASS} relative ${NEWS_SHADOW_CLASS}`
export function newsFrameStyle(palette: NewsPalette, radius: number): CSSProperties {
  return { borderRadius: radius, padding: NEWS_FRAME_WIDTH, backgroundImage: palette.surface }
}
export function newsFrameInnerStyle(radius: number): CSSProperties {
  return { position: 'relative', background: '#FFFFFF', borderRadius: Math.max(0, radius - NEWS_FRAME_WIDTH), overflow: 'hidden' }
}

/** Textfarben auf dem Vollton: Tinte bleibt, Nebentexte werden über Deckkraft zurückgenommen. */
export const NEWS_ON_SOLID = {
  kicker: 'rgba(17,24,39,0.62)',
  text: 'rgba(17,24,39,0.78)',
  pill: 'rgba(255,255,255,0.72)',
  /** Schwebe-/Druckfläche kleiner Knöpfe (Kreuz der Startkarte) */
  wash: 'rgba(255,255,255,0.5)',
} as const
