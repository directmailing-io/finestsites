import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { CONSENT_CURRENT_VERSION, getCurrentConsentText, hashConsentText } from '@/lib/constants/consent'

/**
 * POST /api/auth/consent
 *
 * Records the user's explicit content consent.
 * Called once at onboarding after the user checks the box and submits.
 *
 * Stored for legal proof:
 *  - content_consent_at       — exact timestamp (UTC)
 *  - content_consent_ip       — IP address (from Cloudflare/proxy headers)
 *  - content_consent_ua       — User-Agent string
 *  - content_consent_version  — which version of the text (e.g. "v1")
 *  - content_consent_text_hash — SHA-256 of the exact consent text
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the client sent the correct consent flag
  let body: { consent?: boolean; version?: string } = {}
  try { body = await req.json() } catch { /* no body */ }

  if (!body.consent) {
    return NextResponse.json({ error: 'Consent not given.' }, { status: 400 })
  }

  // Only accept the current version
  const version = CONSENT_CURRENT_VERSION
  const text = getCurrentConsentText()
  const textHash = await hashConsentText(text)

  // Server-side: extract IP from Cloudflare or proxy headers
  const ip = (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  ).slice(0, 64)

  const ua = (req.headers.get('user-agent') ?? '').slice(0, 512)

  await db.update(users).set({
    contentConsentAt: new Date(),
    contentConsentIp: ip,
    contentConsentUa: ua,
    contentConsentVersion: version,
    contentConsentTextHash: textHash,
  }).where(eq(users.id, user.id))

  return NextResponse.json({ ok: true })
}
