/**
 * Eingabe des Admin-Editors für Neuigkeiten (POST/PUT /api/admin/news…).
 * Grenzen laut docs/news/spec.md: title ≤ 80, pushTitle ≤ 40, pushBody ≤ 170, body ≤ 5000,
 * ctaLabel ≤ 30, ctaUrl nur bei ctaKind = 'url' und nur https://.
 * Zielgruppe: all | plan:<tarif> | users (dann audienceUserIds = 1…200 Konten, sonst leer).
 * expiresAt = „Sichtbar bis“ als Kalendertag YYYY-MM-DD (Ende des Tages Europe/Berlin) oder null.
 * Deutsche Fehlermeldungen je Feld; leere Knopf-Felder werden zu null.
 */
import { z } from 'zod'
import { NewsCtaKind } from '@/lib/contracts/app-v1/news'
import { Uuid } from '@/lib/contracts/app-v1/common'

export const NewsAudience = z.enum(['all', 'plan:starter', 'plan:pro', 'plan:unlimited', 'users'])
export type NewsAudience = z.infer<typeof NewsAudience>

export const NEWS_LIMITS = {
  title: 80,
  pushTitle: 40,
  pushBody: 170,
  pushBodyRecommended: 110,
  body: 5000,
  ctaLabel: 30,
  ctaUrl: 500,
  audienceUsers: 200,
} as const

const optionalText = (max: number, tooLong: string) =>
  z.union([z.string().trim().max(max, tooLong), z.null(), z.undefined()]).transform(v => (v ? v : null))

/** Kalendertag „YYYY-MM-DD“ (Datumsfeld im Editor) oder leer. */
const ExpiresDay = z.union([
  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte ein gültiges Datum wählen.'),
  z.literal(''),
  z.null(),
  z.undefined(),
]).transform(v => (v ? v : null))

export const NewsAdminInput = z.object({
  title: z.string({ error: 'Bitte eine Überschrift eingeben.' }).trim()
    .min(1, 'Bitte eine Überschrift eingeben.')
    .max(NEWS_LIMITS.title, `Die Überschrift darf höchstens ${NEWS_LIMITS.title} Zeichen lang sein.`),
  pushTitle: z.string({ error: 'Bitte einen Titel für die Mitteilung eingeben.' }).trim()
    .min(1, 'Bitte einen Titel für die Mitteilung eingeben.')
    .max(NEWS_LIMITS.pushTitle, `Der Titel der Mitteilung darf höchstens ${NEWS_LIMITS.pushTitle} Zeichen lang sein.`),
  pushBody: z.string({ error: 'Bitte einen Text für die Mitteilung eingeben.' }).trim()
    .min(1, 'Bitte einen Text für die Mitteilung eingeben.')
    .max(NEWS_LIMITS.pushBody, `Der Text der Mitteilung darf höchstens ${NEWS_LIMITS.pushBody} Zeichen lang sein.`),
  body: z.string({ error: 'Bitte einen Inhalt eingeben.' }).trim()
    .min(1, 'Bitte einen Inhalt eingeben.')
    .max(NEWS_LIMITS.body, `Der Inhalt darf höchstens ${NEWS_LIMITS.body} Zeichen lang sein.`),
  ctaLabel: optionalText(NEWS_LIMITS.ctaLabel, `Der Text auf dem Knopf darf höchstens ${NEWS_LIMITS.ctaLabel} Zeichen lang sein.`),
  ctaKind: z.union([NewsCtaKind, z.null(), z.undefined()], { error: 'Unbekanntes Ziel für den Knopf.' }).transform(v => v ?? null),
  ctaUrl: optionalText(NEWS_LIMITS.ctaUrl, `Der Link darf höchstens ${NEWS_LIMITS.ctaUrl} Zeichen lang sein.`),
  audience: NewsAudience.default('all'),
  audienceUserIds: z.array(Uuid, { error: 'Bitte gültige Konten wählen.' })
    .max(NEWS_LIMITS.audienceUsers, `Höchstens ${NEWS_LIMITS.audienceUsers} Konten.`)
    .default([]),
  expiresAt: ExpiresDay,
}).strict().superRefine((v, ctx) => {
  if (v.ctaLabel && !v.ctaKind) {
    ctx.addIssue({ code: 'custom', path: ['ctaKind'], message: 'Bitte wählen, wohin der Knopf führt.' })
  }
  if (v.ctaKind && !v.ctaLabel) {
    ctx.addIssue({ code: 'custom', path: ['ctaLabel'], message: 'Bitte einen Text für den Knopf eingeben.' })
  }
  if (v.ctaKind === 'url') {
    if (!v.ctaUrl) {
      ctx.addIssue({ code: 'custom', path: ['ctaUrl'], message: 'Bitte einen Link eingeben (beginnt mit https://).' })
    } else if (!/^https:\/\/\S+$/i.test(v.ctaUrl) || !isHttpsUrl(v.ctaUrl)) {
      ctx.addIssue({ code: 'custom', path: ['ctaUrl'], message: 'Der Link muss mit https:// beginnen und gültig sein.' })
    }
  }
  if (v.audience === 'users' && v.audienceUserIds.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['audienceUserIds'], message: 'Bitte mindestens ein Konto wählen.' })
  }
  if (v.expiresAt && Number.isNaN(Date.parse(`${v.expiresAt}T00:00:00Z`))) {
    ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Bitte ein gültiges Datum wählen.' })
  }
}).transform(v => ({
  title: v.title,
  pushTitle: v.pushTitle,
  pushBody: v.pushBody,
  body: v.body,
  ctaLabel: v.ctaKind ? v.ctaLabel : null,
  ctaKind: v.ctaLabel ? v.ctaKind : null,
  ctaUrl: v.ctaKind === 'url' && v.ctaLabel ? v.ctaUrl : null,
  audience: v.audience,
  // Nur bei „Bestimmte Nutzer“ gefüllt, ohne Dubletten (Reihenfolge der Auswahl bleibt)
  audienceUserIds: v.audience === 'users' ? Array.from(new Set(v.audienceUserIds.map(id => id.toLowerCase()))) : [],
  expiresAt: v.expiresAt ? berlinEndOfDay(v.expiresAt) : null,
}))
export type NewsAdminInput = z.output<typeof NewsAdminInput>

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'https:' && !!u.hostname
  } catch {
    return false
  }
}

/**
 * Ende des Kalendertags (YYYY-MM-DD) in Europe/Berlin als Zeitpunkt = Beginn des Folgetags 00:00 Berlin.
 * Rechnet die Zeitzone über den Offset des Zielzeitpunkts aus (Sommer-/Winterzeit sicher).
 */
export function berlinEndOfDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  const nextUtcMidnight = Date.UTC(y, m - 1, d + 1, 0, 0, 0)
  // Berlin ist UTC+1/+2 → 00:00 Berlin liegt 1–2 h VOR 00:00 UTC desselben Datums
  const guess = new Date(nextUtcMidnight - 2 * 3600_000)
  const offsetMin = berlinOffsetMinutes(guess)
  return new Date(nextUtcMidnight - offsetMin * 60_000)
}

function berlinOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - at.getTime()) / 60_000)
}

/** Zod-Fehler → { feld: Meldung } (erste Meldung je Feld) + eine Gesamtmeldung. */
export function newsInputErrors(err: z.ZodError): { error: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = issue.path.length ? String(issue.path[0]) : '_'
    if (!(key in fields)) fields[key] = issue.message
  }
  const first = Object.values(fields)[0] ?? 'Bitte die Eingaben prüfen.'
  return { error: first, fields }
}
