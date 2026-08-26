import { NextRequest, NextResponse } from 'next/server'
import { checkCompliance } from '@/lib/compliance/check'
import { createRateLimiter, getClientIp, getAuthorizedDraft } from '@/lib/testimonials/server'
import { guidedQuestionsFor, TestimonialCategoryKey } from '@/lib/constants/testimonial-content'

// Kontext-Re-Checks (Antwort ändert sich → Nachbar-Antworten neu bewerten)
// brauchen mehr Spielraum als ein Check pro Eingabe
const rateLimit = createRateLimiter(120, 60 * 60_000)

// Erfahrungsberichte landen später in Werbematerial für Lebensmittel. Dort gilt
// HCVO Art. 12(b) strenger als im Editor: Abnehm-Zahlen sind IMMER tabu.
const WEIGHT_RULE = `- Konkrete Abnehm-Zahlen und Abnehm-Zeiträume ("8 Kilo", "in 3 Wochen abgenommen") sind IMMER ein Verstoß, auch OHNE Produktattribution (HCVO Art. 12(b)). Diese Zusatzregel geht der Regel "Persönliche Ergebnisse ohne Produktattribution" vor. In der Umformulierung solche Angaben durch allgemeine Formulierungen ohne Zahlen und Zeiträume ersetzen, z. B. "Ich habe abgenommen und fühle mich richtig wohl in meinem Körper."`

// Der Bericht entsteht aus drei geführten Antworten. Kausalität muss über den
// Gesamtbericht beurteilt werden ("seitdem" in Antwort 3 meint das Produkt aus
// Antwort 2) und Vorschläge müssen zur jeweiligen Frage passen, ohne Inhalte
// anderer Antworten zu doppeln.
function buildWizardRules(
  questions: { label: string }[],
  answers: string[],
  questionIndex: number,
): string {
  const overview = questions
    .map((q, i) => {
      const marker = i === questionIndex ? ' ← DIESE ANTWORT PRÜFST DU' : ''
      const a = answers[i] ? `Antwort: ${answers[i]}` : 'Antwort: (noch leer)'
      return `Frage ${i + 1}: ${q.label}${marker}\n${a}`
    })
    .join('\n\n')

  return `═══ ZUSATZREGELN FÜR DIESEN KONTEXT (haben Vorrang) ═══

Dieser Text ist Teil eines Erfahrungsberichts, der in Werbematerialien für Lebensmittel erscheint. Der Bericht entsteht aus drei Antworten auf geführte Fragen:

${overview}

Du prüfst AUSSCHLIESSLICH die Antwort auf Frage ${questionIndex + 1}. Dabei gilt:
- Beurteile Kausalität über den GESAMTEN Bericht: Bezieht sich ein Wort wie "seitdem", "dadurch" oder "damit" in der geprüften Antwort auf ein Produkt oder eine Kur aus einer anderen Antwort, ist das derselbe Verstoß, als stünde beides im selben Satz.
- suggested_html ersetzt NUR die Antwort auf Frage ${questionIndex + 1} und muss inhaltlich genau zu dieser Frage passen (Frage 1 = Situation vorher, Frage 2 = Weg und Begeisterung, Frage 3 = Ergebnis heute und Empfehlung).
- Wiederhole im Vorschlag KEINE Inhalte, die schon in einer anderen Antwort stehen. Beispiel: Steht die Vorher-Situation bereits in Antwort 1, erzählt der Vorschlag für Antwort 3 sie NICHT erneut. Der Vorschlag für Antwort 3 beschreibt dann nur das heutige Befinden und die Empfehlung, ohne Kausalwort und ohne Krankheits- oder Symptombezug.
- Die Kernbotschaft-Regel gilt über den Gesamtbericht: Ein Thema, das in einer anderen Antwort erhalten bleibt, muss im Vorschlag nicht wiederholt werden.
${WEIGHT_RULE}`
}

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

  const rawAnswers = Array.isArray(body.answers) ? body.answers : []
  const answers = [0, 1, 2].map(i => String(rawAnswers[i] ?? '').trim().slice(0, 2500))
  const questionIndex = Number(body.questionIndex)
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 2) {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const text = answers[questionIndex]
  const approvedText = String(body.approvedText ?? '').trim().slice(0, 4000)
  if (text.length < 10 || text.length > 2500) {
    return NextResponse.json({ error: 'Textlänge ungültig.' }, { status: 400 })
  }

  const questions = guidedQuestionsFor(draft.category as TestimonialCategoryKey)
  const extraRules = buildWizardRules(questions, answers, questionIndex)

  try {
    const result = await checkCompliance(text, approvedText, apiKey, extraRules)
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
