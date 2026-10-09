/**
 * POST /api/worker/tracking-status — Worker-intern. Ergebnis der letzten Server-Übertragung
 * (für die Statusanzeige im Reiter „Werbung“) und E-Mail „Dein Tracking funktioniert“ beim
 * ersten echten, angenommenen Lead.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { trackingConfigs, userSites, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { checkWorkerSecret } from '@/lib/tracking/worker-auth'
import { sendEmail } from '@/lib/resend'
import { trackingFirstLeadEmail } from '@/lib/email/templates'

export async function POST(req: NextRequest) {
  if (!checkWorkerSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { siteId?: string; platform?: string; ok?: boolean; error?: string; event?: string } | null
  if (!body || !/^[0-9a-f-]{36}$/i.test(body.siteId ?? '')) return NextResponse.json({ error: 'bad request' }, { status: 400 })

  try {
    const [row] = await db
      .select({ cfg: trackingConfigs, email: users.email, firstName: users.firstName })
      .from(userSites)
      .innerJoin(trackingConfigs, eq(trackingConfigs.userId, userSites.userId))
      .innerJoin(users, eq(users.id, userSites.userId))
      .where(eq(userSites.id, body.siteId!))
      .limit(1)
    if (!row) return NextResponse.json({ ok: true })

    const now = new Date()
    const firstLead = body.ok && body.event === 'Lead' && !row.cfg.firstLeadAt
    await db.update(trackingConfigs).set({
      lastSendAt: now,
      lastSendPlatform: String(body.platform ?? '').slice(0, 20),
      lastSendStatus: body.ok ? 'ok' : 'error',
      lastSendError: body.ok ? null : String(body.error ?? 'Unbekannter Fehler').slice(0, 500),
      ...(firstLead ? { firstLeadAt: now } : {}),
    }).where(eq(trackingConfigs.id, row.cfg.id))

    if (firstLead && !row.cfg.firstLeadNotifiedAt) {
      await db.update(trackingConfigs).set({ firstLeadNotifiedAt: now }).where(eq(trackingConfigs.id, row.cfg.id))
      sendEmail({
        to: row.email,
        subject: 'Dein Tracking funktioniert: erste Anfrage an Meta übertragen',
        html: trackingFirstLeadEmail({ firstName: row.firstName ?? '' }),
        type: 'tracking_first_lead',
      }).catch(err => console.error('[tracking-status] mail', err))
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[worker/tracking-status]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
