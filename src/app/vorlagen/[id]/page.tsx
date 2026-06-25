import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import NavBar from '@/app/_components/NavBar'

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
    .from(templates).where(eq(templates.id, id)).limit(1)
  if (!tpl) return {}
  return {
    title: `${tpl.title} – Template | FinestSites`,
    description: tpl.description ?? undefined,
  }
}

export default async function TemplateDetailPage({ params }: Props) {
  const { id } = await params

  const [tpl] = await db.select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.status, 'published')))
    .limit(1)

  if (!tpl) notFound()

  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const coverImg = images[0] ?? null
  const accentColor = tpl.detailColor ?? '#8060b0'
  const tags = Array.isArray(tpl.tags) ? tpl.tags as string[] : []
  const sections = Array.isArray(tpl.detailContent) ? tpl.detailContent as DetailSection[] : []

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
        .vd-section { padding: 80px 40px; }
        .vd-section-inner { max-width: 1080px; margin: 0 auto; display: flex; align-items: center; gap: 64px; }
        .vd-section-img { flex: 0 0 55%; border-radius: 14px; overflow: hidden; }
        .vd-section-img img { width: 100%; height: auto; display: block; }
        .vd-section-text { flex: 1; }
        @media (max-width: 900px) {
          .vd-section-inner { flex-direction: column !important; gap: 32px; }
          .vd-section-img { flex: none; width: 100%; }
          .vd-section { padding: 52px 22px; }
          .vd-hero-pad { padding: 80px 22px 48px !important; }
          .vd-hero-cover { margin: 0 22px !important; border-radius: 14px !important; }
          .vd-cta-inner { flex-direction: column !important; align-items: flex-start !important; }
          .vd-cta-pad { padding: 56px 22px !important; }
        }
      `}</style>

      <NavBar />

      {/* ── HERO ── */}
      <section style={{ paddingTop: 100, paddingBottom: 0, background: '#fff' }}>
        <div className="vd-hero-pad" style={{ maxWidth: 1080, margin: '0 auto', padding: '64px 40px 56px' }}>
          {/* Back link */}
          <Link href="/#templates" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999', textDecoration: 'none', marginBottom: 36 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Alle Templates
          </Link>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize: 11, fontWeight: 700, color: accentColor, background: `${accentColor}18`, padding: '4px 12px', borderRadius: 100, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 400,
            color: '#111',
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            maxWidth: 780,
            marginBottom: tpl.description ? 24 : 40,
          }}>
            {tpl.title}
          </h1>

          {tpl.description && (
            <p style={{ fontSize: 17, color: '#666', lineHeight: 1.7, maxWidth: 560, marginBottom: 40 }}>
              {tpl.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="https://app.finestsites.io/register" style={{ background: '#111', color: '#fff', padding: '14px 32px', borderRadius: 100, fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Jetzt starten →
            </a>
          </div>
        </div>

        {/* Cover image */}
        {coverImg && (
          <div className="vd-hero-cover" style={{ maxWidth: 1080, margin: '0 auto 0', padding: '0 40px 0' }}>
            <div style={{ borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 48px rgba(0,0,0,0.12)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImg} alt={tpl.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          </div>
        )}
      </section>

      {/* ── CONTENT SECTIONS ── */}
      {sections.length > 0 && sections.map((section, i) => {
        const isLeft = section.imagePosition === 'left'
        const bg = i % 2 === 0 ? '#fff' : '#fafafa'

        return (
          <section key={section.id ?? i} className="vd-section" style={{ background: bg }}>
            <div
              className="vd-section-inner"
              style={{ flexDirection: isLeft ? 'row' : 'row-reverse' }}
            >
              {/* Image */}
              {section.imageUrl && (
                <div className="vd-section-img" style={{ background: `${accentColor}14` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={section.imageUrl} alt={section.heading} />
                </div>
              )}

              {/* Text */}
              <div className="vd-section-text">
                <p style={{ fontSize: 11, fontWeight: 700, color: accentColor, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h2 style={{
                  fontFamily: '"Plein", sans-serif',
                  fontSize: 'clamp(26px, 3vw, 40px)',
                  fontWeight: 400,
                  color: '#111',
                  lineHeight: 1.15,
                  letterSpacing: '-0.025em',
                  marginBottom: 20,
                }}>
                  {section.heading}
                </h2>
                {section.text && (
                  <p style={{ fontSize: 16, color: '#555', lineHeight: 1.8 }}>
                    {section.text}
                  </p>
                )}
              </div>
            </div>
          </section>
        )
      })}

      {/* Divider before CTA */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.07)' }} />

      {/* ── FINAL CTA ── */}
      <section className="vd-cta-pad" style={{ padding: '80px 40px', background: '#111' }}>
        <div className="vd-cta-inner" style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
          <div>
            <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(28px, 3.5vw, 46px)', fontWeight: 400, color: '#fff', lineHeight: 1.12, letterSpacing: '-0.025em', marginBottom: 12 }}>
              Bereit, loszulegen?
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              Ab €20/Monat — in unter 5 Minuten live.
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
