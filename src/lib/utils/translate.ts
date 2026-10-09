import { sanitizeRichtext } from '@/lib/security/sanitize'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { siteData } from '@/lib/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'
import type { SiteLang } from '@/lib/utils/about-intro'

const OPENAI_MODEL = 'gpt-5.5-2026-04-23'

/**
 * Nutzertexte, die mehrsprachige Templates in anderen Sprachen zeigen. Je Sprache entsteht ein
 * abgeleiteter Wert `<key>_<lang>` (+ `<key>_<lang>_src` = Hash des deutschen Textes) in site_data —
 * nie im Schema. Fehlt die Übersetzung, zeigt das Template den deutschen Text.
 *   about_me_html → „Über mich“ (Richtext, HTML)        — Wellpreneur, Dailyoptimal
 *   about_intro   → eigene Begrüßung (Text, *Marker*)   — Dailyoptimal, Wellpreneur
 *   intro         → Vitalprofil „Dein kurzer Text“
 */
const TRANSLATED_FIELDS: Array<{ key: string; html: boolean; context: string }> = [
  { key: 'about_me_html', html: true, context: 'a personal "about me" section on a casual landing page' },
  { key: 'about_intro', html: false, context: 'a one-line personal greeting headline; words wrapped in *asterisks* are highlighted and the asterisks must be kept around the matching words' },
  { key: 'intro', html: false, context: 'a short personal intro text on a landing page' },
]

const LANG_NAMES: Record<SiteLang, string> = { de: 'German', en: 'English', it: 'Italian', ru: 'Russian', uk: 'Ukrainian', pl: 'Polish', bg: 'Bulgarian', hi: 'Hindi' }

/** Welche Sprachen ein Template zeigt (de ist immer die Quelle). */
export function templateLangs(templateDomain: string | null | undefined): SiteLang[] {
  if (templateDomain === 'dailyoptimal.de') return ['en', 'it', 'ru', 'uk', 'pl', 'bg', 'hi']
  return ['en']
}

function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

/** 429/5xx: bis zu drei Versuche mit Wartezeit (Rate-Limit bei vielen Seiten auf einmal). */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let resp = await fetch(url, init)
  for (let attempt = 1; attempt <= 3 && (resp.status === 429 || resp.status >= 500); attempt++) {
    const wait = parseFloat(resp.headers.get('retry-after') ?? '') * 1000 || 3000 * attempt
    await new Promise(r => setTimeout(r, wait))
    resp = await fetch(url, init)
  }
  return resp
}

/** Höchstens N gleichzeitige Aufgaben. */
async function runLimited(tasks: Array<() => Promise<void>>, limit: number): Promise<void> {
  let next = 0
  const worker = async () => { while (next < tasks.length) { const t = tasks[next++]; await t() } }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
}

async function translateText(german: string, lang: SiteLang, html: boolean, context: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  try {
    const resp = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              `You translate German ${html ? 'HTML snippets' : 'text'} into ${LANG_NAMES[lang]} for ${context}. ` +
              (html ? 'Keep the HTML structure and all tags/attributes exactly as they are, translate only the text content. ' : 'Keep line breaks. ') +
              'Translate idiomatically and colloquially, warm and personal, the way a native speaker would actually say it, not word for word. ' +
              'Keep the informal, friendly register. Keep names, product names (FitLine, PowerCocktail, Activize, Restorate, Optimalset) and numbers unchanged. ' +
              'Never use em-dashes. Reply with ONLY the translation, no explanations, no code fences.',
          },
          { role: 'user', content: german },
        ],
      }),
    })
    if (!resp.ok) {
      console.error('[translate] OpenAI API error:', resp.status, await resp.text())
      return null
    }
    const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content?.trim()
    return text || null
  } catch (err) {
    console.error('[translate] OpenAI API request failed:', err)
    return null
  }
}

/**
 * Stellt sicher, dass jedes übersetzte Feld in jeder Sprache aktuell ist. Je Feld/Sprache
 * kein Aufruf, wenn der Text leer ist oder die gespeicherte Übersetzung zum deutschen Text passt.
 * Alle Sprachen laufen parallel (Veröffentlichen wartet darauf).
 */
export async function ensureAboutMeTranslation(siteId: string, langs: SiteLang[] = ['en']): Promise<void> {
  const keys = TRANSLATED_FIELDS.flatMap(f => [f.key, ...langs.flatMap(l => [`${f.key}_${l}`, `${f.key}_${l}_src`])])
  const rows = await db
    .select({ fieldKey: siteData.fieldKey, fieldValue: siteData.fieldValue })
    .from(siteData)
    .where(and(eq(siteData.userSiteId, siteId), inArray(siteData.fieldKey, keys)))
  const map: Record<string, string> = {}
  for (const r of rows) map[r.fieldKey] = r.fieldValue ?? ''

  const jobs: Array<() => Promise<void>> = []
  for (const f of TRANSLATED_FIELDS) {
    const german = (map[f.key] ?? '').trim()
    if (!german) continue
    const srcHash = hashOf(german)
    for (const lang of langs) {
      const outKey = `${f.key}_${lang}`, srcKey = `${f.key}_${lang}_src`
      if (map[outKey] && map[srcKey] === srcHash) continue
      jobs.push(async () => {
        const translated = await translateText(german, lang, f.html, f.context)
        // Fallback auf Datenebene: deutscher Text, damit nie ein leerer Abschnitt erscheint.
        // Der Hash wird nur bei echter Übersetzung gesetzt — beim nächsten Mal wird es erneut versucht.
        const value = f.html ? sanitizeRichtext(translated ?? german) : (translated ?? german)
        await db.insert(siteData)
          .values([
            { userSiteId: siteId, fieldKey: outKey, fieldValue: value, updatedAt: new Date() },
            { userSiteId: siteId, fieldKey: srcKey, fieldValue: translated ? srcHash : '', updatedAt: new Date() },
          ])
          .onConflictDoUpdate({ target: [siteData.userSiteId, siteData.fieldKey], set: { fieldValue: sql`excluded.field_value`, updatedAt: new Date() } })
      })
    }
  }
  await runLimited(jobs, 4)
}
