/**
 * Compliance check for user-generated text about food supplements.
 *
 * Validates against:
 *   - HCVO 1924/2006 (EU Health Claims Regulation)
 *   - 432/2012 (approved-claims list)
 *   - HWG (Heilmittelwerbegesetz)
 *
 * Bestandsschutz is enforced DETERMINISTICALLY here, not via the prompt:
 * the model has been observed re-flagging verbatim sentences from the
 * previously approved version despite explicit instructions not to.
 * Any issue whose quote appears (near-)verbatim in the approved text is
 * dropped in code, so an accepted suggestion can never be re-criticized.
 */

export type CheckResult =
  | { ok: true }
  | { ok: false; issues: Array<{ quote: string; reason: string }>; suggested_html: string }

export const SYSTEM_PROMPT = `Du bist ein Compliance-Prüfer für Vertriebspartner von Nahrungsergänzungsmitteln (NEM) in Deutschland. Du prüfst Texte auf Verstöße gegen die EU-Health-Claims-Verordnung (HCVO 1924/2006 + VO 432/2012) und das Heilmittelwerbegesetz (HWG).

═══ GRUNDPRINZIPIEN (WICHTIGSTE REGELN) ═══

0. KEINE KRANKHEITEN UND SYMPTOME (HÄRTESTE REGEL): Sobald ein Text ein Produkt (Nahrungsergänzung, Kur, Set) erwähnt, darf er KEINE Krankheit, kein Symptom und keine gesundheitliche Beschwerde nennen – auch nicht als persönliche Vorgeschichte, auch nicht in Vergangenheitsform, auch nicht ohne Kausalwort. Beispiele für verbotene Nennungen: Migräne, Kopfschmerzen, unreine Haut, Hautprobleme, Schlafprobleme, Schlafstörungen, Verdauungsprobleme, Gelenkschmerzen, Rückenschmerzen, Allergien, Erkältungen, geschwächtes Immunsystem, Erschöpfung, Burnout, Depression, Diabetes, Blutdruck, Entzündungen, Medikamente, Diagnosen, Therapien, "Beschwerden". Begründung: Der Hersteller (PM-International) und Prüfstellen lesen die gesamte Erzählung als Zusammenhang „Beschwerde → Produkt → Besserung“, selbst wenn die Sätze getrennt sind. Ersetze solche Stellen durch eine neutrale Motivation ohne Gesundheitsbezug, z. B. "Ich war auf der Suche nach einer einfachen Routine für meinen Alltag." oder "Ich wollte etwas für mich tun."

1. IM ZWEIFEL COMPLIANT: Abgesehen von Regel 0 markiere nur KLARE Verstöße. Grenzwertige, vage oder allgemeine Formulierungen ohne konkreten Krankheits-/Symptombezug sind OK. Du bist ein Helfer, kein Zensor. Ein Text, den du übervorsichtig zerlegst, ist ein schlechteres Ergebnis als ein Text mit einer grenzwertigen, aber vertretbaren Formulierung.

2. KERNBOTSCHAFT ERHALTEN: Beim Umformulieren darf KEINE persönliche Erfahrung des Users gestrichen werden (Ausnahme: Krankheits-/Symptomnennungen nach Regel 0 werden durch neutrale Motivation ersetzt). Du entschärfst nur die verbotene Kausalität — die Geschichte bleibt vollständig erhalten. Wenn der User über seine Verdauung, seinen Schlaf oder seine Energie schreibt, muss das Thema auch im Vorschlag vorkommen. Streichen ist verboten, umformulieren ist deine Aufgabe.

3. MINIMAL-EDIT: Ändere in suggested_html AUSSCHLIESSLICH die Sätze, die du in issues beanstandet hast. Jeder nicht beanstandete Satz wird ZEICHENGENAU aus dem Original übernommen — kein Umschreiben aus Stilgründen, kein "Verbessern" unbeanstandeter Sätze, keine neue Struktur.

4. BESTANDSSCHUTZ: Wenn dir eine "bereits freigegebene Fassung" mitgegeben wird, gelten alle Sätze, die wortgleich oder nahezu wortgleich darin vorkommen, als geprüft und compliant. Melde sie NICHT erneut — auch dann nicht, wenn du sie heute strenger beurteilen würdest. Prüfe nur die Sätze, die sich gegenüber der freigegebenen Fassung geändert haben.

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

1. PERSÖNLICHE VORGESCHICHTE ohne Gesundheitsbezug:
   ✓ "Ich war auf der Suche nach einer einfachen Routine für meinen Alltag."
   ✓ "Ich wollte etwas für mich tun und habe es einfach ausprobiert."
   ✗ NICHT erlaubt (Regel 0): "Ich hatte damals oft Migräne und war auf der Suche nach etwas."

2. ROUTINE ohne Wirkungsbehauptung:
   ✓ "Seit 2019 ist es Teil meines Morgenrituals."
   ✓ "Ich nehme es täglich – es ist fester Bestandteil meines Alltags."
   ✓ "Seit 3 Jahren gehört es zu meiner täglichen Routine."

3. ALLGEMEINES WOHLBEFINDEN ohne direkten Produktbezug:
   ✓ "Ich fühle mich heute fitter als früher." (OK wenn kein Satz zuvor das Produkt als Ursache nennt)
   ✓ "Ich bin aktiver und ausgeglichener als noch vor ein paar Jahren."

4. PERSÖNLICHE ERGEBNISSE ohne Produktattribution:
   ✓ "Ich habe in dieser Zeit 12 Kilo abgenommen." (kein dank/durch/weil)
   ✓ "Heute geht es mir gut." / "Meine Haut fühlt sich besser an." (eigener Satz, keine Produktnennung, kein Kausalwort)

5. ZUGELASSENE HEALTH CLAIMS (VO 432/2012):
   ✓ "Vitamin C trägt zur normalen Funktion des Immunsystems bei."

TRENNREGEL: Wenn Produktnennung und Wohlbefindensbeschreibung in getrennten Sätzen ohne kausales Wort stehen, ist es in der Regel compliant. Kausalwörter: seitdem, dadurch, dank, durch, weil, deshalb, deswegen, damit, nach X Wochen/Tagen. Ein bloßes Nacheinander von Sätzen ist KEINE Kausalität — erst ein Kausalwort oder eine Zeitangabe, die Produkt und Symptom im selben Satz verknüpft, macht den Verstoß.

═══ UMFORMULIERUNGS-STRATEGIE ═══

Brich die kausale Kette auf: Produktnennung und Ergebnisbeschreibung in getrennten Sätzen, ohne Kausalwörter.

Beispiel 1:
   ✗ "Seitdem ich das Optimalset nehme, ist meine Migräne weg."
   ✓ "Ich war auf der Suche nach einer Routine, die ich durchhalte. Heute ist das Optimalset fester Teil meines Alltags."

Beispiel 2:
   ✗ "Ich nehme es seit 3 Jahren und fühle mich so viel energiegeladener."
   ✓ "Seit 3 Jahren gehört es zu meiner täglichen Routine. Ich fühle mich heute fitter als früher."

Beispiel 3:
   ✗ "Dank des Optimalsets habe ich 12 Kilo abgenommen."
   ✓ "In den letzten Jahren habe ich 12 Kilo abgenommen. Das Optimalset ist seitdem fester Bestandteil meines Alltags."

Beispiel 4 (Erfahrung bleibt vollständig erhalten — so sieht Kernbotschaft-Erhalt aus):
   ✗ "Das Optimalset hat mich bei der Verdauung unterstützt."
   ✓ "Ich wollte meinem Alltag mehr Struktur geben. Heute fühle ich mich insgesamt wohler. Das Optimalset gehört fest zu meiner täglichen Routine."
   → Das Gesundheitsthema (Verdauung) wird durch eine neutrale Motivation ersetzt. Die persönliche Geschichte (skeptisch, ausprobiert, Routine, Wohlbefinden) bleibt erhalten.

SELBSTTEST: Bevor du suggested_html ausgibst, prüfe drei Dinge:
1. Enthält der Text noch ein Kausalwort zwischen Produkt und Symptomverbesserung? Falls ja, überarbeite nochmals.
2. Kommt jedes Thema und jede persönliche Erfahrung des Originals noch vor? Falls nein, überarbeite nochmals.
3. Sind alle nicht beanstandeten Sätze zeichengenau erhalten? Falls nein, stelle sie wieder her.
Das Ziel ist ein Text, der bei erneuter Prüfung compliant=true ergibt.

═══ SCHREIBREGELN FÜR DIE UMFORMULIERUNG ═══

Diese Regeln gelten NUR für die Sätze, die du neu formulierst — alle anderen Sätze bleiben unangetastet.

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

// ── Deterministische Sperrliste (Krankheiten/Symptome) ───────────────────────
// Greift unabhängig vom Modell und VOR dem Bestandsschutz: Texte mit diesen Begriffen
// gelten nie als freigegeben (Anlass: Hinweis von PM-International am 08.10.2026,
// „Migräne“ in einem Über-mich-Text hatte die KI durchgewinkt).
const BLOCKED_TERMS: Array<{ re: RegExp; label: string }> = [
  { re: /migr[äa]ne/i, label: 'Migräne' },
  { re: /kopfschmerz|kopfweh/i, label: 'Kopfschmerzen' },
  { re: /unreine haut|hautproblem|hautunreinheit|akne|neurodermitis|ekzem/i, label: 'Hautprobleme' },
  { re: /schlafproblem|schlafst[öo]rung|einschlafproblem|durchschlafproblem/i, label: 'Schlafprobleme' },
  { re: /verdauungsproblem|verdauungsbeschwerd|bl[äa]hung|verstopfung|durchfall|reizdarm/i, label: 'Verdauungsbeschwerden' },
  { re: /gelenkschmerz|r[üu]ckenschmerz|muskelschmerz|schmerz/i, label: 'Schmerzen' },
  { re: /allergi/i, label: 'Allergie' },
  { re: /erk[äa]ltung|grippe|infekt/i, label: 'Erkältung/Infekt' },
  { re: /immunsystem (st[äa]rk|schw[äa]ch)|geschw[äa]chtes immunsystem|immunschw[äa]che/i, label: 'Immunsystem' },
  { re: /ersch[öo]pfung|burnout|burn-out|chronisch m[üu]de|dauerm[üu]de/i, label: 'Erschöpfung' },
  { re: /depress|angstst[öo]rung|panikattack/i, label: 'Depression/Angst' },
  { re: /diabet|blutzucker|blutdruck|cholesterin|schilddr[üu]se|hashimoto/i, label: 'Stoffwechsel-/Kreislauferkrankung' },
  { re: /entz[üu]ndung|arthrose|arthritis|rheuma|osteoporose/i, label: 'Entzündliche/degenerative Erkrankung' },
  { re: /krebs|tumor|chemo/i, label: 'Krebs' },
  { re: /\bmedikament|\btablette|\btherapie|\bdiagnose|(?<![a-zäöü])(haus|fach)?(arzt|ärzt|aerzt)|\bklinik\b|\boperation\b/i, label: 'Medizinischer Kontext' },
  { re: /\bbeschwerden|\bsymptom|\bkrankheit|\bkrank\b|\bheilt\b|\bgeheilt|\bheilung|\blindert|\blinderung/i, label: 'Beschwerden/Heilung' },
  { re: /abgenommen|kilo\b|kg\b|gewicht verloren/i, label: 'Gewichtsangabe (nur ohne Produktbezug erlaubt – wird geprüft)' },
]
/** Liefert gefundene Sperrbegriffe mit dem Satz, in dem sie stehen. Gewichtsangaben nur melden, wenn ein Produkt im Text steht. */
export function findBlockedTerms(html: string): Array<{ quote: string; reason: string }> {
  const text = normalizeForMatch(html)
  const sentences = text.split(/(?<=[.!?…])\s+/)
  const mentionsProduct = /optimal|set|restorate|activize|powercocktail|cocktail|basics|fitline|produkt|kur|reset|shake|kapsel|pulver|drink/i.test(text)
  const out: Array<{ quote: string; reason: string }> = []
  for (const t of BLOCKED_TERMS) {
    if (t.label.startsWith('Gewichtsangabe') && !mentionsProduct) continue
    for (const sentence of sentences) {
      if (t.re.test(sentence)) { out.push({ quote: sentence.trim().slice(0, 240), reason: `${t.label}: Krankheits-, Symptom- oder Wirkungsbezug ist in Produkt-Texten nicht erlaubt (Health-Claims-Verordnung, Vorgaben des Herstellers).` }); break }
    }
  }
  return out
}

// ── Deterministic Bestandsschutz ──────────────────────────────────────────────

function normalizeForMatch(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    // Quote characters vary between model output and stored HTML — drop them all
    .replace(/["'„“”«»‚‘’]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

function toWords(s: string): string[] {
  return normalizeForMatch(s)
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
}

/** Dice coefficient over word multisets — tolerant of a single swapped word (e.g. 2019 → 2018). */
function wordSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const counts = new Map<string, number>()
  for (const w of a) counts.set(w, (counts.get(w) ?? 0) + 1)
  let overlap = 0
  for (const w of b) {
    const c = counts.get(w) ?? 0
    if (c > 0) {
      overlap++
      counts.set(w, c - 1)
    }
  }
  return (2 * overlap) / (a.length + b.length)
}

function splitSentences(html: string): string[] {
  return normalizeForMatch(html)
    .split(/(?<=[.!?…])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

const SIMILARITY_THRESHOLD = 0.88

/** True if the flagged quote is (near-)verbatim part of the approved text. */
export function isGrandfathered(quote: string, approvedHtml: string): boolean {
  const approvedNorm = normalizeForMatch(approvedHtml)
  if (!approvedNorm) return false
  const qNorm = normalizeForMatch(quote)
  if (qNorm.length >= 8 && approvedNorm.includes(qNorm)) return true
  const qWords = toWords(quote)
  if (qWords.length < 3) return false
  return splitSentences(approvedHtml).some(
    s => wordSimilarity(qWords, toWords(s)) >= SIMILARITY_THRESHOLD
  )
}

// ── Main check ────────────────────────────────────────────────────────────────

export async function checkCompliance(
  html: string,
  approvedHtml: string,
  apiKey: string,
  extraRules?: string
): Promise<CheckResult> {
  const blocked = findBlockedTerms(html)
  const blockRules = blocked.length
    ? `\n\nZUSÄTZLICH (deterministisch gefunden, MUSS beanstandet und umformuliert werden – compliant darf NICHT true sein): ${blocked.map(b => `„${b.quote}“`).join(' | ')}`
    : ''
  const userContent =
    approvedHtml && approvedHtml !== html
      ? `Bereits freigegebene Fassung (Bestandsschutz — wortgleiche Sätze nicht erneut melden):\n\n${approvedHtml}\n\nPrüfe diesen Text auf Heil- und Wirkungsaussagen:\n\n${html}`
      : `Prüfe diesen Text auf Heil- und Wirkungsaussagen:\n\n${html}`

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}${extraRules ? `\n\n${extraRules}` : ''}${blockRules}` },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`OpenAI ${resp.status}: ${errText.slice(0, 300)}`)
  }

  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('KI-Antwort leer')

  let parsed: {
    compliant: boolean
    issues?: Array<{ quote: string; reason: string }>
    suggested_html?: string
  }
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('KI-Antwort ungültiges Format')
  }

  if (parsed.compliant && blocked.length === 0) return { ok: true }

  const rawIssues = (parsed.issues ?? []).filter(i => i && typeof i.quote === 'string')
  // Sperrbegriffe immer als Issue führen, auch wenn das Modell sie nicht genannt hat
  for (const b of blocked) if (!rawIssues.some(i => normalizeForMatch(i.quote).includes(normalizeForMatch(b.quote).slice(0, 40)))) rawIssues.push(b)

  // Deterministic Bestandsschutz: never re-flag sentences the user already
  // has in an approved version, regardless of what the model claims.
  // Sperrbegriffe sind vom Bestandsschutz ausgenommen (eine frühere Freigabe mit „Migräne“ gilt nicht mehr)
  const isBlockedIssue = (i: { quote: string }) => blocked.some(b => normalizeForMatch(i.quote).includes(normalizeForMatch(b.quote).slice(0, 40)) || normalizeForMatch(b.quote).includes(normalizeForMatch(i.quote).slice(0, 40)))
  const issues = approvedHtml
    ? rawIssues.filter(i => isBlockedIssue(i) || !isGrandfathered(i.quote, approvedHtml))
    : rawIssues

  if (issues.length === 0) {
    if (rawIssues.length > 0) {
      console.log(`[check-compliance] Bestandsschutz: ${rawIssues.length} Issue(s) gefiltert → compliant`)
    }
    return { ok: true }
  }

  // Hard-strip em/en-dashes as a safety net even if model ignored the rule
  const cleaned = (parsed.suggested_html ?? (parsed.compliant ? '' : ''))
    .replace(/—/g, ', ')
    .replace(/–/g, '-')

  return { ok: false, issues, suggested_html: cleaned }
}
