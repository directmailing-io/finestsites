/**
 * POST /api/cron/translate-sites?limit=10&domain=dailyoptimal.de
 * Übersetzt die Nutzertexte (about_me_html, about_intro, intro) aller veröffentlichten Seiten eines
 * Templates in dessen Sprachen nach – im Entwurf (site_data) UND im veröffentlichten Schnappschuss
 * (user_sites.published_data, den der Worker ausliefert).
 *
 * „Offen“ = irgendein Feld in irgendeiner Sprache ohne gültigen Hash (Entwurf oder Schnappschuss).
 * Früher wurde nur die letzte Sprache geprüft; schlug eine andere Sprache fehl (OpenAI 429 → deutscher
 * Fallback ohne Hash), galt die Seite trotzdem als fertig (so 10.10.2026 bei 6 Seiten passiert).
 * Idempotent, geschützt mit CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { userSites, templates } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { safeEqual } from '@/lib/security/request'
import { ensureAboutMeTranslation, ensurePublishedTranslation, templateLangs } from '@/lib/utils/translate'

const FIELDS = ['about_me_html', 'about_intro', 'intro']
// Muss hashOf() in translate.ts entsprechen: sha256(trim(text)) hex, erste 16 Zeichen
const WS = String.raw`E' \t\n\r'`

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? ''
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const domain = req.nextUrl.searchParams.get('domain') ?? 'dailyoptimal.de'
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10) || 10))
  const langs = templateLangs(domain)
  const langArray = sql`array[${sql.join(langs.map(l => sql`${l}`), sql`, `)}]::text[]`
  const fieldArray = sql`array[${sql.join(FIELDS.map(f => sql`${f}`), sql`, `)}]::text[]`

  const sites = await db
    .select({ id: userSites.id })
    .from(userSites)
    .innerJoin(templates, eq(templates.id, userSites.templateId))
    .where(and(
      eq(templates.domain, domain),
      eq(userSites.status, 'published'),
      sql`exists (
        select 1 from unnest(${langArray}) l(lang), unnest(${fieldArray}) f(key)
        where
          -- Entwurf: deutscher Text vorhanden, Hash der Sprache fehlt oder passt nicht
          exists (
            select 1 from site_data d
            where d.user_site_id = ${userSites.id} and d.field_key = f.key
              and btrim(coalesce(d.field_value, ''), ${sql.raw(WS)}) <> ''
              and coalesce((select t.field_value from site_data t where t.user_site_id = d.user_site_id and t.field_key = d.field_key || '_' || l.lang || '_src'), '')
                  <> left(encode(sha256(convert_to(btrim(d.field_value, ${sql.raw(WS)}), 'UTF8')), 'hex'), 16)
          )
          -- Schnappschuss (das, was der Worker ausliefert)
          or (
            btrim(coalesce(${userSites.publishedData} ->> f.key, ''), ${sql.raw(WS)}) <> ''
            and coalesce(${userSites.publishedData} ->> (f.key || '_' || l.lang || '_src'), '')
                <> left(encode(sha256(convert_to(btrim(${userSites.publishedData} ->> f.key, ${sql.raw(WS)}), 'UTF8')), 'hex'), 16)
          )
      )`,
    ))
  const batch = sites.slice(0, limit)
  const results: { id: string; ok: boolean; published?: number; error?: string }[] = []
  for (const s of batch) {
    try {
      await ensureAboutMeTranslation(s.id, langs)
      const published = await ensurePublishedTranslation(s.id, langs)
      results.push({ id: s.id, ok: true, published })
    } catch (err) { results.push({ id: s.id, ok: false, error: err instanceof Error ? err.message : 'error' }) }
  }
  const done = results.filter(r => r.ok).length
  return NextResponse.json({ domain, langs, open: sites.length, processed: batch.length, done, remaining: sites.length - done, results })
}
