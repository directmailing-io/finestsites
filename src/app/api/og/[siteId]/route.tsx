/**
 * GET /api/og/{siteId}.png — Vorschaubild (1200×630) für WhatsApp, Facebook, Instagram & Co.
 * Foto (oder Initialen), Name, Claim des Templates, Adresse — in der Farbe des gewählten
 * Farbthemas (Schema-Feld „farbthema“), abgedunkelt bis weiße Schrift gut lesbar ist.
 * Öffentlich, ohne Daten außer dem, was die Seite selbst zeigt. 1 Tag gecacht; der
 * ?v=-Parameter aus open-graph.ts ändert sich mit Name/Foto.
 */
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { siteData, templates, userSites, users } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { ogProfile, ogName, ogInitials, ogClaim } from '@/lib/utils/open-graph'

export const runtime = 'nodejs'

const KEYS = ['vorname', 'nachname', 'vorname2', 'partner_vorname', 'partner_modus', 'team_modus', 'profilbild', 'profilbild2', 'partner_profilbild', 'farbthema']

async function loadPhoto(url: string | undefined, origin: string): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null
  try {
    // Eigene Medien direkt vom Server holen (schneller, kein Umweg über Cloudflare)
    const local = url.replace(/^https:\/\/app\.finestsites\.io/, origin)
    const res = await fetch(local, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    if (!type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 6_000_000) return null
    if (/^image\/(png|jpe?g|gif)$/i.test(type)) return `data:${type};base64,${buf.toString('base64')}`
    // WebP/AVIF/HEIC kann ImageResponse nicht lesen („u2 is not iterable“, Vorschaubild 502):
    // vorher in JPEG umwandeln (13.10.2026, betraf u. a. das Platzhalter-Profilbild).
    const sharp = (await import('sharp')).default
    const jpg = await sharp(buf).rotate().resize(600, 600, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer()
    return `data:image/jpeg;base64,${jpg.toString('base64')}`
  } catch { return null }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId: raw } = await params
  const siteId = raw.replace(/\.png$/i, '')
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) return new Response('Not found', { status: 404 })

  const [site] = await db
    .select({ id: userSites.id, status: userSites.status, domain: templates.domain, username: users.username, customDomain: userSites.customDomain, customDomainStatus: userSites.customDomainStatus, publishedData: userSites.publishedData, schema: templates.placeholderSchema })
    .from(userSites)
    .innerJoin(templates, eq(templates.id, userSites.templateId))
    .innerJoin(users, eq(users.id, userSites.userId))
    .where(eq(userSites.id, siteId))
    .limit(1)
  if (!site) return new Response('Not found', { status: 404 })

  const rows = await db.select({ k: siteData.fieldKey, v: siteData.fieldValue }).from(siteData)
    .where(and(eq(siteData.userSiteId, siteId), inArray(siteData.fieldKey, KEYS)))
  const data: Record<string, string> = {}
  for (const r of rows) data[r.k] = r.v ?? ''
  if (site.publishedData) for (const k of KEYS) if (k in site.publishedData) data[k] = site.publishedData[k] ?? ''

  const p = ogProfile(site.domain)
  const accent = themeAccent(site.schema, data.farbthema) ?? p.accent
  const claim = ogClaim(p, data)
  const name = ogName(data)
  const initials = ogInitials(data)
  const host = site.customDomain && site.customDomainStatus === 'active' ? site.customDomain : `${site.username}.${site.domain}`
  const duo = data.partner_modus === 'duo' || data.team_modus === 'team'
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:3002'
  const photo = await loadPhoto(data.profilbild, origin)
  const photo2 = duo ? await loadPhoto(data.profilbild2 || data.partner_profilbild, origin) : null

  const circle = (src: string | null, offset = 0) => src
    ? <img src={src} width={300} height={300} style={{ width: 300, height: 300, borderRadius: 150, objectFit: 'cover', border: '10px solid rgba(255,255,255,0.9)', marginLeft: offset, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} />
    : <div style={{ width: 300, height: 300, borderRadius: 150, background: 'rgba(255,255,255,0.18)', border: '10px solid rgba(255,255,255,0.9)', color: p.ink, fontSize: 120, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: offset }}>{initials}</div>

  const image = new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', background: `linear-gradient(135deg, ${accent} 0%, ${shade(accent, -14)} 100%)`, color: p.ink, fontFamily: 'sans-serif', position: 'relative' }}>
        <div style={{ position: 'absolute', right: -120, top: -160, width: 520, height: 520, borderRadius: 260, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 80px', width: '100%' }}>
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {circle(photo)}
            {duo && circle(photo2, -70)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 64, maxWidth: duo ? 480 : 640 }}>
            <div style={{ fontSize: 30, opacity: 0.85, letterSpacing: 2, textTransform: 'uppercase' }}>{claim}</div>
            <div style={{ fontSize: name.length > 22 ? 64 : 76, fontWeight: 700, lineHeight: 1.05, marginTop: 14 }}>{name}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 34, fontSize: 28, opacity: 0.9 }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: p.ink, marginRight: 14, opacity: 0.9 }} />
              {host}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
  image.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800')
  return image
}

/** Farbe des gewählten Farbthemas (sonst Standard des Templates) aus dem Schema, für weiße
 *  Schrift abgedunkelt: Kontrast mindestens 4,5:1, Farbton bleibt. */
function themeAccent(schema: unknown, chosen: string | undefined): string | null {
  const fields = (schema as { fields?: { key: string; default_value?: string; card_options?: { value: string; color?: string }[] }[] } | null)?.fields ?? []
  const f = fields.find(x => x.key === 'farbthema')
  if (!f?.card_options?.length) return null
  const value = chosen || f.default_value
  const color = f.card_options.find(o => o.value === value)?.color
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return null
  let c = color.toLowerCase()
  for (let i = 0; i < 40 && contrastWithWhite(c) < 4.5; i++) c = scale(c, 0.95)
  return c
}

/** Alle Kanäle gleich skalieren: dunkler, Farbton bleibt. */
function scale(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(v * f)
  return `#${((ch((n >> 16) & 255) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, '0')}`
}

function contrastWithWhite(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return 1.05 / (L + 0.05)
}

/** Farbe aufhellen/abdunkeln (Prozent) */
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * 255)))
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
