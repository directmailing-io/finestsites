/**
 * Auto-translation of the user-entered "Über mich" text (about_me_html).
 *
 * The Wellpreneur template is bilingual (DE/EN dual-DOM). Static copy is
 * translated in the template itself, but the about text is user content and
 * gets translated server-side into the `about_me_html_en` site_data key.
 *
 * Like the FitLine shop links, `about_me_html_en` is intentionally NOT part
 * of the placeholder schema — it is derived data, invisible in the editor.
 *
 * Staleness tracking: `about_me_html_en_src` stores a hash of the German
 * source the translation was made from. The hash is only written on a
 * successful API translation, so failures (or a missing API key) fall back
 * to storing the German text as EN and retry on the next save.
 */
import { sanitizeRichtext } from '@/lib/security/sanitize'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { siteData } from '@/lib/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'

const OPENAI_MODEL = 'gpt-4o-mini'

/**
 * User-written fields that bilingual templates show in EN too. Each one gets a
 * derived `<key>_en` (+ `<key>_en_src` hash) in site_data — never in the schema.
 *   about_me_html → Wellpreneur „Über mich“
 *   intro         → Vitalprofil „Dein kurzer Text“
 */
const TRANSLATED_FIELDS: Array<{ de: string; en: string; src: string }> = [
  { de: 'about_me_html', en: 'about_me_html_en', src: 'about_me_html_en_src' },
  { de: 'intro', en: 'intro_en', src: 'intro_en_src' },
]

function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

async function translateHtml(germanHtml: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content:
              'You translate German HTML snippets into English for a personal "about me" section on a casual landing page. ' +
              'Rules: keep the HTML structure and all tags/attributes exactly as they are, translate only the text content. ' +
              'Translate idiomatically and colloquially, the way a native speaker would actually say it, not word for word. ' +
              'Never use em-dashes. Reply with ONLY the translated HTML, no explanations, no code fences.',
          },
          { role: 'user', content: germanHtml },
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
 * Ensures every translated field (see TRANSLATED_FIELDS) has an up-to-date EN
 * version. No-op per field when it is empty or the stored translation matches.
 */
export async function ensureAboutMeTranslation(siteId: string): Promise<void> {
  const keys = TRANSLATED_FIELDS.flatMap(f => [f.de, f.en, f.src])
  const rows = await db
    .select({ fieldKey: siteData.fieldKey, fieldValue: siteData.fieldValue })
    .from(siteData)
    .where(and(eq(siteData.userSiteId, siteId), inArray(siteData.fieldKey, keys)))

  const map: Record<string, string> = {}
  for (const r of rows) map[r.fieldKey] = r.fieldValue ?? ''

  for (const f of TRANSLATED_FIELDS) {
    const german = (map[f.de] ?? '').trim()
    if (!german) continue

    const srcHash = hashOf(german)
    if (map[f.en] && map[f.src] === srcHash) continue

    const translated = await translateHtml(german)

    // Fallback at the data level: store the German text so the template never
    // renders an empty EN section. Hash is only set on real translations.
    const upserts = [
      { userSiteId: siteId, fieldKey: f.en, fieldValue: sanitizeRichtext(translated ?? german), updatedAt: new Date() },
      { userSiteId: siteId, fieldKey: f.src, fieldValue: translated ? srcHash : '', updatedAt: new Date() },
    ]
    await db
      .insert(siteData)
      .values(upserts)
      .onConflictDoUpdate({
        target: [siteData.userSiteId, siteData.fieldKey],
        set: { fieldValue: sql`excluded.field_value`, updatedAt: new Date() },
      })
  }
}
