import type { ReactNode } from 'react'

/**
 * Nachrichtentext im Besucher-Chat: Zeilenumbrüche bleiben, http(s)-Links werden anklickbar.
 * Alles wird aus React-Knoten gebaut (nie aus HTML), Text kann also kein Markup einschleusen.
 */
const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi

function trimTrailing(url: string): [string, string] {
  // Satzzeichen am Ende gehören meist nicht zum Link: „… siehe https://x.de.“
  const m = url.match(/[.,;:!?)\]]+$/)
  if (!m) return [url, '']
  const cut = m[0].length
  return [url.slice(0, -cut), url.slice(-cut)]
}

export function shortenUrl(url: string, max = 48): string {
  const bare = url.replace(/^https?:\/\//i, '')
  return bare.length > max ? `${bare.slice(0, max - 1)}…` : bare
}

export function ChatMessageText({ text, linkColor }: { text: string; linkColor: string }) {
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0
    const [url, rest] = trimTrailing(m[0])
    if (start > last) nodes.push(text.slice(last, start))
    nodes.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        style={{ color: linkColor, textDecoration: 'underline', textUnderlineOffset: 2, wordBreak: 'break-all' }}
        onClick={e => e.stopPropagation()}
      >
        {shortenUrl(url)}
      </a>,
    )
    if (rest) nodes.push(rest)
    last = start + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{nodes}</span>
}
