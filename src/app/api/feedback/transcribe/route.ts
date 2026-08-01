import { NextRequest, NextResponse } from 'next/server'

// Temporäre Feedback-Kampagne (anonym). Zum vollständigen Entfernen:
// siehe docs/feedback-aktion-entfernen.md

const MAX_AUDIO_BYTES = 15 * 1024 * 1024

// Rate limiter: max 12 Transkriptionen pro IP pro Minute
const rateLimiter = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimiter.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 12) return false
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

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getClientIp(req))) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte versuch es später nochmal.' }, { status: 429 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Transkription nicht verfügbar' }, { status: 503 })
  }

  let audio: File | null = null
  try {
    const form = await req.formData()
    const entry = form.get('audio')
    if (entry instanceof File) audio = entry
  } catch {
    // fällt unten in die Validierung
  }

  if (!audio || audio.size === 0) {
    return NextResponse.json({ error: 'Keine Audiodatei erhalten' }, { status: 400 })
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Aufnahme zu groß' }, { status: 413 })
  }

  // Endung aus dem tatsächlichen Typ ableiten — Whisper braucht eine passende Endung
  const type = (audio.type || '').toLowerCase()
  const ext =
    type.includes('webm') ? 'webm' :
    type.includes('ogg') ? 'ogg' :
    type.includes('wav') ? 'wav' :
    type.includes('mpeg') || type.includes('mp3') ? 'mp3' :
    type.includes('mp4') || type.includes('m4a') || type.includes('aac') ? 'm4a' :
    'webm'

  const openaiForm = new FormData()
  openaiForm.append('file', audio, `aufnahme.${ext}`)
  openaiForm.append('model', 'whisper-1')
  openaiForm.append('language', 'de')

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openaiForm,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[feedback/transcribe] OpenAI error:', res.status, detail.slice(0, 500))
      return NextResponse.json({ error: 'Transkription fehlgeschlagen' }, { status: 502 })
    }
    const data = (await res.json()) as { text?: string }
    return NextResponse.json({ text: (data.text ?? '').trim() })
  } catch (e) {
    console.error('[feedback/transcribe] request failed:', e)
    return NextResponse.json({ error: 'Transkription fehlgeschlagen' }, { status: 502 })
  }
}
