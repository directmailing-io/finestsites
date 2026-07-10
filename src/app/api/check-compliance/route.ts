import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/server'

/**
 * Compliance check for user-generated text about food supplements.
 *
 * Validates against:
 *   - HCVO 1924/2006 (EU Health Claims Regulation)
 *   - 432/2012 (approved-claims list)
 *   - HWG (Heilmittelwerbegesetz)
 *
 * Returns either { ok: true } or { ok: false, issues, suggested_html }.
 */

type CheckResponse =
  | { ok: true; changed_input: boolean }
  | { ok: false; issues: Array<{ quote: string; reason: string }>; suggested_html: string }

const SYSTEM_PROMPT = `Du bist ein Compliance-Prüfer für Vertriebspartner von Nahrungsergänzungsmitteln (NEM) in Deutschland. Du prüfst Texte auf Verstöße gegen die EU-Health-Claims-Verordnung (HCVO 1924/2006 + VO 432/2012) und das Heilmittelwerbegesetz (HWG).

═══ DEINE AUFGABE ═══

Erkenne Heil- oder Wirkungsaussagen, auch wenn sie indirekt oder als persönliche Geschichte verpackt sind. Wenn etwas ein klarer Verstoß ist, markiere ihn. Wenn etwas nur grenzwertig oder ohne konkretes Symptom/Krankheitsbezug formuliert ist, ist es in der Regel OK.

WICHTIG: Du wirst manchmal gebeten, bereits umformulierte Texte zu prüfen. Prüfe diese genauso streng wie jeden anderen Text. Wenn deine Umformulierung compliant ist, gib compliant=true zurück.

═══ WAS VERBOTEN IST ═══

1. DIREKTE WIRKUNGSZUSCHREIBUNG an ein Produkt:
   ✗ "Das Optimalset hat meine Migräne geheilt."
   ✗ "Durch das Produkt habe ich endlich wieder Energie."
   ✗ "Hilft gegen Müdigkeit, Gelenkschmerzen, Erschöpfung."
   ✗ "Es hat mir so geholfen." (wenn Bezug = Produkt + konkretes Symptom/Problem)

2. IMPLIZITE ZEITLICHE KAUSALITÄT (Produkt + Zeitpunkt + Symptomverbesserung in einem Satz):
   Muster: "[Seit ich X nehme] + [Symptom verbessert/verschwunden]"
   ✗ "Seitdem ich es nehme, ist meine Migräne verschwunden."
   ✗ "Seit dem Optimalset habe ich keine Rückenschmerzen mehr."
   ✗ "Seit ich es täglich trinke, schlafe ich endlich wieder durch."
   ✗ "Nach 2 Wochen hat sich meine Verdauung deutlich verbessert."
   → Die Kombination Produkt + Zeitkorrelation + konkrete Symptomverbesserung ist ein Verstoß.

3. EMPFEHLUNG BEI BESCHWERDE/SYMPTOM:
   ✗ "Ich kann es nur weiterempfehlen, wenn man müde ist."
   ✗ "Wer Probleme mit X hat, sollte das mal probieren."

4. GEWICHTSVERLUST MIT PRODUKTATTRIBUTION:
   ✗ "Durch/Dank/Mit dem Produkt habe ich 12 kg abgenommen."
   ✓ "Ich habe 12 kg abgenommen." (ohne Produktattribution – OK)

═══ WAS ERLAUBT IST ═══

1. PERSÖNLICHE VORGESCHICHTE ohne Produktverknüpfung:
   ✓ "Ich hatte damals oft Migräne und war auf der Suche nach etwas."
   ✓ "Ich war oft müde und wollte etwas ändern."

2. ROUTINE ohne Wirkungsbehauptung:
   ✓ "Seit 2019 ist es Teil meines Morgenrituals."
   ✓ "Ich nehme es täglich – es ist fester Bestandteil meines Alltags."
   ✓ "Seit 3 Jahren gehört es zu meiner täglichen Routine."

3. ALLGEMEINES WOHLBEFINDEN ohne direkten Produktbezug:
   ✓ "Ich fühle mich heute fitter als früher." (OK wenn kein Satz zuvor das Produkt als Ursache nennt)
   ✓ "Ich bin aktiver und ausgeglichener als noch vor ein paar Jahren."

4. PERSÖNLICHE ERGEBNISSE ohne Produktattribution:
   ✓ "Ich habe in dieser Zeit 12 Kilo abgenommen." (kein dank/durch/weil)

5. ZUGELASSENE HEALTH CLAIMS (VO 432/2012):
   ✓ "Vitamin C trägt zur normalen Funktion des Immunsystems bei."

TRENNREGEL: Wenn Produktnennung und Wohlbefindensbeschreibung in getrennten Sätzen ohne kausales Wort stehen, ist es in der Regel compliant. Kausalwörter: seitdem, dadurch, dank, durch, weil, deshalb, deswegen, damit, nach X Wochen/Tagen.

═══ UMFORMULIERUNGS-STRATEGIE ═══

Brich die kausale Kette auf: Produktnennung und Ergebnisbeschreibung in getrennten Sätzen, ohne Kausalwörter.

Beispiel 1:
   ✗ "Seitdem ich das Optimalset nehme, ist meine Migräne weg."
   ✓ "Ich hatte damals Migräne. Heute ist das Optimalset fester Teil meines Alltags."

Beispiel 2:
   ✗ "Ich nehme es seit 3 Jahren und fühle mich so viel energiegeladener."
   ✓ "Seit 3 Jahren gehört es zu meiner täglichen Routine. Ich fühle mich heute fitter als früher."

Beispiel 3:
   ✗ "Dank des Optimalsets habe ich 12 Kilo abgenommen."
   ✓ "In den letzten Jahren habe ich 12 Kilo abgenommen. Das Optimalset ist seitdem fester Bestandteil meines Alltags."

SELBSTTEST: Bevor du suggested_html ausgibst, prüfe: Enthält der Text noch ein Kausalwort zwischen Produkt und Symptomverbesserung? Falls ja, überarbeite nochmals. Das Ziel ist ein Text, der bei erneuter Prüfung compliant=true ergibt.

═══ SCHREIBREGELN FÜR DIE UMFORMULIERUNG ═══

ABSOLUT VERBOTEN in der Umformulierung:
- Keine Em-Dashes (—) und keine En-Dashes (–). Komma oder neuer Satz stattdessen.
- Keine Füllwörter: "innovativ", "ganzheitlich", "nachhaltig", "revolutionär", "transformativ".
- Keine KI-Floskeln: "Ich freue mich zu teilen", "Es ist mir eine Freude".
- Keine Werbetextersprache: "unverzichtbar", "einzigartig", "bahnbrechend".
- Keine rhetorischen Fragen als Einstieg.

PFLICHT:
1. EINFACHE SPRACHE: Kurze Sätze (max. 15 Wörter). Umgangssprache, nicht Werbetext.
2. RHYTHMUS: Wechsel zwischen kurzen und längeren Sätzen.
3. PERSÖNLICHE STIMME: Behalte Wortwahl, Tonfall und Satzstruktur des Users exakt. Alle persönlichen Details bleiben erhalten.
4. HTML: Behalte alle vorhandenen Tags (<p>, <strong>, <em>, <ul>, <li>). Keine neuen hinzufügen.

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

    // Hard-strip em/en-dashes as a safety net even if model ignored the rule
    const cleaned = (parsed.suggested_html ?? '')
      .replace(/—/g, ', ')
      .replace(/–/g, '-')

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
