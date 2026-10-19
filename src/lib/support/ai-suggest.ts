/**
 * KI-Antwortvorschlag für den Support-Chat (nur Admin).
 *
 * Kostenprinzip:
 *  - Alles Statische (Wissensbasis, Stilregeln, Beispiele) steht VORNE im Prompt und ist bei jedem Aufruf
 *    byte-gleich → OpenAI-Prompt-Cache greift automatisch (Präfix ≥ 1024 Tokens), gecachte Eingabe-Tokens
 *    kosten nur einen Bruchteil. `prompt_cache_key` sorgt dafür, dass alle Aufrufe auf demselben Cache landen.
 *  - Nur der Schluss ist dynamisch: Kundenkontext aus der DB, die letzten Nachrichten, Admin-Hinweise.
 *  - Kleines Modell mit niedrigem Reasoning, knappe Ausgabe (max. ~700 Tokens).
 *
 * Der Vorschlag wird NIE automatisch gesendet. Er landet im Eingabefeld des Admins.
 */

import { db } from '@/lib/db'
import { users, userSites, templates, supportMessages, appSettings, supportAiSuggestions } from '@/lib/db/schema'
import { eq, sql, desc } from 'drizzle-orm'
import { KNOWLEDGE_BASE, STYLE_GUIDE, EXAMPLES } from './ai-knowledge'
import { PLANS, type PlanKey } from '@/lib/plans'

export const SUPPORT_AI_NOTES_KEY = 'support_ai_notes'
const DEFAULT_MODEL = 'gpt-5.4-mini'
const MAX_MESSAGES = 30
const MAX_MESSAGE_CHARS = 1500
const MAX_TRANSCRIPT_CHARS = 9000
const MAX_COMPLETION_TOKENS = 900

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface SuggestionResult {
  id: string
  text: string
  model: string
  usage: { promptTokens: number; cachedTokens: number; completionTokens: number }
  /** Ungefähre Kosten dieses Aufrufs in US-Cent (Listenpreise, Stand 19.10.2026). */
  costCents: number
  durationMs: number
}

/** USD je 1 Mio. Tokens: [Eingabe, gecachte Eingabe, Ausgabe]. Unbekanntes Modell → wie gpt-5.4-mini. */
const PRICES_PER_M: Record<string, [number, number, number]> = {
  'gpt-5.4-mini': [0.75, 0.075, 4.5],
  'gpt-5.4-nano': [0.2, 0.02, 1.25],
  'gpt-5.4': [2.5, 0.25, 15],
  'gpt-5-mini': [0.25, 0.025, 2],
}

export function estimateCostCents(model: string, usage: SuggestionResult['usage']): number {
  const key = Object.keys(PRICES_PER_M).find(k => model.startsWith(k)) ?? 'gpt-5.4-mini'
  const [inP, cachedP, outP] = PRICES_PER_M[key]
  const uncached = Math.max(0, usage.promptTokens - usage.cachedTokens)
  const usd = (uncached * inP + usage.cachedTokens * cachedP + usage.completionTokens * outP) / 1_000_000
  return Math.round(usd * 100 * 1000) / 1000
}

export class SuggestError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message)
  }
}

// ─── Statischer Prompt-Teil (identisch bei jedem Aufruf → Cache) ──────────────

const SYSTEM_PROMPT = [
  'Du schreibst Antwortvorschläge für Daniel Kurzeja, den Inhaber von FinestSites, im Support-Chat mit seinen Kunden.',
  'Daniel liest jeden Vorschlag, passt ihn an und schickt ihn selbst ab. Schreibe deshalb exakt so, wie Daniel schreibt: in der Ich-Form als Daniel, auf Deutsch, per du.',
  'Nutze ausschließlich die Fakten aus der Wissensbasis, dem Kundenkontext und den aktuellen Hinweisen. Erfinde keine Funktionen, Preise, Fristen oder Zusagen.',
  'Weißt du etwas nicht sicher (Ursache eines Fehlers, Kontostand, ob etwas schon erledigt ist), schreibe wie Daniel („Ich schau mir das an und melde mich“) oder setze an genau dieser Stelle eine kurze eckige Klammer für Daniel, z. B. [PRÜFEN: Domain-Status im Admin]. Höchstens eine solche Klammer pro Antwort, nur wenn nötig.',
  'Antworte nur mit dem Nachrichtentext, der an den Kunden geht. Keine Einleitung, keine Erklärung, keine Anführungszeichen drumherum, keine Betreffzeile.',
  'Formatierung: nur Leerzeilen zwischen Absätzen, nummerierte Schritte („1.“), **fett** für Buttons/Menüpunkte/Wichtiges, *kursiv* selten. Keine Überschriften, keine Tabellen, keine Links in Markdown-Syntax (URLs einfach ausschreiben), keine Gedankenstriche.',
  '',
  KNOWLEDGE_BASE,
  '',
  STYLE_GUIDE,
].join('\n')

const EXAMPLE_MESSAGES: ChatMessage[] = EXAMPLES.flatMap(e => [
  { role: 'user' as const, content: `Kunde schreibt:\n${e.user}` },
  { role: 'assistant' as const, content: e.assistant },
])

/** Nur zur Kontrolle/Tests: Länge des statischen Teils (grob 4 Zeichen ≈ 1 Token). */
export function staticPromptChars(): number {
  return SYSTEM_PROMPT.length + EXAMPLE_MESSAGES.reduce((n, m) => n + m.content.length, 0)
}

// ─── Dynamischer Teil ─────────────────────────────────────────────────────────

interface TranscriptMessage {
  senderType: string
  contentType: string
  content: string
  createdAt: Date
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '–'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
}

function planLabel(plan: string | null, interval: string | null): string {
  const p = PLANS[(plan ?? '') as PlanKey]
  if (!p) return plan ?? 'kein Tarif'
  const price = interval === 'yearly' ? `${p.yearly_eur} €/Jahr` : `${p.monthly_eur} €/Monat`
  return `${p.name} (${interval === 'yearly' ? 'jährlich' : 'monatlich'}, ${price}, ${p.sites_label})`
}

const SITE_STATUS: Record<string, string> = {
  published: 'online',
  draft: 'Entwurf (nicht online)',
  deactivated: 'offline (Zahlung offen oder gekündigt)',
}

const DOMAIN_STATUS: Record<string, string> = {
  active: 'verbunden',
  pending: 'wartet auf DNS-Eintrag',
  pending_validation: 'wartet auf DNS-Eintrag',
  pending_ssl: 'SSL wird ausgestellt',
  error: 'Fehler',
}

async function buildCustomerContext(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true, email: true, username: true, firstName: true, lastName: true, plan: true, billingInterval: true,
      subscriptionStatus: true, cancelAtPeriodEnd: true, currentPeriodEnd: true, paymentFailedAt: true,
      paymentGraceUntil: true, deactivatedAt: true, createdAt: true, companyName: true, teamPartnerNumber: true,
      referredByUsername: true, affiliateOnboarded: true, affiliatePayoutMode: true, brandColor: true,
    },
  })
  if (!user) return 'Kunde: unbekannt (Konto gelöscht?)'

  const sites = await db
    .select({
      title: templates.title,
      domain: templates.domain,
      status: userSites.status,
      customDomain: userSites.customDomain,
      customDomainStatus: userSites.customDomainStatus,
      publishedAt: userSites.publishedAt,
      createdAt: userSites.createdAt,
    })
    .from(userSites)
    .leftJoin(templates, eq(userSites.templateId, templates.id))
    .where(eq(userSites.userId, userId))
    .orderBy(desc(userSites.publishedAt), desc(userSites.createdAt))

  const [refRow] = user.username
    ? await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.referredByUsername, user.username))
    : [{ n: 0 }]

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '(kein Name hinterlegt)'
  const lines: string[] = []
  lines.push(`Name: ${name} · Vorname für die Anrede: ${user.firstName ?? '(unbekannt, Anrede ohne Namen)'}`)
  lines.push(`Benutzername (= Partnercode, Teil der Webadresse): ${user.username ?? '(noch keiner)'} · E-Mail: ${user.email}`)
  lines.push(`Konto seit: ${fmtDate(user.createdAt)}${user.companyName ? ` · Firma: ${user.companyName}` : ''}${user.teamPartnerNumber ? ' · Teampartner-Nummer hinterlegt' : ' · KEINE Teampartner-Nummer hinterlegt'}`)

  const hasSub = !!user.subscriptionStatus && user.subscriptionStatus !== 'canceled'
  if (hasSub) {
    let abo = `Abo: ${planLabel(user.plan, user.billingInterval)} · Status ${user.subscriptionStatus}`
    if (user.currentPeriodEnd) abo += ` · nächste Abrechnung/Ende ${fmtDate(user.currentPeriodEnd)}`
    if (user.cancelAtPeriodEnd) abo += ' · GEKÜNDIGT zum Periodenende'
    lines.push(abo)
  } else {
    lines.push(`Abo: kein aktives Abo (Tarif-Feld: ${user.plan ?? '–'}) → noch nichts veröffentlicht oder gekündigt`)
  }
  if (user.paymentFailedAt) {
    lines.push(`ACHTUNG Zahlung fehlgeschlagen am ${fmtDate(user.paymentFailedAt)}${user.paymentGraceUntil ? `, Seiten online bis ${fmtDate(user.paymentGraceUntil)}` : ''}${user.deactivatedAt ? `, Seiten offline seit ${fmtDate(user.deactivatedAt)}` : ''}`)
  }

  if (sites.length === 0) {
    lines.push('Webseiten: noch keine angelegt')
  } else {
    lines.push('Webseiten:')
    for (const s of sites) {
      const host = user.username && s.domain ? `${user.username}.${s.domain}` : s.domain ?? ''
      let line = `- ${s.title ?? 'Vorlage'} (${host}): ${SITE_STATUS[s.status] ?? s.status}`
      if (s.publishedAt) line += `, veröffentlicht ${fmtDate(s.publishedAt)}`
      if (s.customDomain) line += ` · eigene Domain ${s.customDomain}: ${DOMAIN_STATUS[s.customDomainStatus ?? ''] ?? s.customDomainStatus ?? 'unbekannt'}`
      lines.push(line)
    }
  }

  const refs = refRow?.n ?? 0
  let partner = `Partnerprogramm: ${refs} geworbene Konten`
  if (user.referredByUsername) partner += ` · selbst geworben von ${user.referredByUsername}`
  if (refs > 0) partner += ` · Auszahlung: ${user.affiliatePayoutMode === 'payout' ? 'Überweisung' : 'Verrechnung mit dem Abo'}${user.affiliateOnboarded ? ', Bankkonto eingerichtet' : ', KEIN Bankkonto eingerichtet'}`
  lines.push(partner)

  return lines.join('\n')
}

function buildTranscript(messages: TranscriptMessage[]): string {
  const recent = messages.slice(-MAX_MESSAGES)
  const parts: string[] = []
  for (const m of recent) {
    const who = m.senderType === 'admin' ? 'DANIEL' : 'KUNDE'
    let text = m.content
    if (m.contentType === 'system') {
      let type = ''
      try { type = JSON.parse(m.content)?.type ?? '' } catch { /* ignore */ }
      text = type === 'impersonation_request' ? '[Systemnachricht: Zugriffsanfrage gesendet]' : '[Systemnachricht]'
    } else if (m.contentType === 'image') {
      text = `[Kunde hat ein Bild/Screenshot geschickt]${m.content ? ' ' + m.content : ''}`
    }
    if (text.length > MAX_MESSAGE_CHARS) text = text.slice(0, MAX_MESSAGE_CHARS) + ' […]'
    parts.push(`${who} (${fmtDateTime(m.createdAt)}):\n${text}`)
  }
  let out = parts.join('\n\n')
  if (out.length > MAX_TRANSCRIPT_CHARS) out = '[…ältere Nachrichten gekürzt…]\n' + out.slice(-MAX_TRANSCRIPT_CHARS)
  return out
}

export async function getSupportAiNotes(): Promise<string> {
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, SUPPORT_AI_NOTES_KEY) })
  return row?.value ?? ''
}

export async function setSupportAiNotes(value: string, adminId: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: SUPPORT_AI_NOTES_KEY, value, updatedBy: adminId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: adminId, updatedAt: new Date() } })
}

/** Baut den dynamischen User-Turn. Exportiert, damit Tests ihn ohne OpenAI prüfen können. */
export function buildRequestTurn(input: {
  customerContext: string
  transcript: string
  notes: string
  hint: string
  now: Date
}): string {
  const now = input.now
  const hour = Number(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Europe/Berlin' }))
  const daypart = hour < 11 ? 'Vormittag (Begrüßung „Guten Morgen“ passt)' : hour < 18 ? 'Tag' : 'Abend'
  const parts: string[] = []
  parts.push(`Jetzt: ${now.toLocaleString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })} Uhr (${daypart}).`)
  parts.push('')
  parts.push('## Kundenkontext (aus der Datenbank, nicht dem Kunden vorlesen, nur nutzen)')
  parts.push(input.customerContext)
  if (input.notes.trim()) {
    parts.push('')
    parts.push('## Aktuelle Hinweise von Daniel (gelten jetzt, haben Vorrang vor der Wissensbasis)')
    parts.push(input.notes.trim())
  }
  parts.push('')
  parts.push('## Bisheriger Chatverlauf (älteste zuerst; automatische Eingangsbestätigungen sind ebenfalls von DANIEL)')
  parts.push(input.transcript || '(noch keine Nachrichten)')
  parts.push('')
  if (input.hint.trim()) {
    parts.push('## Daniels Stichpunkte für diese Antwort (unbedingt umsetzen, in seinem Stil ausformulieren)')
    parts.push(input.hint.trim())
    parts.push('')
  }
  parts.push('Schreibe jetzt Daniels nächste Nachricht an den Kunden. Beantworte alles, was der Kunde seit Daniels letzter echter Antwort gefragt hat. Falls die letzte Nachricht vom Kunden nur ein Dank oder eine Bestätigung ist, antworte entsprechend kurz.')
  return parts.join('\n')
}

/** Vollständige Nachrichtenliste: statischer Präfix (System + Beispiele) + dynamischer Schluss. */
export function buildMessages(input: Parameters<typeof buildRequestTurn>[0]): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...EXAMPLE_MESSAGES,
    { role: 'user', content: buildRequestTurn(input) },
  ]
}

/** Transkript aus Nachrichten-Zeilen bauen (exportiert für Tests). */
export { buildTranscript }

// ─── OpenAI ───────────────────────────────────────────────────────────────────

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }
  error?: { message?: string }
}

export async function callOpenAI(messages: ChatMessage[], model = process.env.OPENAI_SUPPORT_MODEL || DEFAULT_MODEL): Promise<{ text: string; usage: SuggestionResult['usage']; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new SuggestError('OPENAI_API_KEY fehlt', 500)

  const body: Record<string, unknown> = {
    model,
    messages,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    prompt_cache_key: 'finestsites-support-v1',
  }
  // GPT-5-Familie: Reasoning klein halten (Support-Antwort braucht kein langes Nachdenken), knapp antworten.
  if (/^gpt-5/.test(model)) {
    body.reasoning_effort = 'low'
    body.verbosity = 'low'
  } else {
    body.temperature = 0.7
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  let resp: Response
  try {
    resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    throw new SuggestError(err instanceof Error && err.name === 'AbortError' ? 'OpenAI antwortet nicht (Zeitüberschreitung)' : 'OpenAI nicht erreichbar', 502)
  } finally {
    clearTimeout(timer)
  }

  const data = (await resp.json().catch(() => ({}))) as OpenAIResponse
  if (!resp.ok) {
    console.error('[support-ai] OpenAI error', resp.status, data?.error?.message)
    throw new SuggestError(`OpenAI-Fehler ${resp.status}: ${data?.error?.message ?? 'unbekannt'}`, 502)
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!text) throw new SuggestError('OpenAI hat keinen Text geliefert', 502)
  return {
    text: cleanOutput(text),
    model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      cachedTokens: data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  }
}

/** Entfernt, was das Modell trotz Anweisung manchmal anhängt (Code-Zäune, umschließende Anführungszeichen, Gedankenstriche). */
export function cleanOutput(text: string): string {
  let t = text.trim()
  t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('„') && t.endsWith('“'))) t = t.slice(1, -1).trim()
  t = t.replace(/\s*[—–]\s*/g, ', ').replace(/^, /gm, '')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t
}

// ─── Haupteinstieg ────────────────────────────────────────────────────────────

export async function generateSuggestion(input: { conversationId: string; userId: string; adminId: string; hint?: string }): Promise<SuggestionResult> {
  const started = Date.now()
  const hint = (input.hint ?? '').slice(0, 2000)

  const [customerContext, rows, notes] = await Promise.all([
    buildCustomerContext(input.userId),
    db
      .select({ senderType: supportMessages.senderType, contentType: supportMessages.contentType, content: supportMessages.content, createdAt: supportMessages.createdAt })
      .from(supportMessages)
      .where(eq(supportMessages.conversationId, input.conversationId))
      .orderBy(supportMessages.createdAt),
    getSupportAiNotes(),
  ])

  const messages = buildMessages({ customerContext, transcript: buildTranscript(rows), notes, hint, now: new Date() })

  const result = await callOpenAI(messages)
  const durationMs = Date.now() - started

  const [row] = await db
    .insert(supportAiSuggestions)
    .values({
      conversationId: input.conversationId,
      adminId: input.adminId,
      model: result.model,
      hint: hint || null,
      suggestion: result.text,
      promptTokens: result.usage.promptTokens,
      cachedTokens: result.usage.cachedTokens,
      completionTokens: result.usage.completionTokens,
      durationMs,
    })
    .returning({ id: supportAiSuggestions.id })

  return { id: row.id, text: result.text, model: result.model, usage: result.usage, costCents: estimateCostCents(result.model, result.usage), durationMs }
}

/** Nach dem Senden: gesendeten Text am Vorschlag speichern (Vergleich Vorschlag ↔ tatsächliche Antwort). */
export async function recordSuggestionSent(suggestionId: string, conversationId: string, sentContent: string): Promise<void> {
  await db
    .update(supportAiSuggestions)
    .set({ sentContent, sentAt: new Date() })
    .where(sql`${supportAiSuggestions.id} = ${suggestionId} and ${supportAiSuggestions.conversationId} = ${conversationId}`)
}
