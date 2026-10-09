/**
 * POST /api/cron/translate-sites?limit=10&domain=dailyoptimal.de
 * Übersetzt die Nutzertexte (about_me_html, about_intro, intro) aller veröffentlichten Seiten eines
 * Templates in dessen Sprachen nach — für Seiten, die vor der Mehrsprachigkeit veröffentlicht wurden.
 * Idempotent: bereits aktuelle Übersetzungen (Hash) werden übersprungen. Geschützt mit CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { userSites, templates, siteData } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { safeEqual } from '@/lib/security/request'
import { ensureAboutMeTranslation, templateLangs } from '@/lib/utils/translate'

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? ''
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const domain = req.nextUrl.searchParams.get('domain') ?? 'dailyoptimal.de'
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10) || 10))
  const langs = templateLangs(domain)
  const lastLang = langs[langs.length - 1]

  // Seiten mit deutschem Text, denen die letzte Sprache (= noch nie nachübersetzt) fehlt
  const sites = await db
    .select({ id: userSites.id })
    .from(userSites)
    .innerJoin(templates, eq(templates.id, userSites.templateId))
    .where(and(
      eq(templates.domain, domain),
      eq(userSites.status, 'published'),
      sql`exists (select 1 from ${siteData} d where d.user_site_id = ${userSites.id} and d.field_key in ('about_me_html','about_intro','intro') and coalesce(d.field_value,'') <> '')`,
      sql`not exists (select 1 from ${siteData} d where d.user_site_id = ${userSites.id} and d.field_key = ${'about_me_html_' + lastLang + '_src'} and coalesce(d.field_value,'') <> '')`,
    ))
  const batch = sites.slice(0, limit)
  const results: { id: string; ok: boolean; error?: string }[] = []
  for (const s of batch) {
    try { await ensureAboutMeTranslation(s.id, langs); results.push({ id: s.id, ok: true }) }
    catch (err) { results.push({ id: s.id, ok: false, error: err instanceof Error ? err.message : 'error' }) }
  }
  const done = results.filter(r => r.ok).length
  return NextResponse.json({ domain, langs, open: sites.length, processed: batch.length, done, remaining: sites.length - done, results })
}
