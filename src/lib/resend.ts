import { Resend } from 'resend'
import { EMAIL_TYPE_CATEGORY, isEmailCategoryAllowed, emailCategoryLabel, type EmailCategory } from '@/lib/email/categories'

// Lazy singleton — avoids "Missing API key" error at build time
let _resend: Resend | null = null
export function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? '')
  return _resend
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'FinestSites <info@finestsites.io>'

/**
 * Send an email and log it to the email_logs table.
 * Always fire-and-forget safe — never throws.
 *
 * Oberste Regel: Jede Mail hat eine Kategorie (src/lib/email/categories.ts). Ist sie nicht
 * "system", wird VOR dem Versand geprüft, ob der Empfänger diese Kategorie abbestellt hat.
 * Dann wird nichts gesendet und der Log-Eintrag bekommt status "skipped".
 * Ohne `category` gilt die feste Zuordnung aus EMAIL_TYPE_CATEGORY, sonst "system".
 * Bei abbestellbaren Kategorien kommen automatisch List-Unsubscribe-Header dazu.
 */
export async function sendEmail({
  to,
  subject,
  html,
  type,
  category,
  from = FROM_EMAIL,
  headers,
  logTo,
}: {
  to: string
  subject: string
  html: string
  type: string
  category?: EmailCategory
  from?: string
  headers?: Record<string, string>
  /** Abweichender Empfänger im email_logs-Eintrag (z. B. Grabstein-Adresse bei der Lösch-Bestätigung) */
  logTo?: string
}): Promise<{ status: 'sent' | 'error' | 'skipped' }> {
  // Dynamic import to avoid circular deps and keep Edge-safe
  const { db } = await import('@/lib/db')
  const { emailLogs, users } = await import('@/lib/db/schema')
  const { eq } = await import('drizzle-orm')

  const cat: EmailCategory = category ?? EMAIL_TYPE_CATEGORY[type] ?? 'system'
  let resendId: string | undefined
  let status: 'sent' | 'error' | 'skipped' = 'sent'
  let errorMessage: string | undefined
  let extraHeaders: Record<string, string> = headers ?? {}

  // Gelöschte Konten (Grabstein-Adresse, src/lib/account-deletion) bekommen nie Mails
  if (/@deleted\.invalid$/i.test(to)) {
    status = 'skipped'
    errorMessage = 'Konto gelöscht'
  } else if (cat !== 'system') {
    try {
      const u = await db.query.users.findFirst({ where: eq(users.email, to), columns: { id: true, emailOptOut: true } })
      if (u && !isEmailCategoryAllowed(u.emailOptOut, cat)) {
        status = 'skipped'
        errorMessage = `Kategorie „${emailCategoryLabel(cat)}“ vom Nutzer abbestellt`
      } else if (u) {
        const { unsubscribeUrl, listUnsubscribeHeaders } = await import('@/lib/email/unsubscribe')
        extraHeaders = { ...listUnsubscribeHeaders(unsubscribeUrl(u.id, cat)), ...extraHeaders }
      }
    } catch (e) {
      // Prüfung darf den Versand von Pflichtmails nie blockieren; bei optionalen Mails lieber nicht senden
      console.error(`[sendEmail] opt-out check failed for ${to}:`, e instanceof Error ? e.message : e)
      status = 'error'
      errorMessage = 'Opt-out-Prüfung fehlgeschlagen, Mail nicht gesendet'
    }
  }

  if (status === 'sent') {
    try {
      const result = await getResend().emails.send({
        from, to, subject, html,
        ...(Object.keys(extraHeaders).length ? { headers: extraHeaders } : {}),
      })
      if (result.error) {
        status = 'error'
        errorMessage = result.error.message
      } else {
        resendId = result.data?.id ?? undefined
      }
    } catch (e) {
      status = 'error'
      errorMessage = e instanceof Error ? e.message : String(e)
      console.error(`[sendEmail] type=${type} to=${to} error:`, errorMessage)
    }
  }

  // Log regardless of success/failure — fire-and-forget
  db.insert(emailLogs).values({ type, category: cat, to: logTo ?? to, subject, resendId, status, errorMessage })
    .catch((e: Error) => console.error('[sendEmail] log error:', e.message))

  return { status }
}
