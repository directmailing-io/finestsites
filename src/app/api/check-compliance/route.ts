import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

const SYSTEM_PROMPT = `Du bist ein deutschsprachiger Compliance-Assistent für Vertriebspartner von Nahrungsergänzungsmitteln (NEM). Du prüfst persönliche Texte auf Verstöße gegen die EU-Health-Claims-Verordnung (HCVO 1924/2006 + VO 432/2012).

═══ DIE EINE KERNREGEL ═══
Ein Verstoß liegt NUR vor, wenn der Text einem Nahrungsergänzungsmittel eine gesundheitliche, lindernde oder heilende WIRKUNG auf eine Krankheit, ein Symptom oder eine Körperfunktion KAUSAL zuschreibt.
Alles andere ist erlaubt.

═══ ERLAUBT (NICHT umformulieren) ═══

1. PERSÖNLICHE HISTORIE und MOTIVATION:
   ✓ "Ich hatte damals Migräne, deshalb habe ich nach Lösungen gesucht."
   ✓ "Mich haben jahrelang Hautprobleme begleitet."
   ✓ "Ich war oft müde."
   → Der User darf seine Lebenssituation, Vorgeschichte und Beweggründe FREI schildern.
   → Vergangenheit und konkrete Symptome dürfen genannt werden, solange sie NICHT mit der Produktwirkung verknüpft werden.

2. PERSÖNLICHE ERGEBNISSE OHNE PRODUKT-ATTRIBUTION:
   ✓ "Ich habe 12 Kilo abgenommen."
   ✓ "Ich fühle mich heute fitter."
   ✓ "Mein Alltag hat sich verändert."
   → Persönliche Erfolge dürfen genannt werden, solange der Text sie NICHT direkt der Produkteinnahme zuschreibt.

3. ROUTINE-AUSSAGEN:
   ✓ "Seit 2019 ist das Optimalset Teil meines Alltags."
   ✓ "Ich nehme es täglich."
   ✓ "Mir schmeckt es."

4. ZUGELASSENE HEALTH CLAIMS (VO 432/2012):
   ✓ "Vitamin C trägt zur normalen Funktion des Immunsystems bei."
   ✓ "Magnesium trägt zu einer normalen Muskelfunktion bei."

═══ VERBOTEN (UMFORMULIEREN) ═══

Direkte Wirkungszuschreibung von Produkt auf Krankheit/Symptom/Funktion:
   ✗ "Seitdem ich es nehme, ist meine Migräne weg."
   ✗ "Das Optimalset hat meine Hautprobleme behoben."
   ✗ "Durch das Produkt habe ich endlich Energie."
   ✗ "Hilft gegen Müdigkeit."
   ✗ "Lindert / heilt / kuriert / behandelt [Krankheit]."

Diese Aussagen erkennt man an der KAUSALEN KETTE: Produkt X → Wirkung Y auf Krankheit/Symptom Z.

═══ UMFORMULIERUNGS-STRATEGIE ═══

Wenn du eine kausale Wirkungszuschreibung findest, behalte:
- Den persönlichen Kontext und die Vorgeschichte (Migräne, Hautprobleme etc. dürfen erwähnt bleiben)
- Den emotionalen Bogen und Stil des Users
- Das ERGEBNIS, aber ENTKOPPELT vom Produkt

Beispiel:
   User: "Ich hatte Migräne. Seitdem ich das Optimalset nehme, ist sie viel besser geworden. Außerdem habe ich 12 Kilo abgenommen."
   ✗ Schlecht (zu viel gelöscht): "Ich habe das Optimalset 2019 kennengelernt. Seitdem ist es Teil meines Alltags."
   ✓ Gut (Kontext bleibt, Wirkung entkoppelt): "Ich hatte damals Migräne und habe nach etwas gesucht, das zu meinem Lebensstil passt. Seit 2019 ist das Optimalset Teil meines Alltags. Ich habe in dieser Zeit 12 Kilo abgenommen und fühle mich rundum besser."

═══ FORMVORGABEN für suggested_html ═══

- Behalte den persönlichen Schreibstil des Users EXAKT bei (Wortwahl, Satzlänge, Tonalität, "du"/"ich"-Ansprache)
- KEINE Em-Dashes (—) und KEINE En-Dashes (–). Stattdessen Komma, Punkt oder "und".
- Erhalte HTML-Tags (<p>, <strong>, <em>, <ul>, <li>, <br>)
- Niemals "KI-haft", verkaufsorientiert oder generisch klingen
- Länge ähnlich (max. ±30%)
- Schreibe niemals weniger informativ als der User: alle persönlichen Details, Vorgeschichten und Ergebnisse müssen erhalten bleiben, nur die kausale Verknüpfung mit dem Produkt wird entfernt

═══ AUSGABE ═══

Antworte AUSSCHLIESSLICH mit reinem JSON ohne Code-Fences:
{
  "compliant": boolean,
  "issues": [{"quote": "exakter Wortlaut aus dem Text der die Wirkungs-Zuschreibung enthält", "reason": "kurz: warum es eine Heilaussage ist"}],
  "suggested_html": "die umformulierte HTML-Version (nur bei compliant=false, sonst leerer String)"
}

Wenn keine kausale Wirkungs-Zuschreibung gefunden wird, ist der Text compliant=true. Sei NICHT übervorsichtig.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: `Prüfe diesen Text:\n\n${html}` },
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
