import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { testimonials, testimonialAssets } from '@/lib/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { deleteFromR2 } from '@/lib/r2/client'
import { sendEmail } from '@/lib/resend'
import { testimonialThanksEmail, testimonialAdminNotifyEmail } from '@/lib/email/templates'
import { hashConsentText } from '@/lib/constants/consent'
import {
  TESTIMONIAL_CONSENT_CURRENT_VERSION,
  getCurrentTestimonialConsentText,
} from '@/lib/constants/testimonial-consent'
import {
  createRateLimiter, getClientIp, getAuthorizedDraft, getVerifiedAssets, MAX_TEXT_LENGTH,
} from '@/lib/testimonials/server'

const rateLimit = createRateLimiter(3, 60 * 60_000)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function cleanOptional(val: unknown, max: number): string | null {
  const s = typeof val === 'string' ? val.trim() : ''
  return s ? s.slice(0, max) : null
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte versuch es später nochmal.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    submissionId, uploadToken, text, textSource, fullName, displayNameMode,
    age, email, instagram, tiktok, facebook, consentAccepted, website,
  } = body

  // Honeypot: Bots füllen das unsichtbare Feld — stilles OK ohne Insert
  if (typeof website === 'string' && website.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const draft = await getAuthorizedDraft(String(submissionId ?? ''), String(uploadToken ?? ''))
  if (!draft) {
    return NextResponse.json({ error: 'Sitzung ungültig oder abgelaufen.' }, { status: 403 })
  }

  // Timing-Check: menschliche Durchläufe brauchen länger als 20 Sekunden
  if (Date.now() - draft.createdAt.getTime() < 20_000) {
    return NextResponse.json({ ok: true })
  }

  const cleanText = typeof text === 'string' ? text.trim().slice(0, MAX_TEXT_LENGTH) : ''
  const cleanName = typeof fullName === 'string' ? fullName.trim().slice(0, 200) : ''
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 320) : ''

  if (!cleanText) {
    return NextResponse.json({ error: 'Bitte erzähl uns kurz deine Erfahrung.' }, { status: 400 })
  }
  if (!cleanName || cleanName.length < 3 || !cleanName.includes(' ')) {
    return NextResponse.json({ error: 'Bitte gib deinen vollständigen Namen an (Vor- und Nachname).' }, { status: 400 })
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return NextResponse.json({ error: 'Bitte gib eine gültige E-Mail-Adresse an.' }, { status: 400 })
  }
  if (!['full', 'abbreviated'].includes(displayNameMode)) {
    return NextResponse.json({ error: 'Bitte wähle, wie dein Name angezeigt werden soll.' }, { status: 400 })
  }
  if (consentAccepted !== true) {
    return NextResponse.json({ error: 'Ohne deine Einwilligung können wir den Bericht nicht verwenden.' }, { status: 400 })
  }

  const cleanAge = Number.isInteger(age) && age >= 16 && age <= 120 ? age : null

  // Nicht verifizierte Assets aufräumen (abgebrochene/ungültige Uploads)
  const assets = await getVerifiedAssets(draft.id)
  const stale = assets.filter(a => a.status !== 'verified')
  for (const a of stale) {
    await deleteFromR2(a.r2Key).catch(() => {})
  }
  if (stale.length) {
    await db.delete(testimonialAssets).where(and(
      eq(testimonialAssets.testimonialId, draft.id),
      ne(testimonialAssets.status, 'verified'),
    ))
  }

  const consentHash = await hashConsentText(getCurrentTestimonialConsentText())

  await db.update(testimonials).set({
    status: 'new',
    text: cleanText,
    textSource: ['typed', 'dictated', 'mixed'].includes(textSource) ? textSource : 'typed',
    fullName: cleanName,
    displayNameMode,
    age: cleanAge,
    email: cleanEmail,
    instagram: cleanOptional(instagram, 300),
    tiktok: cleanOptional(tiktok, 300),
    facebook: cleanOptional(facebook, 300),
    consentVersion: TESTIMONIAL_CONSENT_CURRENT_VERSION,
    consentHash,
    consentIp: ip.slice(0, 64),
    consentUa: (req.headers.get('user-agent') ?? '').slice(0, 500),
    consentedAt: new Date(),
    submittedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(testimonials.id, draft.id))

  const firstName = cleanName.split(' ')[0]

  // Fire-and-forget: E-Mails dürfen den Submit nie blockieren
  sendEmail({
    to: cleanEmail,
    subject: 'Danke für deinen Erfahrungsbericht · FinestSites',
    html: testimonialThanksEmail({ firstName }),
    type: 'testimonial_thanks',
  }).catch(() => {})

  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL ?? 'hello@finestsites.io'
  const verifiedCount = assets.filter(a => a.status === 'verified').length
  sendEmail({
    to: adminEmail,
    subject: `Neuer Erfahrungsbericht: ${cleanName} (${draft.category})`,
    html: testimonialAdminNotifyEmail({ name: cleanName, category: draft.category, assetCount: verifiedCount }),
    type: 'testimonial_admin_notify',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
