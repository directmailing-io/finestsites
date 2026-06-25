import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import NavBar from '@/app/_components/NavBar'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const [tpl] = await db.select({ title: templates.title, description: templates.description })
    .from(templates).where(eq(templates.id, id)).limit(1)
  if (!tpl) return {}
  return {
    title: `${tpl.title} – Template | FinestSites`,
    description: tpl.description ?? undefined,
  }
}

const BADGE_STYLES: Record<string, { bg: string; label: string }> = {
  brandneu: { bg: '#7C3AED', label: 'Brandneu' },
  beliebt:  { bg: '#EA580C', label: 'Sehr beliebt' },
}

const BENEFIT_ICONS = [
  '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
]

const DEFAULT_BENEFITS = [
  'Alle Texte bereits professionell geschrieben',
  'Design komplett fertig — kein Gestalten nötig',
  'Rechtliche Seiten (Impressum, Datenschutz) inklusive',
  'Kontaktformular für eingehende Anfragen',
  'Mobiloptimiert — perfekt auf jedem Gerät',
  'In unter 5 Minuten live',
]

export default async function TemplateDetailPage({ params }: Props) {
  const { id } = await params

  const [tpl] = await db.select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.status, 'published')))
    .limit(1)

  if (!tpl) notFound()

  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const coverImg = images[0] ?? null
  const badge = tpl.badge ? BADGE_STYLES[tpl.badge] ?? null : null
  const accentColor = tpl.detailColor ?? '#8060b0'
  const tags = Array.isArray(tpl.tags) ? tpl.tags as string[] : []

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />
      <style>{`
        @font-face {
          font-family: 'Plein';
          src: url('/fonts/Plein-Regular.woff2') format('woff2');
          font-weight: 400; font-display: swap;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .vd-hero-img { object-fit: cover; width: 100%; height: 100%; display: block; }
        @media (max-width: 767px) {
          .vd-hero { flex-direction: column !important; min-height: auto !important; padding-top: 80px !important; }
          .vd-hero-text { max-width: 100% !important; padding: 40px 22px 32px !important; }
          .vd-hero-visual { height: 280px !important; border-radius: 0 !important; margin: 0 !important; }
          .vd-benefits-grid { grid-template-columns: 1fr !important; }
          .vd-images-scroll { flex-direction: column !important; }
          .vd-section-pad { padding: 52px 22px !important; }
          .vd-cta-inner { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>

      <NavBar />

      {/* ── HERO ── */}
      <section className="vd-hero" style={{
        display: 'flex',
        alignItems: 'stretch',
        minHeight: '70vh',
        background: '#fafafa',
        paddingTop: 72,
      }}>
        {/* Text side */}
        <div className="vd-hero-text" style={{ flex: '0 0 50%', maxWidth: 560, padding: '72px 48px 72px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {tags.map(tag => (
              <span key={tag} style={{ fontSize: 11, fontWeight: 700, color: accentColor, background: `${accentColor}18`, padding: '4px 12px', borderRadius: 100 }}>{tag}</span>
            ))}
            {tpl.isFree && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#16A34A', padding: '4px 12px', borderRadius: 100 }}>KOSTENLOS</span>
            )}
            {badge && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: badge.bg, padding: '4px 12px', borderRadius: 100 }}>{badge.label.toUpperCase()}</span>
            )}
          </div>

          <h1 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(32px, 3.5vw, 52px)',
            fontWeight: 400,
            color: '#111',
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            marginBottom: 20,
          }}>
            {tpl.title}
          </h1>

          {tpl.description && (
            <p style={{ fontSize: 16, color: '#555', lineHeight: 1.75, marginBottom: 36, maxWidth: 440 }}>
              {tpl.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="https://app.finestsites.io/register" style={{ background: '#111', color: '#fff', padding: '14px 32px', borderRadius: 100, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
              Jetzt kostenlos starten →
            </a>
            <a href="/#templates" style={{ background: '#fff', color: '#555', padding: '14px 24px', borderRadius: 100, fontSize: 14, fontWeight: 500, textDecoration: 'none', border: '1.5px solid rgba(0,0,0,0.12)' }}>
              Alle Templates
            </a>
          </div>
        </div>

        {/* Visual side */}
        <div className="vd-hero-visual" style={{ flex: 1, margin: '24px 24px 24px 0', borderRadius: 20, overflow: 'hidden', background: '#e8e4f0', position: 'relative', minHeight: 400 }}>
          {coverImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImg} alt={tpl.title} className="vd-hero-img" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" /></svg>
              <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>Vorschau folgt</span>
            </div>
          )}
          {/* domain pill overlay */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(0,0,0,0.65)', color: '#fff', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '5px 14px', fontSize: 12, fontWeight: 600 }}>
            {tpl.domain}
          </div>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="vd-section-pad" style={{ padding: '80px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Was du bekommst</p>
          <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 400, color: '#111', letterSpacing: '-0.02em', marginBottom: 48, lineHeight: 1.15 }}>
            Alles fertig. Du musst<br />nur deinen Namen eingeben.
          </h2>
          <div className="vd-benefits-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 48px' }}>
            {DEFAULT_BENEFITS.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${accentColor}18`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" dangerouslySetInnerHTML={{ __html: `<path d="M20 6L9 17l-5-5" stroke="${accentColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` }} />
                </div>
                <span style={{ fontSize: 14, color: '#444', lineHeight: 1.6 }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PREVIEW IMAGES ── */}
      {images.length > 1 && (
        <section style={{ padding: '0 0 80px', background: '#fff', overflow: 'hidden' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 40px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Vorschau</p>
            <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(24px, 2.8vw, 36px)', fontWeight: 400, color: '#111', letterSpacing: '-0.02em', marginBottom: 32, lineHeight: 1.15 }}>
              So sieht deine Seite aus.
            </h2>
          </div>
          <div className="vd-images-scroll" style={{ display: 'flex', gap: 20, paddingLeft: 40, overflowX: 'auto', paddingBottom: 8 }}>
            {images.map((src, i) => (
              <div key={i} style={{ flex: '0 0 auto', width: 320, borderRadius: 14, overflow: 'hidden', border: '1px solid #ebebeb', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${tpl.title} Vorschau ${i + 1}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── FOR WHOM ── */}
      <section className="vd-section-pad" style={{ padding: '80px 40px', background: '#F9F7FF' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Für wen?</p>
          <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 400, color: '#111', letterSpacing: '-0.02em', marginBottom: 32, lineHeight: 1.15 }}>
            Ideal für alle, die {tags.length > 0 ? tags.join(' / ') + '-Produkte' : 'Produkte'}<br />professionell präsentieren möchten.
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {['Network-Marketer', 'Quereinsteiger', 'Teamleader', 'Vollzeit & Nebenerwerb'].map(who => (
              <span key={who} style={{ background: '#fff', border: '1.5px solid #D4C5E2', borderRadius: 100, padding: '8px 18px', fontSize: 13, fontWeight: 500, color: '#444' }}>{who}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="vd-section-pad" style={{ padding: '80px 40px', background: '#111' }}>
        <div className="vd-cta-inner" style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
          <div>
            <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(26px, 3vw, 42px)', fontWeight: 400, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: 12 }}>
              Bereit, loszulegen?
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
              Kostenlos starten — in unter 5 Minuten live.
            </p>
          </div>
          <a href="https://app.finestsites.io/register" style={{ flexShrink: 0, background: '#fff', color: '#111', padding: '16px 36px', borderRadius: 100, fontSize: 15, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Jetzt starten →
          </a>
        </div>
      </section>
    </div>
  )
}
