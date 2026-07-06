import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'

/**
 * Compliance check for user-generated text about food supplements.
 *
 * Validates against:
 *   - HCVO 1924/2006 (EU Health Claims Regulation)
 *   - 432/2012 (approved-claims list)
 *
 * Returns either { ok: true } or { ok: false, issues, suggested_html }.
 * The suggested rewrite preserves the user's writing style, length and HTML formatting.
 */

type CheckResponse =
  | { ok: true; changed_input: boolean }
  | { ok: false; issues: Array<{ quote: string; reason: string }>; suggested_html: string }

const SYSTEM_PROMPT = `Du bist ein strenger Compliance-Prüfer für Vertriebspartner von Nahrungsergänzungsmitteln (NEM) in Deutschland. Du prüfst Texte auf Verstöße gegen die EU-Health-Claims-Verordnung (HCVO 1924/2006 + VO 432/2012) und das HWG (Heilmittelwerbegesetz).

═══ DEINE AUFGABE ═══
Erkenne JEDE Form von Heil- oder Wirkungsaussage – auch wenn sie indirekt, implizit oder als persönliche Geschichte verpackt ist. Im Zweifel immer als Verstoß werten und umformulieren.

═══ WAS VERBOTEN IST ═══

1. DIREKTE WIRKUNGSZUSCHREIBUNG:
   ✗ "Das Optimalset hat meine Migräne geheilt."
   ✗ "Durch das Produkt habe ich endlich wieder Energie."
   ✗ "Hilft gegen Müdigkeit, Gelenkschmerzen, Erschöpfung."

2. IMPLIZITE / ZEITLICHE KAUSALITÄT – häufigste Fehlerquelle!
   Muster: "[Produkt / Einnahme] + [Zeitkorrelation] + [Verbesserung eines Symptoms]"
   ✗ "Seitdem ich es nehme, ist meine Migräne verschwunden."
   ✗ "Ich nehme es seit 3 Jahren und fühle mich so viel energiegeladener."
   ✗ "Seit dem Optimalset habe ich keine Rückenschmerzen mehr."
   ✗ "Nach 2 Wochen hat sich meine Verdauung deutlich verbessert."
   ✗ "Seit ich es täglich trinke, schlafe ich endlich wieder durch."
   → "Seitdem ich X nehme/trinke/benutze + [Verbesserung eines Symptoms oder Befindens]" ist IMMER ein Verstoß.

3. VERSTECKTE WIRKUNGSVERSPRECHEN:
   ✗ "Das hat mir so geholfen." (wenn "das" = Produkt und "geholfen" bei etwas Gesundheitlichem)
   ✗ "Ich kann es nur weiterempfehlen, wenn man müde ist."
   ✗ "Wer Probleme mit X hat, sollte das mal probieren."
   ✗ "Das macht einen echten Unterschied bei [Symptom]."

4. UNZULÄSSIGE TESTIMONIALS:
   ✗ Vor/Nach-Vergleiche die Produktwirkung implizieren
   ✗ Gewichtsverlust direkt dem Produkt zugeschrieben
   → "Ich habe 12 kg abgenommen" = OK (keine Produktzuschreibung)
   → "Durch/Dank/Mit dem Produkt habe ich 12 kg abgenommen" = VERSTOSS

═══ WAS ERLAUBT IST ═══

1. PERSÖNLICHE VORGESCHICHTE ohne Produktverknüpfung:
   ✓ "Ich hatte damals oft Migräne und war auf der Suche nach etwas."
   ✓ "Ich war oft müde und wollte etwas ändern."

2. ROUTINE ohne Wirkungsbehauptung:
   ✓ "Seit 2019 ist es Teil meines Morgenrituals."
   ✓ "Ich nehme es täglich – es ist fester Bestandteil meines Alltags."

3. PERSÖNLICHE ERGEBNISSE ohne Produktattribution:
   ✓ "Ich habe in dieser Zeit 12 Kilo abgenommen." (ohne "dank/durch/weil")
   ✓ "Ich fühle mich heute fitter als früher." (ohne Zeitkorrelation mit Produkt)

4. ZUGELASSENE HEALTH CLAIMS (VO 432/2012):
   ✓ "Vitamin C trägt zur normalen Funktion des Immunsystems bei."
   ✓ "Magnesium trägt zu einer normalen Muskelfunktion bei."

═══ UMFORMULIERUNGS-STRATEGIE ═══

Brich die kausale Kette auf – trenne Produktnennung und Ergebnis:

Beispiel 1 – Zeitliche Kausalität:
   ✗ "Seitdem ich das Optimalset nehme, ist meine Migräne weg."
   ✓ "Ich hatte damals Migräne. Heute ist das Optimalset fester Teil meines Alltags."

Beispiel 2 – Implizite Wirkung:
   ✗ "Ich nehme es seit 3 Jahren und fühle mich so viel energiegeladener."
   ✓ "Seit 3 Jahren gehört es zu meiner täglichen Routine. Ich fühle mich heute fitter als früher."

Beispiel 3 – Gewichtsverlust mit Attribution:
   ✗ "Dank des Optimalsets habe ich 12 Kilo abgenommen."
   ✓ "In den letzten Jahren habe ich 12 Kilo abgenommen. Das Optimalset ist seitdem fester Bestandteil meines Alltags."

Behalte immer:
- Den persönlichen Schreibstil exakt (Wortwahl, Ton, "du"/"ich")
- Den emotionalen Bogen und alle persönlichen Details
- HTML-Tags (<p>, <strong>, <em>, <ul>, <li>, <br>)
- Niemals "KI-haft", generisch oder verkaufsorientiert klingen
- Keine Em-Dashes (—) oder En-Dashes (–)

═══ AUSGABE ═══

Antworte AUSSCHLIESSLICH mit reinem JSON ohne Code-Fences:
{
  "compliant": boolean,
  "issues": [{"quote": "exakter Wortlaut aus dem Text", "reason": "kurze Erklärung warum Verstoß"}],
  "suggested_html": "die umformulierte HTML-Version (nur bei compliant=false, sonst leerer String)"
}`

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY nicht konfiguriert' }, { status: 500 })
  }

  let html: string
  try {
    const body = await req.json()
    html = (body.html ?? '').toString().trim()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }

  if (!html || html.length < 10) {
    return NextResponse.json({ error: 'Text zu kurz' }, { status: 400 })
  }
  if (html.length > 8000) {
    return NextResponse.json({ error: 'Text zu lang (max. 8000 Zeichen)' }, { status: 400 })
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: `Prüfe diesen Text auf Heil- und Wirkungsaussagen:\n\n${html}` },
        ],
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('[check-compliance] OpenAI error:', resp.status, errText.slice(0, 500))
      return NextResponse.json({ error: 'KI-Prüfung fehlgeschlagen' }, { status: 502 })
    }

    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return NextResponse.json({ error: 'KI-Antwort leer' }, { status: 502 })

    let parsed: { compliant: boolean; issues?: Array<{ quote: string; reason: string }>; suggested_html?: string }
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('[check-compliance] JSON parse error:', content.slice(0, 200))
      return NextResponse.json({ error: 'KI-Antwort ungültiges Format' }, { status: 502 })
    }

    if (parsed.compliant) {
      return NextResponse.json<CheckResponse>({ ok: true, changed_input: false })
    }

    // Strip em-dashes from suggestion if model slipped one through
    const cleaned = (parsed.suggested_html ?? '').replace(/—/g, ', ').replace(/–/g, '-')

    return NextResponse.json<CheckResponse>({
      ok: false,
      issues: parsed.issues ?? [],
      suggested_html: cleaned,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[check-compliance] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
