import type { CSSProperties } from 'react'
import { NEWS_DRIFT_CLASS, NEWS_SHADOW_CLASS, type NewsPalette } from './news-ui'

/**
 * Die Fläche jeder Neuigkeit (Daniel 26.10.2026, Vorschlag 04 „Vollton“ von /exemplare): die ganze
 * Karte im Pastellverlauf der Neuigkeit, Text in Tinte. Jede Neuigkeit hat eine von fünf Farben,
 * damit keine untergeht. Trägt `news-drift`: der Verlauf wandert in 18 s kaum merklich hin und her
 * (steht bei „Bewegung reduzieren“). Die App baut dieselbe Fläche in mobile/src/features/news/NewsAccent.tsx.
 */

/** Klassen + Stil des Vollton-Elements (das Element selbst ist die Fläche). */
export const newsSolidClass = `${NEWS_DRIFT_CLASS} relative overflow-hidden ${NEWS_SHADOW_CLASS}`
export function newsSolidStyle(palette: NewsPalette, radius: number): CSSProperties {
  return { borderRadius: radius, backgroundImage: palette.surface }
}

/** Textfarben auf dem Vollton: Tinte bleibt, Nebentexte werden über Deckkraft zurückgenommen. */
export const NEWS_ON_SOLID = {
  kicker: 'rgba(17,24,39,0.62)',
  text: 'rgba(17,24,39,0.78)',
  body: 'rgba(17,24,39,0.84)',
  pill: 'rgba(255,255,255,0.72)',
  /** Häkchen-Kreis der Aufzählungen auf dem Verlauf */
  check: 'rgba(255,255,255,0.62)',
  /** Schwebe-/Druckfläche kleiner Knöpfe (Kreuz der Startkarte, „Zuklappen“) */
  wash: 'rgba(255,255,255,0.5)',
  /** Feine Trennlinie zwischen Vorschau und Inhalt */
  line: 'rgba(17,24,39,0.1)',
} as const
