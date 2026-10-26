import { Check } from 'lucide-react'
import { newsBodyBlocks } from '@/lib/contracts/app-v1/news'
import { NEWS_PALETTES, NEWS_TOKENS, type NewsPalette } from './news-ui'

/**
 * Inhalt einer Neuigkeit – ausschließlich über `newsBodyBlocks()` aus dem Vertrag gerendert,
 * damit Web und App denselben Text identisch lesen. Der erste Absatz ist der Vorspann (größer),
 * Aufzählungen werden zu „Feature-Zeilen“: Häkchen in der Farbe der Neuigkeit auf ihrem fast weißen Kreis.
 */
export function NewsBodyBlocks({ body, size = 'md', palette = NEWS_PALETTES[0] }: { body: string; size?: 'sm' | 'md'; palette?: NewsPalette }) {
  const blocks = newsBodyBlocks(body)
  if (blocks.length === 0) return null
  const sm = size === 'sm'
  const leadSize = sm ? 14.5 : 18
  const textSize = sm ? 13.5 : 16.5
  const gap = sm ? 12 : 20
  const check = sm ? 18 : 22

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, color: NEWS_TOKENS.body }}>
      {blocks.map((b, i) => {
        if (b.type === 'paragraph') {
          const lead = i === 0
          return (
            <p key={i} style={{
              margin: 0, overflowWrap: 'anywhere',
              fontSize: lead ? leadSize : textSize,
              lineHeight: lead ? 1.55 : 1.7,
              fontWeight: lead ? 500 : 400,
              letterSpacing: lead ? '-0.15px' : 0,
              color: lead ? NEWS_TOKENS.lead : NEWS_TOKENS.body,
            }}>
              {b.text}
            </p>
          )
        }
        return (
          <ul key={i} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: sm ? 8 : 12 }}>
            {b.items.map((item, j) => (
              <li key={j} style={{ display: 'flex', gap: sm ? 10 : 14, alignItems: 'flex-start', overflowWrap: 'anywhere' }}>
                <span aria-hidden style={{
                  width: check, height: check, borderRadius: 999, background: palette.tint,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  marginTop: sm ? 1 : 3,
                }}>
                  <Check size={sm ? 11 : 13} strokeWidth={2.75} color={palette.ink} />
                </span>
                <span style={{ fontSize: textSize, lineHeight: sm ? 1.5 : 1.65, color: NEWS_TOKENS.body }}>{item}</span>
              </li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
