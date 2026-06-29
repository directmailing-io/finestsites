import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and, ne, or, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'
import TemplateStartCTA from '@/components/TemplateStartCTA'
import InteractiveEditorPreview, { type PlaceholderSchema } from '@/components/InteractiveEditorPreview'
import StickyPurchaseBar from '@/components/StickyPurchaseBar'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

interface DetailSection {
  id?: string
  heading: string
  text: string
  imageUrl: string
  imagePosition: 'left' | 'right'
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [tpl] = await db.select({ title: templates.title, description: templates.description })
    .from(templates).where(or(eq(templates.slug, id), sql`${templates.id}::text = ${id}`)).limit(1)
  if (!tpl) return {}
  return {
    title: `${tpl.title} – Template | FinestSites`,
    description: tpl.description ?? undefined,
  }
}

const DEFAULT_SECTIONS: DetailSection[] = [
  {
    heading: 'Kein Aufwand. Wirklich keiner.',
    text: 'Du brauchst kein technisches Wissen, kein Designtalent und keine Erfahrung im Marketing. Das Template ist fertig konzipiert — du trägst nur deine Infos ein und bist in unter 5 Minuten online. Alles andere ist schon erledigt.',
    imagePosition: 'left',
    imageUrl: '',
  },
  {
    heading: 'Dein Link. Überall einsetzbar.',
    text: 'In die Bio, in Stories, auf Visitenkarten, Flyern oder dem Auto. Wer deinen Link aufruft, landet auf einer professionellen Seite, die für dich spricht — rund um die Uhr, auch wenn du gerade schläfst.',
    imagePosition: 'right',
    imageUrl: '',
  },
  {
    heading: 'Interessenten melden sich bei dir.',
    text: 'Jeder, der das Kontaktformular ausfüllt, landet direkt in deinem Dashboard. Du siehst sofort, wer sich gemeldet hat, und antwortest wann du willst. Kein Hinterherlaufen, kein Kaltakquise.',
    imagePosition: 'left',
    imageUrl: '',
  },
  {
    heading: 'Wird automatisch immer besser.',
    text: 'Wir optimieren die Templates laufend — basierend auf echten Daten von tausenden Besuchern. Deine Website wird mit der Zeit besser, ohne dass du etwas tun musst. Wartung, Updates und Verbesserungen sind inklusive.',
    imagePosition: 'right',
    imageUrl: '',
  },
]

const SECTION_ICONS = [
  <svg key="0" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2l9-9a3.5 3.5 0 00-5-5l-7 7z"/><path d="M12 15l-3-3"/></svg>,
  <svg key="1" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  <svg key="2" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>,
  <svg key="3" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
]

export default async function TemplateDetailPage({ params }: Props) {
  const { id } = await params

  const [tpl] = await db.select()
    .from(templates)
    .where(and(or(eq(templates.slug, id), sql`${templates.id}::text = ${id}`), eq(templates.status, 'published')))
    .limit(1)

  if (!tpl) notFound()

  const nmCompanies = Array.isArray(tpl.nmCompanies) ? tpl.nmCompanies as string[] : []

  // Weitere Templates: prefer same NM company, fallback to any other published
  let otherTemplates: typeof moreTemplatesQuery = []
  const moreTemplatesQuery = await db.select({
    id: templates.id,
    slug: templates.slug,
    title: templates.title,
    description: templates.description,
    previewImages: templates.previewImages,
    tags: templates.tags,
    detailColor: templates.detailColor,
    nmCompanies: templates.nmCompanies,
    domain: templates.domain,
  })
    .from(templates)
    .where(and(
      eq(templates.status, 'published'),
      ne(templates.id, tpl.id),
      // overlap on nmCompanies array if available
      nmCompanies.length > 0
        ? sql`${templates.nmCompanies} && ARRAY[${sql.raw(nmCompanies.map(c => `'${c.replace(/'/g, "''")}'`).join(','))}]::text[]`
        : undefined,
    ))
    .limit(3)

  otherTemplates = moreTemplatesQuery

  // Fallback: if not enough, grab any others
  if (otherTemplates.length < 3) {
    const fallback = await db.select({
      id: templates.id,
      slug: templates.slug,
      title: templates.title,
      description: templates.description,
      previewImages: templates.previewImages,
      tags: templates.tags,
      detailColor: templates.detailColor,
      nmCompanies: templates.nmCompanies,
      domain: templates.domain,
    })
      .from(templates)
      .where(and(
        eq(templates.status, 'published'),
        ne(templates.id, tpl.id),
        sql`${templates.id} != ALL(ARRAY[${sql.raw(otherTemplates.map(t => `'${t.id}'`).join(',') || "'00000000-0000-0000-0000-000000000000'")}]::uuid[])`,
      ))
      .limit(3 - otherTemplates.length)
    otherTemplates = [...otherTemplates, ...fallback]
  }

  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const accentColor = tpl.detailColor ?? '#8060b0'
  const accentBg = `${accentColor}12`
  const tags = Array.isArray(tpl.tags) ? tpl.tags as string[] : []
  const dbSections = Array.isArray(tpl.detailContent) ? tpl.detailContent as DetailSection[] : []
  // Derive interactivity directly from placeholderSchema (single source of truth)
  const schema = (tpl.placeholderSchema ?? {}) as PlaceholderSchema
  const hasInteractiveFields = (schema.fields ?? []).some(f => f.preview_interactive)

  // Build feature sections from schema for the feature showcase
  type SchemaField = { key: string; label: string; type: string; section?: string; sub_fields?: unknown[] }
  const schemaFields = (schema.fields ?? []) as SchemaField[]
  const sectionMap = new Map<string, SchemaField[]>()
  for (const f of schemaFields) {
    const sec = f.section ?? 'Sonstiges'
    if (!sectionMap.has(sec)) sectionMap.set(sec, [])
    sectionMap.get(sec)!.push(f)
  }
  const loopFields = schemaFields.filter(f => f.type === 'loop')
  const hasLoopField = loopFields.length > 0

  const sections: DetailSection[] = dbSections.length >= 4
    ? dbSections.slice(0, 4)
    : DEFAULT_SECTIONS.map((def, i) => dbSections[i] ?? def)

  const registerUrl = `https://app.finestsites.io/register?template=${tpl.id}&tname=${encodeURIComponent(tpl.title)}`

  // Label for "Weitere Templates" heading
  const moreLabel = nmCompanies.length > 0
    ? `Weitere ${nmCompanies[0]}-Templates`
    : 'Weitere Templates'

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* iOS Safari bfcache fix: force reload when navigating back so React re-mounts */}
      <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('pageshow',function(e){if(e.persisted)window.location.reload();});` }} />
      <style>{`
        @font-face {
          font-family: 'Plus Jakarta Sans';
          src: url('/fonts/PlusJakartaSans-latin-ext.woff2') format('woff2');
          font-weight: 400 700;
          font-style: normal;
          font-display: swap;
          unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
        }
        @font-face {
          font-family: 'Plus Jakarta Sans';
          src: url('/fonts/PlusJakartaSans-latin.woff2') format('woff2');
          font-weight: 400 700;
          font-style: normal;
          font-display: swap;
          unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
        }
        @font-face {
          font-family: 'Plein';
          src: url('/fonts/Plein-Regular.otf') format('opentype');
          font-weight: 400; font-display: swap;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        section[id] { scroll-margin-top: 90px; }

        .fs-nav-links { display: flex; gap: 28px; align-items: center; }
        .fs-nav-actions { display: flex; gap: 8px; align-items: center; }
        .fs-hamburger { display: none !important; }

        /* Hero */
        .vd-hero { padding: 108px 7vw 72px; }

        /* Preview section */
        .vd-preview { padding: 0 7vw 80px; }
        .vd-preview-inner { max-width: 1080px; margin: 0 auto; }
        .vd-preview-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 10px; }
        .vd-preview-title { font-family: 'Plein', Georgia, serif; font-size: clamp(22px, 3vw, 34px); font-weight: 400; letter-spacing: -0.025em; line-height: 1.15; margin-bottom: 8px; }
        .vd-preview-sub { font-size: 15px; color: #888; line-height: 1.6; max-width: 480px; margin-bottom: 28px; }
        .editor-preview-pane { height: 620px; }

        /* Feature rows */
        .vd-feature-row { padding: 88px 7vw; }
        .vd-feature-inner { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .vd-feature-inner.reverse { direction: rtl; }
        .vd-feature-inner.reverse > * { direction: ltr; }
        .vd-feature-img { border-radius: 20px; overflow: hidden; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; }

        /* More templates */
        .vd-more-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .vd-more-card { display: block; text-decoration: none; background: #1c1c1e; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 2px 16px rgba(0,0,0,0.3); transition: transform 0.2s, box-shadow 0.2s; }
        .vd-more-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,0.5); }

        @media (max-width: 1023px) {
          .vd-more-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 767px) {
          .fs-nav-links { display: none; }
          .fs-nav-actions { display: none !important; }
          .fs-hamburger { display: flex !important; }

          /* Hero: compact on mobile */
          .vd-hero { padding: 88px 20px 36px; }
          .vd-hero-grid { grid-template-columns: 1fr !important; gap: 20px !important; }
          .vd-hero-cta { display: none; } /* StickyPurchaseBar + NavBar handle CTA */

          /* Editor preview: edge-to-edge feel */
          .vd-preview { padding: 0 0 48px; overflow: hidden; }
          .vd-preview-inner { max-width: 100%; }
          .vd-preview-text { padding: 0 20px; }
          .vd-preview-eyebrow { padding: 0 20px; }
          .vd-preview-title { padding: 0 20px; }
          .vd-preview-sub { padding: 0 20px; }
          .vd-preview-editor { border-radius: 0 !important; margin: 0 !important; }

          /* Features: single column */
          .vd-feature-row { padding: 48px 20px; }
          .vd-feature-inner { grid-template-columns: 1fr; gap: 28px; }
          .vd-feature-inner.reverse { direction: ltr; }

          /* More templates: single column */
          .vd-more-grid { grid-template-columns: 1fr; }

          /* Safe area bottom for phones with home indicator */
          .vd-final-cta { padding-bottom: max(96px, calc(96px + env(safe-area-inset-bottom))) !important; }
        }
        @media (max-width: 479px) {
          .vd-hero { padding: 80px 16px 28px; }
          .vd-feature-row { padding: 40px 16px; }
          .vd-preview-eyebrow { padding: 0 16px; }
          .vd-preview-title { padding: 0 16px; }
          .vd-preview-sub { padding: 0 16px; }
        }
      `}</style>

      <NavBar primaryCta={{ label: 'Template freischalten', href: registerUrl }} />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="vd-hero" style={{ background: '#fff' }} id="vd-hero">
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>

          <Link href="/#templates" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999', textDecoration: 'none', marginBottom: 32, fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Alle Templates
          </Link>

          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize: 11, fontWeight: 700, color: accentColor, background: accentBg, padding: '4px 12px', borderRadius: 100, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tag}</span>
              ))}
            </div>
          )}

          <div className="vd-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 48, alignItems: 'flex-end' }}>
            <div>
              <h1 style={{
                fontFamily: '"Plein", Georgia, serif',
                fontSize: 'clamp(32px, 4.5vw, 60px)',
                fontWeight: 400,
                color: '#111',
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                marginBottom: tpl.description ? 20 : 36,
              }}>
                {tpl.title}
              </h1>
              {tpl.description && (
                <p style={{ fontSize: 17, color: '#666', lineHeight: 1.7, maxWidth: 600 }}>
                  {tpl.description}
                </p>
              )}
            </div>
            <div className="vd-hero-cta" style={{ flexShrink: 0, paddingBottom: 4 }}>
              <TemplateStartCTA templateId={tpl.id} templateTitle={tpl.title} />
            </div>
          </div>
        </div>
      </section>

      {/* Sentinel for sticky bar — placed right after hero */}
      <StickyPurchaseBar templateTitle={tpl.title} registerUrl={registerUrl} />

      {/* ── INTERACTIVE EDITOR PREVIEW ────────────────────────────────────────── */}
      <section className="vd-preview">
        <div className="vd-preview-inner">
          {hasInteractiveFields && (
            <>
              <p className="vd-preview-eyebrow" style={{ color: '#888' }}>Live-Vorschau</p>
              <h2 className="vd-preview-title" style={{ color: '#111' }}>
                So sieht deine Seite aus. Probier es direkt aus.
              </h2>
              <p className="vd-preview-sub">
                Passe Farbe, Sektionen und mehr an. Die Vorschau reagiert sofort.
              </p>
            </>
          )}

          {hasInteractiveFields ? (
            <InteractiveEditorPreview
              templateId={tpl.id}
              domain={tpl.domain}
              placeholderSchema={schema}
              accentColor={accentColor}
              registerUrl={registerUrl}
              sidebarCallout={
                <div style={{
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  padding: '14px 16px 16px',
                  background: '#FAFAFA',
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#bbb', marginBottom: 10 }}>
                    Im echten Editor außerdem
                  </p>
                  {[
                    'Profil­bild hochladen',
                    'Bio & Social-Links',
                    'Bis zu 50 Events',
                    'Online & Vor-Ort-Events',
                    'Eigene Domain',
                  ].map(item => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      <span style={{ fontSize: 12, color: '#555', lineHeight: 1.3 }}>{item}</span>
                    </div>
                  ))}
                  <a href={registerUrl} style={{
                    display: 'block', marginTop: 14, textAlign: 'center',
                    background: accentColor, color: '#fff',
                    fontSize: 11.5, fontWeight: 700, padding: '9px 12px',
                    borderRadius: 8, textDecoration: 'none', letterSpacing: '0.02em',
                  }}>
                    Alles freischalten →
                  </a>
                </div>
              }
            />
          ) : (
            /* Fallback: static cover image if no previewConfig */
            images[0] && (
              <div style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 16px 64px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.06)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images[0]} alt={tpl.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            )
          )}
        </div>
      </section>

      {/* ── FEATURE SHOWCASE: what the real editor offers ─────────────────────── */}
      {sectionMap.size > 0 && (
        <section style={{ padding: '72px 7vw 0', background: '#fff' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              Was du alles einstellen kannst
            </p>
            <h2 style={{ fontFamily: '"Plein", Georgia, serif', fontSize: 'clamp(22px, 2.8vw, 36px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', marginBottom: 40 }}>
              Viel mehr als nur ein paar Farben.
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {Array.from(sectionMap.entries()).map(([section, fields]) => {
                const loopCount = fields.filter(f => f.type === 'loop').reduce((acc, f) => acc + (f.sub_fields?.length ?? 0), 0)
                const fieldCount = fields.filter(f => f.type !== 'loop').length + loopCount
                const icons: Record<string, React.ReactNode> = {
                  'Profil': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
                  'Design': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
                  'Events': <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
                }
                const descriptions: Record<string, string> = {
                  'Profil': 'Name, Foto, Bio und alle Infos zu dir als Person.',
                  'Design': 'Dunkel oder hell, Akzentfarbe – dein Look.',
                  'Events': 'Online-Events, Vor-Ort-Termine, wöchentlich oder einmalig.',
                }
                return (
                  <div key={section} style={{
                    background: '#F9F9F9',
                    borderRadius: 16,
                    padding: '22px 22px 20px',
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}>
                    <div style={{ color: accentColor, marginBottom: 14 }}>
                      {icons[section] ?? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>}
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 5 }}>{section}</p>
                    <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, marginBottom: 12 }}>
                      {descriptions[section] ?? `${fieldCount} Einstellungsoptionen`}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {fields.filter(f => f.type !== 'loop').slice(0, 5).map(f => (
                        <span key={f.key} style={{ fontSize: 11, fontWeight: 500, color: '#666', background: '#EFEFEF', padding: '3px 9px', borderRadius: 100 }}>
                          {f.label}
                        </span>
                      ))}
                      {fields.filter(f => f.type === 'loop').map(f => (
                        <span key={f.key} style={{ fontSize: 11, fontWeight: 500, color: accentColor, background: accentBg, padding: '3px 9px', borderRadius: 100 }}>
                          {f.label}
                        </span>
                      ))}
                      {fields.filter(f => f.type !== 'loop').length > 5 && (
                        <span style={{ fontSize: 11, color: '#aaa', padding: '3px 4px' }}>
                          +{fields.filter(f => f.type !== 'loop').length - 5} weitere
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── EVENT CREATION STEPS (only for templates with loop fields) ─────────── */}
      {hasLoopField && (
        <section style={{ padding: '72px 7vw 0', background: '#fff' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              So einfach geht&apos;s
            </p>
            <h2 style={{ fontFamily: '"Plein", Georgia, serif', fontSize: 'clamp(22px, 2.8vw, 36px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', marginBottom: 48 }}>
              Ein neues {loopFields[0]?.label ?? 'Event'} anlegen — in unter 2 Minuten.
            </h2>
            <div className="vd-steps-grid">
              {[
                {
                  num: '01',
                  title: '+ Event hinzufügen',
                  desc: 'Im Editor auf „+ Event" klicken. Der Name, die Art (Online oder Vor Ort) und das Datum — das reicht schon.',
                  detail: 'Eventname · Datum & Uhrzeit · Online oder Vor Ort',
                },
                {
                  num: '02',
                  title: 'Beschreibung & Details',
                  desc: 'Ein kurzer Text, was die Teilnehmer erwartet. Optional: Highlights, Gäste, Wiederholungen.',
                  detail: 'Beschreibung · Highlights · Wiederkehrend',
                },
                {
                  num: '03',
                  title: 'Sofort live',
                  desc: 'Event auf „Veröffentlicht" setzen — fertig. Deine Seite zeigt den neuen Termin in Echtzeit.',
                  detail: 'Entwurf oder sofort live · Countdown automatisch',
                },
              ].map((step, i) => (
                <div key={i} className="vd-step-card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                    <span style={{
                      fontFamily: '"Plein", Georgia, serif',
                      fontSize: 32, fontWeight: 400, color: accentColor,
                      opacity: 0.4, lineHeight: 1, flexShrink: 0,
                      letterSpacing: '-0.04em',
                    }}>{step.num}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', lineHeight: 1.3, paddingTop: 4 }}>{step.title}</h3>
                  </div>
                  <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, marginBottom: 16 }}>{step.desc}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {step.detail.split(' · ').map(d => (
                      <span key={d} style={{ fontSize: 11, fontWeight: 500, color: '#888', background: '#F5F5F5', padding: '3px 9px', borderRadius: 100 }}>{d}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <style>{`
              .vd-steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
              .vd-step-card {
                background: #fff;
                border: 1px solid rgba(0,0,0,0.08);
                border-radius: 18px;
                padding: 28px 24px 24px;
                position: relative;
              }
              .vd-step-card::before {
                content: '';
                position: absolute;
                top: 0; left: 28px; right: 28px;
                height: 2px;
                background: ${accentColor};
                opacity: 0.18;
                border-radius: 0 0 2px 2px;
              }
              @media (max-width: 767px) {
                .vd-steps-grid { grid-template-columns: 1fr; }
              }
            `}</style>
          </div>
        </section>
      )}

      {/* ── 4 ALTERNATING FEATURE SECTIONS ───────────────────────────────────── */}
      {sections.map((section, i) => {
        const isReverse = section.imagePosition === 'right'
        const sectionImg = section.imageUrl || images[i + 1] || null
        const isDark = i % 2 !== 0
        const bg = isDark ? '#F9F7FF' : '#fff'
        const num = String(i + 1).padStart(2, '0')

        return (
          <section key={i} className="vd-feature-row" style={{ background: bg }}>
            <div className={`vd-feature-inner${isReverse ? ' reverse' : ''}`}>

              <div
                className="vd-feature-img"
                style={{
                  background: sectionImg ? 'transparent' : accentBg,
                  border: sectionImg ? 'none' : `1px solid ${accentColor}22`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                }}
              >
                {sectionImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sectionImg} alt={section.heading} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 48, color: accentColor, opacity: 0.5 }}>
                    {SECTION_ICONS[i]}
                  </div>
                )}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
                  {num}
                </p>
                <h2 style={{
                  fontFamily: '"Plein", Georgia, serif',
                  fontSize: 'clamp(24px, 2.8vw, 38px)',
                  fontWeight: 400,
                  color: '#111',
                  lineHeight: 1.15,
                  letterSpacing: '-0.025em',
                  marginBottom: 20,
                }}>
                  {section.heading}
                </h2>
                <p style={{ fontSize: 16, color: '#555', lineHeight: 1.8 }}>
                  {section.text}
                </p>
              </div>
            </div>
          </section>
        )
      })}

      {/* ── WEITERE TEMPLATES ─────────────────────────────────────────────────── */}
      {otherTemplates.length > 0 && (
        <section style={{ background: '#111', padding: '88px 7vw' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Mehr entdecken</p>
            <h2 style={{ fontFamily: '"Plein", Georgia, serif', fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 400, color: '#fff', letterSpacing: '-0.02em', marginBottom: 44 }}>
              {moreLabel}
            </h2>

            <div className="vd-more-grid">
              {otherTemplates.map(t => {
                const tImgs = Array.isArray(t.previewImages) ? t.previewImages as string[] : []
                const tColor = t.detailColor ?? '#8060b0'
                const tTags = Array.isArray(t.tags) ? t.tags as string[] : []
                return (
                  <a key={t.id} href={`/vorlagen/${t.slug ?? t.id}`} className="vd-more-card">
                    <div style={{ aspectRatio: '16/9', background: `${tColor}22`, overflow: 'hidden' }}>
                      {tImgs[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tImgs[0]} alt={t.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${tColor}33, ${tColor}11)` }} />
                      )}
                    </div>
                    <div style={{ padding: '20px 22px 24px' }}>
                      {tTags.length > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: tColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                          {tTags[0]}
                        </span>
                      )}
                      <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>{t.title}</p>
                      {t.description && (
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {t.description}
                        </p>
                      )}
                      <p style={{ fontSize: 13, fontWeight: 600, color: tColor, marginTop: 14 }}>Template ansehen →</p>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── FINAL CTA ─────────────────────────────────────────────────────────── */}
      <section className="vd-final-cta" style={{ background: '#111', padding: '96px 7vw' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 32 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20 }}>Los geht&apos;s</p>
            <h2 style={{ fontFamily: '"Plein", Georgia, serif', fontSize: 'clamp(28px, 3.8vw, 52px)', fontWeight: 400, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: 16 }}>
              Dieses Template ist deins.<br />In 5 Minuten live.
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
              Kein Vorwissen, kein Designer, kein Aufwand. Einfach starten.
            </p>
          </div>
          <TemplateStartCTA templateId={tpl.id} templateTitle={tpl.title} light />
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Ab €20/Monat · Jederzeit kündbar · Keine Einrichtungsgebühr</p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
