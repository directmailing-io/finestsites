import { NextRequest, NextResponse } from 'next/server'
import { checkCompliance } from '@/lib/compliance/check'
import { createRateLimiter, getClientIp, getAuthorizedDraft } from '@/lib/testimonials/server'

const rateLimit = createRateLimiter(60, 60 * 60_000)

// Erfahrungsberichte landen später in Werbematerial für Lebensmittel. Dort gilt
// HCVO Art. 12(b) strenger als im Editor: Abnehm-Zahlen sind IMMER tabu.
const WIZARD_EXTRA_RULES = `═══ ZUSATZREGELN FÜR DIESEN KONTEXT (haben Vorrang) ═══

Dieser Text ist ein Erfahrungsbericht, der in Werbematerialien für Lebensmittel erscheint. Deshalb gilt strenger als oben:
- Konkrete Abnehm-Zahlen und Abnehm-Zeiträume ("8 Kilo", "in 3 Wochen abgenommen") sind IMMER ein Verstoß, auch OHNE Produktattribution (HCVO Art. 12(b)). Diese Zusatzregel geht der Regel "Persönliche Ergebnisse ohne Produktattribution" vor.
- In der Umformulierung solche Angaben durch allgemeine Formulierungen ohne Zahlen und Zeiträume ersetzen, z. B. "Ich habe abgenommen und fühle mich richtig wohl in meinem Körper."`

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').trim()
}

// Live-KI-Check einer einzelnen Wizard-Antwort auf Heil- und Wirkaussagen.
// approvedText = zuletzt akzeptierte Fassung → Bestandsschutz verhindert,
// dass ein übernommener Vorschlag erneut bemängelt wird.
export async function POST(req: NextRequest) {
  if (!rateLimit(getClientIp(req))) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte versuch es später nochmal.' }, { status: 429 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Prüfung nicht verfügbar.' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const draft = await getAuthorizedDraft(String(body.submissionId ?? ''), String(body.uploadToken ?? ''))
  if (!draft) {
    return NextResponse.json({ error: 'Sitzung ungültig oder abgelaufen.' }, { status: 403 })
  }

  const text = String(body.text ?? '').trim()
  const approvedText = String(body.approvedText ?? '').trim().slice(0, 4000)
  if (text.length < 10 || text.length > 2500) {
    return NextResponse.json({ error: 'Textlänge ungültig.' }, { status: 400 })
  }

  try {
    const result = await checkCompliance(text, approvedText, apiKey, WIZARD_EXTRA_RULES)
    if (result.ok) return NextResponse.json({ ok: true })
    return NextResponse.json({
      ok: false,
      issues: result.issues.map(i => ({ quote: stripHtml(i.quote), reason: stripHtml(i.reason) })),
      suggestion: stripHtml(result.suggested_html),
    })
  } catch (err) {
    console.error('[erfahrungsbericht/check-text]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Prüfung gerade nicht möglich.' }, { status: 502 })
  }
}
