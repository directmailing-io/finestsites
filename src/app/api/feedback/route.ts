import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// Temporäre Feedback-Kampagne (anonym). Zum vollständigen Entfernen:
// siehe docs/feedback-aktion-entfernen.md

const TARIF_VALUES = ['starter', 'pro', 'unlimited', 'unbekannt']
const BLOCKER_OPTIONS = [
  'Zu teuer',
  'Mein Tarif reicht mir',
  'Brauche die Extras nicht',
  'Weiß nicht, was drin wäre',
  'Hab nie drüber nachgedacht',
]

// Rate limiter: max 5 Submissions pro IP pro 10 Minuten
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimiter.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + 10 * 60_000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function cleanNote(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6 ? v : null
}

function cleanText(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, 3000) : ''
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getClientIp(req))) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte versuch es später nochmal.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const clean = {
    note_webseite: cleanNote(body.note_webseite),
    text_webseite: cleanText(body.text_webseite),
    text_templates: cleanText(body.text_templates),
    note_preise: cleanNote(body.note_preise),
    text_preise: cleanText(body.text_preise),
    tarif: typeof body.tarif === 'string' && TARIF_VALUES.includes(body.tarif) ? body.tarif : null,
    upgrade_blocker: Array.isArray(body.upgrade_blocker)
      ? body.upgrade_blocker.filter((b): b is string => typeof b === 'string' && BLOCKER_OPTIONS.includes(b))
      : [],
    text_upgrade: cleanText(body.text_upgrade),
    text_chef: cleanText(body.text_chef),
    text_offen: cleanText(body.text_offen),
  }

  const hasContent =
    clean.note_webseite !== null ||
    clean.note_preise !== null ||
    clean.tarif !== null ||
    clean.upgrade_blocker.length > 0 ||
    [clean.text_webseite, clean.text_templates, clean.text_preise, clean.text_upgrade, clean.text_chef, clean.text_offen]
      .some(t => t.length > 0)

  if (!hasContent) {
    return NextResponse.json({ error: 'Bitte beantworte mindestens eine Frage.' }, { status: 400 })
  }

  try {
    await db.execute(sql`INSERT INTO feedback_responses (answers) VALUES (${JSON.stringify(clean)}::jsonb)`)
  } catch (e) {
    console.error('[feedback] insert failed:', e)
    return NextResponse.json({ error: 'Fehler beim Speichern. Bitte versuch es nochmal.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
