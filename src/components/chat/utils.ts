/** Hilfsfunktionen für die Chat-Oberfläche (Zeit, Avatar-Farbe, Gruppierung). */
import type { ChatMessage } from '@/lib/contracts/app-v1/chat'

const AVATAR_PALETTE = [
  { bg: '#FFE5D9', fg: '#9A3412' },
  { bg: '#FFE4E6', fg: '#9F1239' },
  { bg: '#E0E7FF', fg: '#3730A3' },
  { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#FEF3C7', fg: '#854D0E' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#F3E8FF', fg: '#6B21A8' },
  { bg: '#CFFAFE', fg: '#155E75' },
]

/** Stabile Farbe je Gespräch (Seed = Gesprächs-ID, ändert sich nie – auch wenn der Besucher später einen Namen angibt). */
export function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const fmtTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const fmtDateShort = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtDateLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Liste: Heute → HH:mm, Gestern, sonst Datum. */
export function listTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (sameDay(d, now)) return fmtTime.format(d)
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (sameDay(d, y)) return 'Gestern'
  return fmtDateShort.format(d)
}

export function clockTime(iso: string): string {
  return fmtTime.format(new Date(iso))
}

/** Tag-Trenner im Verlauf. */
export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (sameDay(d, now)) return 'Heute'
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (sameDay(d, y)) return 'Gestern'
  return fmtDateLong.format(d)
}

/** „zuletzt online vor 5 Min.“ */
export function lastSeenLabel(iso: string | null): string {
  if (!iso) return ''
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'gerade eben online'
  if (min < 60) return `zuletzt online vor ${min} Min.`
  const h = Math.floor(min / 60)
  if (h < 24) return `zuletzt online vor ${h} Std.`
  const d = new Date(iso)
  const now = new Date()
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (sameDay(d, y)) return `zuletzt online gestern um ${fmtTime.format(d)}`
  return `zuletzt online am ${fmtDateShort.format(d)}`
}

export type MessageRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage }

/** Verlauf mit Tag-Trennern. */
export function groupMessages(messages: ChatMessage[]): MessageRow[] {
  const rows: MessageRow[] = []
  let lastDay = ''
  for (const m of messages) {
    const d = new Date(m.createdAt)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (key !== lastDay) {
      rows.push({ kind: 'day', key: `day-${key}`, label: dayLabel(m.createdAt) })
      lastDay = key
    }
    rows.push({ kind: 'message', key: m.id, message: m })
  }
  return rows
}

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const REPORT_REASONS: { value: 'spam' | 'abuse' | 'illegal' | 'other'; label: string; hint: string }[] = [
  { value: 'spam', label: 'Spam oder Werbung', hint: 'Unerwünschte Angebote, immer gleiche Links' },
  { value: 'abuse', label: 'Beleidigung oder Belästigung', hint: 'Drohungen, Beschimpfungen, Bedrängen' },
  { value: 'illegal', label: 'Rechtswidriger Inhalt', hint: 'Betrug, verbotene Inhalte' },
  { value: 'other', label: 'Etwas anderes', hint: 'Bitte unten kurz beschreiben' },
]

export function reportReasonLabel(reason: string): string {
  return REPORT_REASONS.find(r => r.value === reason)?.label ?? reason
}
