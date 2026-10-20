/**
 * Massenversand an Nutzer, immer mit Kategorie.
 *
 * Das ist der EINE Weg für "Mail X an alle Nutzer" (Admin-Newsletter, Skripte, Launch-Mails):
 *  1. Empfänger laden (alle oder eine Vorauswahl)
 *  2. jeden rauswerfen, der die Kategorie abbestellt hat (außer Kategorie "system")
 *  3. Mail mit Footer (Abbestellen + Einstellungen) und List-Unsubscribe-Headern bauen
 *  4. in 100er-Paketen über Resend senden, jede Mail in email_logs protokollieren
 *
 * Übersprungene Empfänger landen ebenfalls im Log (status "skipped"), damit man im Admin sieht,
 * wer absichtlich keine Mail bekommen hat.
 */
import { db } from '@/lib/db'
import { users, emailLogs } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { newsletterEmail, personalEmail, personalEmailText, type PrefsFooter } from '@/lib/email/templates'
import { markupToHtml } from '@/lib/email/markup'
import { isEmailCategoryAllowed, emailCategoryLabel, type EmailCategory } from '@/lib/email/categories'
import { unsubscribeUrl, listUnsubscribeHeaders, EMAIL_SETTINGS_URL } from '@/lib/email/unsubscribe'

export interface BulkRecipient {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  username: string | null
}

export interface BulkResult {
  sent: number
  failed: number
  skipped: number
  total: number
  skippedEmails: string[]
}

/** {{vorname}} / {{nachname}} / {{username}} / {{email}}, optional mit Fallback {{vorname|Hallo}} */
export function interpolate(text: string, u: BulkRecipient): string {
  return text.replace(/\{\{(\w+)(?:\|([^}]*))?\}\}/g, (m, field: string, fb?: string) => {
    const f = fb ?? ''
    switch (field) {
      case 'vorname':  return u.firstName?.trim() || f || 'du'
      case 'nachname': return u.lastName?.trim()  || f || ''
      case 'username': return u.username?.trim()  || f || ''
      case 'email':    return u.email
      default:         return m
    }
  })
}

/** Alle Konten mit gültiger Adresse, je Adresse nur einmal */
export async function loadAllRecipients(): Promise<BulkRecipient[]> {
  const rows = await db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, username: users.username })
    .from(users).orderBy(users.email)
  const seen = new Set<string>()
  return rows.filter(u => u.email?.includes('@') && !seen.has(u.email.toLowerCase()) && seen.add(u.email.toLowerCase()))
}

/**
 * Teilt eine Empfängerliste in "darf" und "hat abbestellt". Liest die Opt-outs frisch aus der DB,
 * damit auch eine Liste aus dem Admin-Frontend (die älter sein kann) korrekt gefiltert wird.
 */
export async function splitByOptOut<T extends { id: string; email: string }>(recipients: T[], category: EmailCategory): Promise<{ allowed: T[]; skipped: T[] }> {
  if (category === 'system' || recipients.length === 0) return { allowed: recipients, skipped: [] }
  const optOut = new Map<string, string[]>()
  for (let i = 0; i < recipients.length; i += 500) {
    const ids = recipients.slice(i, i + 500).map(r => r.id)
    const rows = await db.select({ id: users.id, emailOptOut: users.emailOptOut }).from(users).where(inArray(users.id, ids))
    for (const r of rows) optOut.set(r.id, r.emailOptOut ?? [])
  }
  const allowed: T[] = [], skipped: T[] = []
  for (const r of recipients) (isEmailCategoryAllowed(optOut.get(r.id), category) ? allowed : skipped).push(r)
  return { allowed, skipped }
}

export async function sendCategoryMail({
  category,
  type = 'newsletter',
  subject,
  body,
  buildHtml,
  recipients,
  dryRun = false,
  onProgress,
  personal = false,
  from = FROM_EMAIL,
  replyTo,
}: {
  category: EmailCategory
  /** email_logs.type, z. B. 'newsletter' oder 'product_update' */
  type?: string
  /** Betreff mit Platzhaltern */
  subject: string
  /** Text im Mail-Markup (src/lib/email/markup.ts) mit Platzhaltern; alternativ `buildHtml` */
  body?: string
  /** Fertige Vorlage aus templates.ts (bekommt den Footer über `prefs`), statt `body` */
  buildHtml?: (u: BulkRecipient, prefs?: PrefsFooter) => string
  recipients: BulkRecipient[]
  /** true = nur zählen und filtern, nichts senden, nichts loggen */
  dryRun?: boolean
  onProgress?: (msg: string) => void
  /** true = `body` als schlichte persönliche Mail (personalEmail) statt Newsletter-Layout, mit Textfassung */
  personal?: boolean
  /** Absender, z. B. 'Daniel Kurzeja <info@finestsites.io>' */
  from?: string
  /** Antworten gehen an diese Adresse */
  replyTo?: string
}): Promise<BulkResult> {
  if (!body && !buildHtml) throw new Error('sendCategoryMail: body oder buildHtml angeben')
  const { allowed, skipped } = await splitByOptOut(recipients, category)
  const result: BulkResult = { sent: 0, failed: 0, skipped: skipped.length, total: recipients.length, skippedEmails: skipped.map(s => s.email) }
  onProgress?.(`${recipients.length} Empfänger, davon ${skipped.length} abbestellt (${emailCategoryLabel(category)}), ${allowed.length} werden angeschrieben`)
  if (dryRun) return result

  const categoryLabel = emailCategoryLabel(category)
  const optional = category !== 'system'

  if (skipped.length) {
    await db.insert(emailLogs).values(skipped.map(u => ({
      type, category, to: u.email, subject: interpolate(subject, u), status: 'skipped' as const,
      errorMessage: `Kategorie „${categoryLabel}“ vom Nutzer abbestellt`,
    }))).catch(e => console.error('[bulk] log error:', e.message))
  }

  const resend = getResend()
  for (let i = 0; i < allowed.length; i += 100) {
    const chunk = allowed.slice(i, i + 100)
    const payloads = chunk.map(u => {
      const personalSubject = interpolate(subject, u)
      const unsub = optional ? unsubscribeUrl(u.id, category) : null
      const prefs: PrefsFooter | undefined = unsub ? { categoryLabel, unsubscribeUrl: unsub, settingsUrl: EMAIL_SETTINGS_URL } : undefined
      const html = buildHtml
        ? buildHtml(u, prefs)
        : personal
          ? personalEmail({ body: interpolate(body!, u), prefs })
          : newsletterEmail({ subject: personalSubject, bodyHtml: markupToHtml(interpolate(body!, u)), prefs })
      const text = !buildHtml && personal ? personalEmailText({ body: interpolate(body!, u), prefs }) : undefined
      return { u, personalSubject, html, text, headers: unsub ? listUnsubscribeHeaders(unsub) : undefined }
    })
    try {
      const res = await resend.batch.send(payloads.map(p => ({
        from, to: p.u.email, subject: p.personalSubject, html: p.html,
        ...(p.text ? { text: p.text } : {}), ...(replyTo ? { replyTo } : {}), ...(p.headers ? { headers: p.headers } : {}),
      })))
      if (res.error) {
        result.failed += chunk.length
        await db.insert(emailLogs).values(payloads.map(p => ({
          type, category, to: p.u.email, subject: p.personalSubject, status: 'error' as const, errorMessage: res.error?.message ?? 'Batch error',
        }))).catch(e => console.error('[bulk] log error:', e.message))
        onProgress?.(`Paket ${i / 100 + 1}: Resend-Fehler ${res.error.message}`)
        continue
      }
      // Resend batch.send() liefert { data: [...] } oder { data: { data: [...] } }
      const raw = res.data as unknown
      const items: Array<{ id?: string } | null> = Array.isArray(raw) ? raw : Array.isArray((raw as { data?: unknown })?.data) ? (raw as { data: Array<{ id?: string }> }).data : []
      const ok = items.filter(r => r?.id).length
      const okResolved = items.length > 0 ? ok : chunk.length
      result.sent += okResolved; result.failed += chunk.length - okResolved
      await db.insert(emailLogs).values(payloads.map((p, idx) => ({
        type, category, to: p.u.email, subject: p.personalSubject,
        resendId: items[idx]?.id ?? undefined, status: items[idx]?.id || items.length === 0 ? 'sent' as const : 'error' as const,
      }))).catch(e => console.error('[bulk] log error:', e.message))
      onProgress?.(`Paket ${i / 100 + 1}: ${okResolved}/${chunk.length} gesendet`)
    } catch (err) {
      result.failed += chunk.length
      console.error('[bulk] batch exception:', err)
    }
  }
  return result
}
