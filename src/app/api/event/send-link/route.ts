import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'
import { eventSaveLinkEmail } from '@/lib/email/templates'
import { getClientIp, rateLimit } from '@/lib/security/request'
import { getEventConfig, eventPageUrl } from '@/lib/event/config'
import { getActiveCampaign } from '@/lib/billing/campaign'

/**
 * „Für später speichern“ auf der Event-Seite: schickt der Person auf ihren eigenen Wunsch EINE Mail
 * mit dem Link zur Seite und dem Ablauf des Angebots. Nichts wird gespeichert, es folgt keine
 * weitere Mail. Eng gedrosselt, weil ohne Anmeldung erreichbar.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!rateLimit('event-send-link-ip', ip, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte speichere die Seite über „Teilen“ oder als Lesezeichen.' }, { status: 429 })
  }
  let body: { slug?: string; email?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 }) }
  const event = getEventConfig(String(body.slug ?? ''))
  if (!event) return NextResponse.json({ error: 'Unbekanntes Event.' }, { status: 404 })
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Bitte prüfe deine E-Mail-Adresse.' }, { status: 400 })
  }
  if (!rateLimit('event-send-link-mail', email, 2, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: true }) // still, nicht verraten; die Adresse hat die Mail schon
  }

  const campaign = await getActiveCampaign()
  const endsAt = campaign && campaign.code === event.code && campaign.endsAt ? new Date(campaign.endsAt) : null
  const result = await sendEmail({
    to: email,
    subject: `Dein Link zum ${event.name}-Angebot`,
    html: eventSaveLinkEmail({ eventName: event.name, url: eventPageUrl(event), endsAt }),
    type: 'event_link',
  })
  if (result.status === 'error') {
    return NextResponse.json({ error: 'Die Mail konnte gerade nicht verschickt werden. Bitte speichere die Seite über „Teilen“.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
