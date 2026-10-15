/**
 * Abmelde-Links für abbestellbare Mail-Kategorien.
 * Der Link enthält Nutzer-ID, Kategorie und eine HMAC-Signatur, damit niemand fremde Konten
 * abmelden kann. Kein Login nötig (der Nutzer klickt aus dem Mailprogramm).
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { EmailCategory } from './categories'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET
  if (!s) throw new Error('BETTER_AUTH_SECRET fehlt (für Abmelde-Links nötig)')
  return s
}

export function unsubscribeToken(userId: string, category: EmailCategory): string {
  return createHmac('sha256', secret()).update(`unsub:${userId}:${category}`).digest('hex').slice(0, 40)
}

export function verifyUnsubscribeToken(userId: string, category: EmailCategory, token: string): boolean {
  const expected = unsubscribeToken(userId, category)
  if (token.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export function unsubscribeUrl(userId: string, category: EmailCategory): string {
  const t = unsubscribeToken(userId, category)
  return `${APP_URL}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&c=${category}&t=${t}`
}

export const EMAIL_SETTINGS_URL = `${APP_URL}/settings?tab=mails`

/** Header für Mailprogramme (Gmail/Apple Mail zeigen damit einen eigenen Abmelden-Knopf) */
export function listUnsubscribeHeaders(url: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
