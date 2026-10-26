/**
 * Eingabe des Admin-Editors für Neuigkeiten (POST/PUT /api/admin/news…).
 * Grenzen laut docs/news/spec.md: title ≤ 80, pushTitle ≤ 40, pushBody ≤ 170, body ≤ 5000,
 * ctaLabel ≤ 30, ctaUrl nur bei ctaKind = 'url' und nur https://.
 * Deutsche Fehlermeldungen je Feld; leere Knopf-Felder werden zu null.
 */
import { z } from 'zod'
import { NewsCtaKind } from '@/lib/contracts/app-v1/news'

export const NewsAudience = z.enum(['all', 'plan:starter', 'plan:pro', 'plan:unlimited'])
export type NewsAudience = z.infer<typeof NewsAudience>

export const NEWS_LIMITS = {
  title: 80,
  pushTitle: 40,
  pushBody: 170,
  pushBodyRecommended: 110,
  body: 5000,
  ctaLabel: 30,
  ctaUrl: 500,
} as const

const optionalText = (max: number, tooLong: string) =>
  z.union([z.string().trim().max(max, tooLong), z.null(), z.undefined()]).transform(v => (v ? v : null))

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
  ctaLabel: optionalText(NEWS_LIMITS.ctaLabel, `Die Beschriftung des Knopfs darf höchstens ${NEWS_LIMITS.ctaLabel} Zeichen lang sein.`),
  ctaKind: z.union([NewsCtaKind, z.null(), z.undefined()], { error: 'Unbekanntes Ziel für den Knopf.' }).transform(v => v ?? null),
  ctaUrl: optionalText(NEWS_LIMITS.ctaUrl, `Der Link darf höchstens ${NEWS_LIMITS.ctaUrl} Zeichen lang sein.`),
  audience: NewsAudience.default('all'),
}).strict().superRefine((v, ctx) => {
  if (v.ctaLabel && !v.ctaKind) {
    ctx.addIssue({ code: 'custom', path: ['ctaKind'], message: 'Bitte ein Ziel für den Knopf wählen.' })
  }
  if (v.ctaKind && !v.ctaLabel) {
    ctx.addIssue({ code: 'custom', path: ['ctaLabel'], message: 'Bitte eine Beschriftung für den Knopf eingeben.' })
  }
  if (v.ctaKind === 'url') {
    if (!v.ctaUrl) {
      ctx.addIssue({ code: 'custom', path: ['ctaUrl'], message: 'Bitte einen Link eingeben (beginnt mit https://).' })
    } else if (!/^https:\/\/\S+$/i.test(v.ctaUrl) || !isHttpsUrl(v.ctaUrl)) {
      ctx.addIssue({ code: 'custom', path: ['ctaUrl'], message: 'Der Link muss mit https:// beginnen und gültig sein.' })
    }
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
