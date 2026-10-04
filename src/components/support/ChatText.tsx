import type { ReactNode } from 'react'

/**
 * Support chat message text.
 * - line breaks are always kept
 * - with `formatted` (messages written by the support team) a tiny, safe subset of
 *   Markdown is rendered: **fett** and *kursiv*. Everything is built from React nodes,
 *   never from HTML, so message text can never inject markup.
 */
const FORMAT_RE = /\*\*(?=\S)([^\n]*?\S)\*\*|\*(?=[^\s*])([^*\n]*?[^\s*])\*/g

export function ChatText({ text, formatted }: { text: string; formatted?: boolean }) {
  return <span style={{ whiteSpace: 'pre-wrap' }}>{formatted ? formatNodes(text) : text}</span>
}

function formatNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(FORMAT_RE)) {
    const start = m.index ?? 0
    if (start > last) nodes.push(text.slice(last, start))
    if (m[1] !== undefined) nodes.push(<strong key={key++} style={{ fontWeight: 700 }}>{formatItalic(m[1], key)}</strong>)
    else nodes.push(<em key={key++}>{m[2]}</em>)
    last = start + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** Italic inside bold: **wichtig und *kursiv*** */
function formatItalic(text: string, keyBase: number): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(/\*(?=[^\s*])([^*\n]*?[^\s*])\*/g)) {
    const start = m.index ?? 0
    if (start > last) nodes.push(text.slice(last, start))
    nodes.push(<em key={`${keyBase}-${i++}`}>{m[1]}</em>)
    last = start + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** Plain text for one-line previews: formatting markers removed, line breaks become spaces. */
export function chatPreviewText(text: string, formatted?: boolean): string {
  const plain = formatted
    ? text.replace(FORMAT_RE, (_m, bold, italic) => bold ?? italic).replace(FORMAT_RE, (_m, bold, italic) => bold ?? italic)
    : text
  return plain.replace(/\s*\n\s*/g, ' ')
}

/** Phones have no Shift+Enter: there Enter makes a new line and the send button sends. */
export function enterSends(): boolean {
  return typeof window === 'undefined' || !window.matchMedia('(pointer: coarse)').matches
}
