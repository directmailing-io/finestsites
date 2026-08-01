import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// Temporäre Feedback-Kampagne (anonym). Zum vollständigen Entfernen:
// siehe docs/feedback-aktion-entfernen.md

const TARIF_VALUES = ['starter', 'pro', 'unlimited', 'unbekannt']
const TEMPLATE_OPTIONS = [
  'Mama-Business-Seite',
  'Stoffwechselkur-Seite',
  'ProShape-Seite',
  'Sportler-Seite',
  'Beauty & Pflege-Seite',
  'Vitalcheck-Seite',
  'Gesund im Alter-Seite',
  'Muskelaufbau-Seite',
]
const PREIS_VALUES = ['zu_teuer', 'geht_so', 'fair', 'guenstig']
const GRUND_VALUES = ['zu_teuer', 'nicht_ueberzeugt', 'anderer']
const EMPFEHLUNG_VALUES = ['ja', 'nein']

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

function cleanEnum(v: unknown, allowed: string[]): string | null {
  return typeof v === 'string' && allowed.includes(v) ? v : null
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
    note_optimalset: cleanNote(body.note_optimalset),
    text_optimalset: cleanText(body.text_optimalset),
    note_business: cleanNote(body.note_business),
    text_business: cleanText(body.text_business),
    template_wuensche: Array.isArray(body.template_wuensche)
      ? body.template_wuensche
          .filter((t): t is string => typeof t === 'string' && TEMPLATE_OPTIONS.includes(t))
          .slice(0, 3)
      : [],
    text_templates: cleanText(body.text_templates),
    tarif: cleanEnum(body.tarif, TARIF_VALUES),
    preis_meinung: cleanEnum(body.preis_meinung, PREIS_VALUES),
    text_preise: cleanText(body.text_preise),
    upgrade_grund: cleanEnum(body.upgrade_grund, GRUND_VALUES),
    text_upgrade: cleanText(body.text_upgrade),
    empfehlung: cleanEnum(body.empfehlung, EMPFEHLUNG_VALUES),
    text_empfehlung: cleanText(body.text_empfehlung),
    text_chef: cleanText(body.text_chef),
  }

  const hasContent =
    clean.note_optimalset !== null ||
    clean.note_business !== null ||
    clean.preis_meinung !== null ||
    clean.tarif !== null ||
    clean.upgrade_grund !== null ||
    clean.empfehlung !== null ||
    clean.template_wuensche.length > 0 ||
    [clean.text_optimalset, clean.text_business, clean.text_templates, clean.text_preise, clean.text_upgrade, clean.text_empfehlung, clean.text_chef]
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
