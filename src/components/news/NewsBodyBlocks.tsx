import { newsBodyBlocks } from '@/lib/contracts/app-v1/news'
import { NEWS_TOKENS } from './news-ui'

/**
 * Inhalt einer Neuigkeit – ausschließlich über `newsBodyBlocks()` aus dem Vertrag gerendert,
 * damit Web und App denselben Text identisch lesen. Absätze + Aufzählungen mit Punkt in Akzentfarbe.
 */
export function NewsBodyBlocks({ body, size = 'md' }: { body: string; size?: 'sm' | 'md' }) {
  const blocks = newsBodyBlocks(body)
  const fontSize = size === 'sm' ? 13 : 15
  const gap = size === 'sm' ? 10 : 14
  if (blocks.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, color: NEWS_TOKENS.body, fontSize, lineHeight: 1.55 }}>
      {blocks.map((b, i) =>
        b.type === 'paragraph' ? (
          <p key={i} style={{ margin: 0, overflowWrap: 'anywhere' }}>{b.text}</p>
        ) : (
          <ul key={i} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: size === 'sm' ? 4 : 6 }}>
            {b.items.map((item, j) => (
              <li key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', overflowWrap: 'anywhere' }}>
                <span aria-hidden style={{
                  width: 6, height: 6, borderRadius: 999, background: NEWS_TOKENS.accent,
                  flexShrink: 0, marginTop: size === 'sm' ? 7 : 9,
                }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}
