import type { NewsPalette } from './news-ui'

/**
 * Die Pastell-Unterkante einer Neuigkeiten-Karte: 3 px, volle Breite, folgt den Rundungen.
 * Der Elternteil braucht `position: relative; overflow: hidden; border-radius`, dann schneiden die
 * Ecken die Kante weich ab – sie wirkt wie ein farbiger Sockel, nicht wie ein aufgelegter Strich.
 */
export function NewsEdge({ palette, height = 3 }: { palette: NewsPalette; height?: number }) {
  return <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, background: palette.gradient, pointerEvents: 'none' }} />
}
