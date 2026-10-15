/**
 * Abmelden einer Mail-Kategorie per Link aus der Mail (kein Login nötig, Signatur im Link).
 *  GET  → Klick im Mailprogramm: Kategorie abbestellen, kleine Bestätigungsseite anzeigen
 *  POST → List-Unsubscribe-Post (One-Click aus Gmail/Apple Mail), antwortet nur mit 200
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { isEmailCategory, OPTIONAL_EMAIL_CATEGORIES, emailCategoryLabel, type EmailCategory } from '@/lib/email/categories'
import { verifyUnsubscribeToken, EMAIL_SETTINGS_URL } from '@/lib/email/unsubscribe'

export const runtime = 'nodejs'

type Parsed = { userId: string; category: EmailCategory } | null

function parse(req: NextRequest): Parsed {
  const p = req.nextUrl.searchParams
  const userId = p.get('u') ?? ''
  const category = p.get('c') ?? ''
  const token = p.get('t') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !isEmailCategory(category) || !OPTIONAL_EMAIL_CATEGORIES.includes(category) || !token) return null
  if (!verifyUnsubscribeToken(userId, category, token)) return null
  return { userId, category }
}

/** Kategorie in email_opt_out aufnehmen (idempotent) */
async function optOut(userId: string, category: EmailCategory): Promise<boolean> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, emailOptOut: true } })
  if (!u) return false
  if (!(u.emailOptOut ?? []).includes(category)) {
    await db.update(users)
      .set({ emailOptOut: [...(u.emailOptOut ?? []), category], emailOptOutUpdatedAt: sql`now()` })
      .where(eq(users.id, userId))
  }
  return true
}

function page(title: string, text: string, ok: boolean): NextResponse {
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:480px;margin:64px auto;padding:0 16px;text-align:center;">
  <img src="https://app.finestsites.io/logos/logo-black.svg" alt="FinestSites" height="26" style="height:26px;width:auto;margin-bottom:28px;"/>
  <div style="background:#fff;border:1px solid #E5E7EB;border-radius:20px;padding:36px 28px;">
    <div style="width:44px;height:44px;border-radius:50%;margin:0 auto 16px;background:${ok ? '#DCFCE7' : '#FEE2E2'};display:flex;align-items:center;justify-content:center;font-size:20px;color:${ok ? '#16A34A' : '#DC2626'};">${ok ? '✓' : '!'}</div>
    <h1 style="margin:0 0 10px;font-size:20px;color:#111827;">${title}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${text}</p>
    <a href="${EMAIL_SETTINGS_URL}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:100px;">E-Mail-Einstellungen öffnen</a>
  </div>
</div></body></html>`
  return new NextResponse(html, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export async function GET(req: NextRequest) {
  const parsed = parse(req)
  if (!parsed) return page('Link ungültig', 'Dieser Abmelde-Link ist nicht mehr gültig. Du kannst deine Mails jederzeit in den Einstellungen anpassen.', false)
  const found = await optOut(parsed.userId, parsed.category)
  if (!found) return page('Konto nicht gefunden', 'Zu diesem Link gibt es kein Konto mehr.', false)
  const label = emailCategoryLabel(parsed.category)
  return page('Erledigt', `Du bekommst ab jetzt keine Mails der Art „${label}“ mehr. Wichtige Mails zu Konto und Zahlung kommen weiterhin.`, true)
}

export async function POST(req: NextRequest) {
  const parsed = parse(req)
  if (!parsed) return NextResponse.json({ ok: false }, { status: 400 })
  await optOut(parsed.userId, parsed.category)
  return NextResponse.json({ ok: true })
}
