import { Resend } from 'resend'

// Lazy singleton — avoids "Missing API key" error at build time
let _resend: Resend | null = null
export function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? '')
  return _resend
}

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? 'FinestSites <noreply@finestsites.de>'

/**
 * Send an email and log it to the email_logs table.
 * Always fire-and-forget safe — never throws.
 */
export async function sendEmail({
  to,
  subject,
  html,
  type,
  from = FROM_EMAIL,
  headers,
}: {
  to: string
  subject: string
  html: string
  type: string
  from?: string
  headers?: Record<string, string>
}): Promise<void> {
  // Dynamic import to avoid circular deps and keep Edge-safe
  const { db } = await import('@/lib/db')
  const { emailLogs } = await import('@/lib/db/schema')

  let resendId: string | undefined
  let status: 'sent' | 'error' = 'sent'
  let errorMessage: string | undefined

  try {
    const result = await getResend().emails.send({ from, to, subject, html, ...(headers ? { headers } : {}) })
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

  // Log regardless of success/failure — fire-and-forget
  db.insert(emailLogs).values({ type, to, subject, resendId, status, errorMessage })
    .catch((e: Error) => console.error('[sendEmail] log error:', e.message))
}
