import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'
import TemplateStartCTA from '@/components/TemplateStartCTA'

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

// Icons for placeholder sections
const SECTION_ICONS = [
  // Rocket
  <svg key="0" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2l9-9a3.5 3.5 0 00-5-5l-7 7z"/><path d="M12 15l-3-3"/></svg>,
  // Link
  <svg key="1" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  // Inbox
  <svg key="2" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>,
  // TrendingUp
  <svg key="3" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
]

export default async function TemplateDetailPage({ params }: Props) {
  const { id } = await params

  const [tpl] = await db.select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.status, 'published')))
    .limit(1)

  if (!tpl) notFound()

  // Fetch up to 3 other published templates for "Weitere Templates"
  const otherTemplates = await db.select({
    id: templates.id,
    title: templates.title,
    description: templates.description,
    previewImages: templates.previewImages,
    tags: templates.tags,
    detailColor: templates.detailColor,
  })
    .from(templates)
    .where(and(eq(templates.status, 'published'), ne(templates.id, id)))
    .limit(3)

  const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
  const coverImg = images[0] ?? null
  const accentColor = tpl.detailColor ?? '#8060b0'
  const accentBg = `${accentColor}12`
  const tags = Array.isArray(tpl.tags) ? tpl.tags as string[] : []
  const dbSections = Array.isArray(tpl.detailContent) ? tpl.detailContent as DetailSection[] : []

  // Use DB sections if available, pad/replace with defaults
  const sections: DetailSection[] = dbSections.length >= 4
    ? dbSections.slice(0, 4)
    : DEFAULT_SECTIONS.map((def, i) => dbSections[i] ?? def)

  const registerUrl = `https://app.finestsites.io/register?template=${tpl.id}&tname=${encodeURIComponent(tpl.title)}`

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
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
          src: url('/fonts/Plein-Regular.woff2') format('woff2');
          font-weight: 400; font-display: swap;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        section[id] { scroll-margin-top: 90px; }

        /* Nav */
        .fs-nav-links { display: flex; gap: 28px; align-items: center; }
        .fs-nav-actions { display: flex; gap: 8px; align-items: center; }
        .fs-hamburger { display: none !important; }

        /* Template detail layout */
        .vd-hero { padding: 108px 7vw 72px; }
        .vd-feature-row { padding: 88px 7vw; }
        .vd-feature-inner { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .vd-feature-inner.reverse { direction: rtl; }
        .vd-feature-inner.reverse > * { direction: ltr; }
        .vd-feature-img { border-radius: 20px; overflow: hidden; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center; }
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
          .vd-hero { padding: 96px 22px 56px; }
          .vd-feature-row { padding: 56px 22px; }
          .vd-feature-inner { grid-template-columns: 1fr; gap: 36px; }
          .vd-feature-inner.reverse { direction: ltr; }
          .vd-more-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 479px) {
          .vd-more-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <NavBar primaryCta={{ label: 'Template freischalten', href: registerUrl }} />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="vd-hero" style={{ background: '#fff' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>

          {/* Back link */}
          <Link href="/#templates" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999', textDecoration: 'none', marginBottom: 32, fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Alle Templates
          </Link>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize: 11, fontWeight: 700, color: accentColor, background: accentBg, padding: '4px 12px', borderRadius: 100, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Title + description + CTA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 48, alignItems: 'flex-end' }}>
            <div>
              <h1 style={{
                fontFamily: '"Plein", sans-serif',
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
            <div style={{ flexShrink: 0, paddingBottom: 4 }}>
              <TemplateStartCTA templateId={tpl.id} templateTitle={tpl.title} />
            </div>
          </div>
        </div>

        {/* Cover image — full width within max-width */}
        {coverImg && (
          <div style={{ maxWidth: 1080, margin: '52px auto 0', borderRadius: 24, overflow: 'hidden', boxShadow: '0 16px 64px rgba(0,0,0,0.10)', border: '1px solid rgba(0,0,0,0.06)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImg} alt={tpl.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        )}
      </section>

      {/* ── 4 ALTERNATING FEATURE SECTIONS ───────────────────────────── */}
      {sections.map((section, i) => {
        const isReverse = section.imagePosition === 'right'
        const sectionImg = section.imageUrl || images[i + 1] || null
        const isDark = i % 2 !== 0
        const bg = isDark ? '#F9F7FF' : '#fff'
        const textColor = '#555'
        const headingColor = '#111'
        const numColor = accentColor
        const num = String(i + 1).padStart(2, '0')

        return (
          <section key={i} className="vd-feature-row" style={{ background: bg }}>
            <div className={`vd-feature-inner${isReverse ? ' reverse' : ''}`}>

              {/* Image / Placeholder */}
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

              {/* Text */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: numColor, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
                  {num}
                </p>
                <h2 style={{
                  fontFamily: '"Plein", sans-serif',
                  fontSize: 'clamp(24px, 2.8vw, 38px)',
                  fontWeight: 400,
                  color: headingColor,
                  lineHeight: 1.15,
                  letterSpacing: '-0.025em',
                  marginBottom: 20,
                }}>
                  {section.heading}
                </h2>
                <p style={{ fontSize: 16, color: textColor, lineHeight: 1.8 }}>
                  {section.text}
                </p>
              </div>
            </div>
          </section>
        )
      })}

      {/* ── WEITERE TEMPLATES ────────────────────────────────────────── */}
      {otherTemplates.length > 0 && (
        <section style={{ background: '#111', padding: '88px 7vw' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Mehr entdecken</p>
            <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(26px, 3vw, 40px)', fontWeight: 400, color: '#fff', letterSpacing: '-0.02em', marginBottom: 44 }}>
              Weitere Templates
            </h2>

            <div className="vd-more-grid">
              {otherTemplates.map(t => {
                const tImgs = Array.isArray(t.previewImages) ? t.previewImages as string[] : []
                const tColor = t.detailColor ?? '#8060b0'
                const tTags = Array.isArray(t.tags) ? t.tags as string[] : []
                return (
                  <a
                    key={t.id}
                    href={`/vorlagen/${t.id}`}
                    className="vd-more-card"
                  >
                    {/* Cover */}
                    <div style={{ aspectRatio: '16/9', background: `${tColor}22`, overflow: 'hidden' }}>
                      {tImgs[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tImgs[0]} alt={t.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${tColor}33, ${tColor}11)` }} />
                      )}
                    </div>
                    {/* Info */}
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

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section style={{ background: '#111', padding: '96px 7vw' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 32 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20 }}>Los geht&apos;s</p>
            <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(28px, 3.8vw, 52px)', fontWeight: 400, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: 16 }}>
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
