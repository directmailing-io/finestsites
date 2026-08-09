import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// Temporäre Feedback-Kampagne (anonym). Zum vollständigen Entfernen:
// siehe docs/feedback-aktion-entfernen.md

const TARIF_VALUES = ['starter', 'pro', 'unlimited']
const PREIS_VALUES = ['fair', 'okay', 'zu_teuer']
const GRUND_VALUES = ['zu_teuer', 'brauche_nicht', 'nicht_ueberzeugt', 'anderer']
const EMPFEHLUNG_VALUES = ['ja', 'nein']
const PARTNER_VALUES = ['provision', 'rabatt', 'anderes']

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

// Wunschpreis-Slider: 10 € bis zum aktuellen Tarifpreis
function cleanWunschpreis(v: unknown, max: number): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 10 && v <= max ? v : null
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
    // Presets + eigene Ideen (freier Text, kurz gehalten), max 3
    template_wuensche: Array.isArray(body.template_wuensche)
      ? body.template_wuensche
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map(t => t.trim().slice(0, 60))
          .slice(0, 3)
      : [],
    tarif: cleanEnum(body.tarif, TARIF_VALUES),
    upgrade_grund: cleanEnum(body.upgrade_grund, GRUND_VALUES),
    text_upgrade: cleanText(body.text_upgrade),
    preis_starter: cleanEnum(body.preis_starter, PREIS_VALUES),
    preis_pro: cleanEnum(body.preis_pro, PREIS_VALUES),
    preis_unlimited: cleanEnum(body.preis_unlimited, PREIS_VALUES),
    wunschpreis_starter: cleanWunschpreis(body.wunschpreis_starter, 17),
    wunschpreis_pro: cleanWunschpreis(body.wunschpreis_pro, 27),
    wunschpreis_unlimited: cleanWunschpreis(body.wunschpreis_unlimited, 37),
    empfehlung: cleanEnum(body.empfehlung, EMPFEHLUNG_VALUES),
    text_empfehlung: cleanText(body.text_empfehlung),
    partner_modell: cleanEnum(body.partner_modell, PARTNER_VALUES),
    text_partner: cleanText(body.text_partner),
    text_chef: cleanText(body.text_chef),
  }

  const hasContent =
    clean.note_optimalset !== null ||
    clean.note_business !== null ||
    clean.tarif !== null ||
    clean.upgrade_grund !== null ||
    clean.preis_starter !== null ||
    clean.preis_pro !== null ||
    clean.preis_unlimited !== null ||
    clean.empfehlung !== null ||
    clean.partner_modell !== null ||
    clean.template_wuensche.length > 0 ||
    [clean.text_optimalset, clean.text_business, clean.text_upgrade, clean.text_empfehlung, clean.text_partner, clean.text_chef]
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
