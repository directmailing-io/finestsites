import { Logo } from '@/components/shared/Logo'
import { NewsLogoGlyph } from './NewsLogoGlyph'
import type { NewsPalette } from './news-ui'

/**
 * Das Kopfband einer Neuigkeit: Markenverlauf, zwei bis drei sehr weiche, große Lichtkreise
 * (keine Icons, keine Illustration) und klein oben links die weiße FinestSites-Wortmarke.
 * Höhe kommt von außen (className), damit Liste, Detail und Vorschau eigene Maße haben.
 */
export function NewsHeroBand({
  palette, className = '', wordmark = true, wordmarkHeight = 14, inset = 24, children,
}: {
  palette: NewsPalette
  className?: string
  wordmark?: boolean
  wordmarkHeight?: number
  /** Abstand der Wortmarke zum Rand */
  inset?: number
  children?: React.ReactNode
}) {
  return (
    <div aria-hidden className={`relative overflow-hidden ${className}`} style={{ background: palette.gradient }}>
      {/* Lichtkreise – groß, sehr zart, teils über den Rand hinaus; einer davon als weiches Leuchten */}
      <span className="absolute rounded-full" style={{ width: '56%', paddingTop: '56%', right: '-12%', top: '-74%', background: 'rgba(255,255,255,0.13)' }} />
      <span className="absolute rounded-full" style={{ width: '40%', paddingTop: '40%', right: '22%', bottom: '-82%', background: 'rgba(255,255,255,0.09)' }} />
      <span className="absolute rounded-full" style={{ width: '70%', paddingTop: '70%', left: '-18%', top: '-120%', background: 'radial-gradient(circle, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.07) 45%, rgba(255,255,255,0) 70%)' }} />
      {/* ein Hauch Tiefe unten, damit der Übergang in die weiße Karte weich wirkt */}
      <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.06) 100%)' }} />
      {wordmark && (
        <span className="absolute" style={{ left: inset, top: inset - 4, opacity: 0.92, lineHeight: 0 }}>
          <Logo variant="white" height={wordmarkHeight} />
        </span>
      )}
      {children}
    </div>
  )
}

/**
 * Miniatur des Kopfbands (z. B. 44×44 auf der Startkarte oder 60×36 im Leerzustand).
 * Mit `glyph` sitzt das weiße „f“ der Wortmarke in der Mitte (Startkarte) – kein Icon, die Marke.
 */
export function NewsHeroMini({ palette, width, height, radius, glyph = false }: { palette: NewsPalette; width: number; height: number; radius: number; glyph?: boolean }) {
  return (
    <span aria-hidden className="relative block overflow-hidden flex-shrink-0" style={{ width, height, borderRadius: radius, background: palette.gradient }}>
      <span className="absolute rounded-full" style={{ width: '90%', paddingTop: '90%', right: '-38%', top: '-50%', background: 'rgba(255,255,255,0.12)' }} />
      <span className="absolute rounded-full" style={{ width: '70%', paddingTop: '70%', left: '-24%', bottom: '-48%', background: 'rgba(255,255,255,0.08)' }} />
      {glyph && (
        <span className="absolute inset-0 flex items-center justify-center" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.10))' }}>
          <NewsLogoGlyph height={Math.round(height * 0.5)} color="#fff" />
        </span>
      )}
    </span>
  )
}
