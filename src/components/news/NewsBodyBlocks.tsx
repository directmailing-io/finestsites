import { Check } from 'lucide-react'
import { newsBodyBlocks } from '@/lib/contracts/app-v1/news'
import { NEWS_TOKENS } from './news-ui'
import { NEWS_ON_SOLID } from './NewsSurface'

/**
 * Inhalt einer Neuigkeit – ausschließlich über `newsBodyBlocks()` aus dem Vertrag gerendert,
 * damit Web und App denselben Text identisch lesen. Der erste Absatz ist der Vorspann (größer),
 * Aufzählungen werden zu ruhigen Zeilen mit einem dunklen Häkchen auf hellem Kreis – keine Farbe.
 * `onSolid`: auf dem Pastellverlauf der aufgeklappten Karte (Tinte über Deckkraft, weißliche Kreise).
 */
export function NewsBodyBlocks({ body, size = 'md', onSolid = false }: { body: string; size?: 'sm' | 'md'; onSolid?: boolean }) {
  const blocks = newsBodyBlocks(body)
  if (blocks.length === 0) return null
  const sm = size === 'sm'
  const leadSize = sm ? 14.5 : 17
  const textSize = sm ? 13.5 : 15.5
  const gap = sm ? 12 : 16
  const check = sm ? 18 : 22
  const leadColor = onSolid ? NEWS_TOKENS.ink : NEWS_TOKENS.lead
  const bodyColor = onSolid ? NEWS_ON_SOLID.body : NEWS_TOKENS.body
  const checkBg = onSolid ? NEWS_ON_SOLID.check : '#F3F4F6'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, color: bodyColor }}>
      {blocks.map((b, i) => {
        if (b.type === 'paragraph') {
          const lead = i === 0
          return (
            <p key={i} style={{
              margin: 0, overflowWrap: 'anywhere',
              fontSize: lead ? leadSize : textSize,
              lineHeight: lead ? 1.5 : 1.65,
              fontWeight: lead ? 500 : 400,
              letterSpacing: lead ? '-0.15px' : 0,
              color: lead ? leadColor : bodyColor,
            }}>
              {b.text}
            </p>
          )
        }
        return (
          <ul key={i} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: sm ? 8 : 10 }}>
            {b.items.map((item, j) => (
              <li key={j} style={{ display: 'flex', gap: sm ? 10 : 12, alignItems: 'flex-start', overflowWrap: 'anywhere' }}>
                <span aria-hidden style={{
                  width: check, height: check, borderRadius: 999, background: checkBg,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  marginTop: sm ? 1 : 2,
                }}>
                  <Check size={sm ? 11 : 13} strokeWidth={2.75} color={NEWS_TOKENS.ink} />
                </span>
                <span style={{ fontSize: textSize, lineHeight: sm ? 1.5 : 1.6, color: bodyColor }}>{item}</span>
              </li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}
