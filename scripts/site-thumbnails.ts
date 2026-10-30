/**
 * Echte Vorschaubilder für die Karten im Dashboard (Web + App): öffnet die veröffentlichte Seite wie ein
 * Besucher (Chromium, 1280×800), macht ein Bildschirmfoto des sichtbaren Bereichs, legt es als WebP in R2 ab
 * (site-thumbs/<userId>/<siteId>.webp – eine Datei je Seite, jede Neuaufnahme überschreibt sie) und trägt die Adresse in user_sites.thumb_url ein.
 *
 * Reihenfolge je Lauf:
 *   1. gerade veröffentlicht (thumb_requested_at neuer als thumb_at, frühestens 20 s danach → KV ist befüllt)
 *   2. noch ohne Bild
 *   3. Bild älter als 7 Tage (fängt Vorlagen-Updates ab)
 * Fehlversuche (Seite nicht 200, Zeitüberschreitung) pausieren die Seite 6 Stunden, außer sie wird neu veröffentlicht.
 *
 * Kein Besuch in der Statistik, kein Werbe-Pixel: der User-Agent enthält „headless“ (Worker BOT_UA_RE) und die
 * Cookie-Einwilligung ist vorab abgelehnt, das Banner wird ausgeblendet.
 *
 * App-Server (systemd-Timer fs-site-thumbs, Nutzer finestsites; .env.production gehört root → Kopie aus dem Build):
 *   node --env-file=.next/standalone/.env.production --import tsx scripts/site-thumbnails.ts [--limit 25] [--budget 100]
 * Einzelne Seite / Test ohne Schreiben (Bild landet unter --out, DB und R2 bleiben unberührt):
 *   … scripts/site-thumbnails.ts --site <siteId> [--dry --out ./thumbs]
 * Beliebige Adressen ansehen (immer ohne Schreiben): … scripts/site-thumbnails.ts --url https://demo.dailyoptimal.de --out ./thumbs
 */
import { sql } from 'drizzle-orm'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser } from 'playwright-core'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { uploadToR2 } from '@/lib/r2/client'
import { siteThumbKey } from '@/lib/sites/thumbnail'

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }
const LIMIT = Number(arg('--limit') ?? 25)
const BUDGET_MS = Number(arg('--budget') ?? 100) * 1000
const ONLY_SITE = arg('--site')
const DRY = process.argv.includes('--dry')
const OUT = arg('--out') ?? '.'
const URLS = process.argv.flatMap((a, i) => (process.argv[i - 1] === '--url' ? [a] : []))
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io').replace(/\/$/, '')

const VIEWPORT = { width: 1280, height: 800 }
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0 Safari/537.36 FinestSites-Vorschaubild/1.0 (headless)'
// Banner der Templates (fs-ck-*) ausblenden; Einwilligung ist vorab „abgelehnt“ gespeichert
const HIDE_CSS = '#fs-ck-wrap,#fs-ck-banner,#fs-ck-reopener{display:none!important}'

type Row = { id: string; user_id: string; username: string; domain: string; thumb_url: string | null }

async function pickSites(): Promise<Row[]> {
  if (ONLY_SITE) {
    const r = await db.execute(sql`
      select us.id, us.user_id, u.username, t.domain, us.thumb_url
      from user_sites us join users u on u.id = us.user_id join templates t on t.id = us.template_id
      where us.id = ${ONLY_SITE} and us.status = 'published' and u.username is not null`)
    return r as unknown as Row[]
  }
  const r = await db.execute(sql`
    select us.id, us.user_id, u.username, t.domain, us.thumb_url
    from user_sites us join users u on u.id = us.user_id join templates t on t.id = us.template_id
    where us.status = 'published' and u.username is not null
      and (us.thumb_requested_at is null or us.thumb_requested_at < now() - interval '20 seconds')
      and (us.thumb_error_at is null or us.thumb_error_at < now() - interval '6 hours'
           or us.thumb_requested_at > us.thumb_error_at)
      and (us.thumb_at is null or us.thumb_at < us.thumb_requested_at or us.thumb_at < now() - interval '7 days')
    order by (us.thumb_requested_at is not null and (us.thumb_at is null or us.thumb_at < us.thumb_requested_at)) desc,
             (us.thumb_at is null) desc, us.thumb_requested_at desc nulls last, us.thumb_at asc nulls first
    limit ${LIMIT}`)
  return r as unknown as Row[]
}

async function capture(browser: Browser, url: string): Promise<Buffer> {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, userAgent: USER_AGENT, locale: 'de-DE' })
  try {
    await ctx.addInitScript(() => {
      try { localStorage.setItem('fs_consent_v1', JSON.stringify({ v: 1, ts: new Date().toISOString(), necessary: true, statistics: false, marketing: false })) } catch { /* egal */ }
    })
    const page = await ctx.newPage()
    const res = await page.goto(url, { waitUntil: 'load', timeout: 25_000 })
    if (!res || res.status() !== 200) throw new Error(`HTTP ${res?.status() ?? 'ohne Antwort'}`)
    await page.addStyleTag({ content: HIDE_CSS })
    await page.evaluate(() => document.fonts?.ready).catch(() => {})
    await page.waitForTimeout(1800) // Einblend-Animationen im sichtbaren Bereich
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, ...VIEWPORT } })
    return await sharp(png).webp({ quality: 80 }).toBuffer()
  } finally {
    await ctx.close().catch(() => {})
  }
}

async function main() {
  if (URLS.length) {
    const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
    mkdirSync(OUT, { recursive: true })
    for (const u of URLS) {
      const t = Date.now()
      try {
        const webp = await capture(browser, u)
        const file = join(OUT, `${new URL(u).hostname}.webp`)
        writeFileSync(file, webp)
        console.log(`✓ ${u} → ${file} (${Math.round(webp.length / 1024)} KB, ${Date.now() - t} ms)`)
      } catch (err) { console.error(`✗ ${u}: ${err instanceof Error ? err.message.split('\n')[0] : err}`) }
    }
    await browser.close()
    return
  }
  const sites = await pickSites()
  if (sites.length === 0) { if (ONLY_SITE) console.log('Seite nicht gefunden oder nicht veröffentlicht'); return }
  const started = Date.now()
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
  let ok = 0, failed = 0
  try {
    for (const s of sites) {
      if (Date.now() - started > BUDGET_MS) break
      const url = `https://${s.username}.${s.domain}/`
      const at = Date.now()
      try {
        const webp = await capture(browser, url)
        if (DRY) {
          mkdirSync(OUT, { recursive: true })
          const file = join(OUT, `${s.username}.${s.domain}.webp`)
          writeFileSync(file, webp)
          console.log(`✓ ${url} → ${file} (${Math.round(webp.length / 1024)} KB)`)
        } else {
          const key = siteThumbKey(s.user_id, s.id)
          await uploadToR2(key, webp, 'image/webp') // überschreibt das alte Bild
          const thumbUrl = `${APP_URL}/api/media/${key}?v=${at}` // neue Version → Caches holen das neue Bild
          // thumb_at = Beginn der Aufnahme: wird währenddessen neu veröffentlicht, kommt die Seite gleich wieder dran
          await db.execute(sql`update user_sites set thumb_url = ${thumbUrl}, thumb_at = to_timestamp(${at}::bigint / 1000.0), thumb_error_at = null where id = ${s.id}`)
          console.log(`✓ ${url} (${Math.round(webp.length / 1024)} KB)`)
        }
        ok++
      } catch (err) {
        failed++
        const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : ''
        console.error(`✗ ${url}: ${err instanceof Error ? err.message.split('\n')[0] : err}${cause}`)
        if (!DRY) await db.execute(sql`update user_sites set thumb_error_at = now() where id = ${s.id}`)
      }
    }
  } finally {
    await browser.close().catch(() => {})
  }
  console.log(`${new Date().toISOString()} Vorschaubilder: ${ok} neu, ${failed} Fehler, ${Math.round((Date.now() - started) / 1000)} s`)
}

main().then(() => process.exit(0), err => { console.error(err); process.exit(1) })
