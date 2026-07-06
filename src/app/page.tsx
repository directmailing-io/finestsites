import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { templates, users } from '@/lib/db/schema'
import { eq, and, inArray, asc, sql } from 'drizzle-orm'
import PricingSection from './_components/PricingSection'
import FeatureCardsAnimated from './_components/FeatureCardsAnimated'
import ProblemSection from './_components/ProblemSection'
import NavBar from './_components/NavBar'
import VorlagenSection from './_components/VorlagenSection'
import HowItWorks from './_components/HowItWorks'
import TemplateGridSection, { type TemplateCardData } from './_components/TemplateGridSection'
import { Suspense } from 'react'
import FAQSection from './_components/FAQSection'
import WaitlistSection from './_components/WaitlistSection'
import Footer from './_components/Footer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'FinestSites – Deine professionelle Website in Minuten',
  description: 'Professionelle Produktwebsite für Network-Marketing-Profis. In unter 5 Minuten live. Keine Technik, keine Agentur.',
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  // Validate ?ref= against DB — never trust client-supplied codes without checking
  const params = await searchParams
  const refParam = params.ref?.trim().toLowerCase() ?? ''
  let validatedRef: string | null = null
  if (refParam) {
    try {
      const referrer = await db.query.users.findFirst({
        where: eq(users.username, refParam),
        columns: { username: true },
      })
      validatedRef = referrer?.username ?? null
    } catch {
      // DB error: fail safe — no discount shown
    }
  }

  // Fetch published templates with new marketing fields
  let templateList: TemplateCardData[] = []
  try {
    const rows = await db
      .select({
        id: templates.id,
        title: templates.title,
        description: templates.description,
        domain: templates.domain,
        isFree: templates.isFree,
        badge: templates.badge,
        tags: templates.tags,
        nmCompanies: templates.nmCompanies,
        isAllrounder: templates.isAllrounder,
        previewImages: templates.previewImages,
        status: templates.status,
      })
      .from(templates)
      .where(and(inArray(templates.status, ['published', 'coming_soon']), eq(templates.isTest, false)))
      .orderBy(asc(sql`COALESCE(${templates.sortOrder}, 100)`), asc(templates.createdAt))
    templateList = rows.map(r => ({
      ...r,
      tags: (r.tags as string[] | null) ?? [],
      nmCompanies: (r.nmCompanies as string[] | null) ?? [],
      isAllrounder: r.isAllrounder ?? false,
      isComingSoon: r.status === 'coming_soon',
    }))
    console.log('[HomePage] templates fetched:', templateList.length)
  } catch (err) {
    console.error('[HomePage] templates fetch error:', err)
  }

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>

      {/* ── Fonts ─────────────────────────────────────────────────────── */}
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
          font-weight: 400;
          font-display: swap;
        }
        @font-face {
          font-family: 'Plein';
          src: url('/fonts/Plein-Medium.otf') format('opentype');
          font-weight: 500;
          font-display: swap;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        a { text-decoration: none; }
        section[id] { scroll-margin-top: 90px; }

        /* ── Layout helpers ───────────────────────────────── */
        .fs-nav-links { display: flex; gap: 28px; align-items: center; }
        .fs-nav-actions { display: flex; gap: 8px; align-items: center; }
        .fs-hamburger { display: none !important; }
        .fs-hero-buttons { display: flex; gap: 12px; flex-wrap: wrap; }
        .fs-hero-subtext { font-size: 12px; color: #aaa; margin-top: 14px; }
        .fs-hero-content { position: relative; z-index: 2; padding: 130px 0 90px 7vw; max-width: 58vw; }
        .fs-section-pad { padding: 96px 7vw; }
        .fs-was-ist-inner { max-width: 1060px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
        .fs-feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .fs-prob-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .fs-solution-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .fs-solution-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .fs-solution-card { display: flex; align-items: flex-start; gap: 16px; border-radius: 20px; padding: 22px; }
        .fs-solution-bg { position: absolute; bottom: 0; left: 0; right: 0; height: 400px; }
        .fs-solution-bg img { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; }
        .fs-solution-bg-fade { position: absolute; top: 0; left: 0; right: 0; height: 40%; background: linear-gradient(to bottom, #fff 0%, transparent 100%); }
        .fs-template-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .fs-type-explain { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 720px; margin: 0 auto 44px; }
        .fs-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .fs-pricing-banner-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; align-items: stretch; }
        /* ── Hero mobile image ───────────────────────────── */
        .fs-hero-mobile-img { display: none; }

        /* ── How it works grid ───────────────────────────── */
        .fs-how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }
        .fs-how-connector { display: block; }

        /* ── Dark footer ─────────────────────────────────── */
        .fs-footer-dark { background: #1a1530; color: #fff; padding: 64px 7vw 0; }
        .fs-footer-grid { max-width: 1060px; margin: 0 auto; display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 56px; padding-bottom: 56px; }
        .fs-footer-brand {}
        .fs-footer-bottom { max-width: 1060px; margin: 0 auto; padding: 24px 0 32px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }

        /* ── Tablet (768–1023 px) ─────────────────────────── */
        @media (max-width: 1023px) {
          .fs-hero-content { max-width: 75vw; padding: 120px 5vw 72px; }
          .fs-section-pad { padding: 72px 5vw; }
          .fs-template-grid { grid-template-columns: repeat(2, 1fr); }
          .fs-pricing-grid { grid-template-columns: 1fr; max-width: 440px; margin-left: auto; margin-right: auto; }
          .fs-pricing-mascot { display: none !important; }
          .fs-prob-grid { grid-template-columns: 1fr; max-width: 500px; margin-left: auto; margin-right: auto; }
          .fs-solution-grid { grid-template-columns: 1fr; }
          .fs-solution-cards { grid-template-columns: 1fr 1fr; }
          .fs-solution-bg { height: 300px; }
        }

        /* ── Mobile (< 768 px) ───────────────────────────── */
        @media (max-width: 767px) {
          .fs-nav-links { display: none; }
          .fs-nav-actions { display: none !important; }
          .fs-hamburger { display: flex !important; }
          .fs-hero-buttons { flex-direction: column; }

          /* Hero: stack image on top, then content */
          .fs-hero-section {
            flex-direction: column !important;
            align-items: stretch !important;
            min-height: 0 !important;
          }
          .fs-hero-bg { display: none; }
          .fs-hero-gradient { display: none; }
          .fs-hero-mobile-img {
            display: block;
            width: 100%;
            height: 62vw;
            max-height: 300px;
            background-image: url(/hero-bg.png);
            background-size: cover;
            background-position: center top;
            position: relative;
            flex-shrink: 0;
            margin-top: 60px; /* clear fixed nav */
          }
          .fs-hero-mobile-img::after {
            content: '';
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 65%;
            background: linear-gradient(to bottom, transparent, #f5f3f0);
          }
          .fs-hero-content { max-width: 100%; padding: 12px 22px 52px; }
          .fs-hero-subtext { text-align: center; }

          .fs-section-pad { padding: 52px 22px; }
          .fs-was-ist-inner { grid-template-columns: 1fr; gap: 36px; }
          .fs-feature-grid { gap: 10px; }
          .fs-prob-grid { grid-template-columns: 1fr; max-width: 100%; }
          .fs-solution-grid { grid-template-columns: 1fr; }
          .fs-solution-card { flex-direction: column; align-items: center; text-align: center; }
          .fs-solution-cards { grid-template-columns: 1fr; }
          .fs-solution-bg { height: 220px; }
          .fs-template-grid { grid-template-columns: 1fr 1fr; gap: 14px; }
          .fs-template-grid > * { min-width: 0; }
          .fs-type-explain { grid-template-columns: 1fr; max-width: 100%; }
          .fs-pricing-grid { max-width: 100%; }
          .fs-how-grid { grid-template-columns: 1fr; gap: 48px; }
          .fs-how-connector { display: none; }

          /* Pricing banner: image on top, text below */
          .fs-pricing-banner-grid { display: flex; flex-direction: column; }
          .fs-pricing-banner-img {
            display: block !important;
            order: -1;
            min-height: 220px;
            border-radius: 24px 24px 0 0;
          }

          .fs-pricing-mascot { display: none !important; }
.fs-footer-dark { padding: 48px 22px 0; }
          .fs-footer-grid { grid-template-columns: 1fr; gap: 36px; padding-bottom: 40px; }
          .fs-footer-bottom { flex-direction: column; align-items: flex-start; gap: 12px; }
        }

        /* ── Small mobile (< 480 px) ─────────────────────── */
        @media (max-width: 479px) {
          .fs-feature-grid { grid-template-columns: 1fr; }
          .fs-template-grid { grid-template-columns: 1fr; }
        }

        /* ── PM-Produkte grid ────────────────────────────── */
        @media (max-width: 1023px) {
          .fs-pm-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ══ NAV ══════════════════════════════════════════════════════════ */}
      <NavBar />

      {/* ══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="fs-hero-section" style={{
        width: '100%',
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: '#f5f3f0',
      }}>
        {/* Desktop background image + gradient (hidden on mobile) */}
        <div className="fs-hero-bg" style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/hero-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
        }} />
        <div className="fs-hero-gradient" style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, #ffffff 30%, rgba(255,255,255,0.88) 42%, rgba(255,255,255,0.2) 58%, rgba(255,255,255,0) 70%)',
        }} />

        {/* Mobile-only: full-width hero image at top with bottom fade */}
        <div className="fs-hero-mobile-img" />

        <div className="fs-hero-content">
          <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>
            Für Network-Marketer
          </p>
          <h1 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(26px, 2.6vw, 42px)',
            fontWeight: 400,
            color: '#111',
            lineHeight: 1.1,
            letterSpacing: '-0.028em',
            marginBottom: 28,
          }}>
            Deine Network-Marketing Website.<br /><span style={{ color: '#8060b0' }}>Live in 10 Minuten.</span><br />Ohne Agentur, ohne Technik-Stress.
          </h1>
          <p style={{ fontSize: 16, color: '#555', lineHeight: 1.75, marginBottom: 28, maxWidth: 460 }}>
            Lass dich von Kunden und Partnern über deine Webseite finden und überzeuge Interessenten von deinen Produkten, noch bevor sie mit dir gesprochen haben.
          </p>
          <div className="fs-hero-buttons">
            <a href="https://app.finestsites.io/register" style={{ background: '#111', color: '#fff', padding: '15px 36px', borderRadius: 100, fontSize: 15, fontWeight: 600, display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>Jetzt starten</a>
            <a href="#templates" style={{ background: 'rgba(255,255,255,0.8)', color: '#111', padding: '15px 36px', borderRadius: 100, fontSize: 15, fontWeight: 500, display: 'inline-block', border: '1.5px solid rgba(0,0,0,0.12)', textDecoration: 'none', textAlign: 'center' }}>Templates ansehen</a>
          </div>
        </div>
      </section>

      {/* ══ DAS PROBLEM ══════════════════════════════════════════════════ */}
      <ProblemSection />

      {/* ══ WAS FINESTSITES BIETET ═══════════════════════════════════════ */}
      <section id="was-ist" style={{ background: '#fff' }} className="fs-section-pad">
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 18 }}>Die Lösung</p>
            <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.15, color: '#111', margin: '0 auto', maxWidth: 600 }}>
              Einmal einrichten. Immer gefunden werden.
            </h2>
            <p style={{ fontSize: 16, color: '#888', maxWidth: 480, margin: '16px auto 0' }}>
              Du kümmerst dich ums Netzwerk. Den Rest übernehmen wir.
            </p>
          </div>

          <div className="fs-solution-cards">
            {([
              { label: 'Schnell',  title: 'In unter 10 Minuten live',          desc: 'Template wählen, deinen Namen eintragen, ein Foto hochladen. Fertig. Kein Designer, kein Entwickler, kein Stress.' },
              { label: 'Einfach', title: 'Texte und Design sind fertig',         desc: 'Du schreibst nichts, du gestaltest nichts. Alles ist bereits drin. Professionell getextet, getestet und für dein Produkt optimiert.' },
              { label: 'Sicher',  title: 'Um den Rest kümmerst du dich nie',     desc: 'Hosting, SSL, DSGVO, Impressum, Barrierefreiheit. Alles läuft automatisch. Du musst dich damit nie beschäftigen.' },
            ] as { label: string; title: string; desc: string }[]).map((f, i) => (
              <div key={i} style={{
                background: '#fff',
                border: '1px solid #F3F4F6',
                borderRadius: 20,
                padding: 32,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{f.label}</span>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111', lineHeight: 1.3, margin: 0 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <a
              href="https://app.finestsites.io/register"
              style={{ display: 'inline-block', background: '#111', color: '#fff', padding: '14px 32px', borderRadius: 100, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}
            >
              Jetzt starten
            </a>
            <p style={{ fontSize: 12, color: '#555', marginTop: 10, fontWeight: 500 }}>Günstiger als ein Brötchen am Tag · Jederzeit kündbar</p>
          </div>
        </div>
      </section>

      <HowItWorks />

      {/* ══ FÜR DEIN UNTERNEHMEN ═════════════════════════════════════════ */}
      <VorlagenSection />

{/* ══ TEMPLATES ════════════════════════════════════════════════════ */}
      <section id="templates" style={{ background: '#F9F7FF' }} className="fs-section-pad">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mascot.png" alt="" style={{ height: 100, width: 'auto', display: 'block' }} />
            </div>
            <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(30px, 4vw, 52px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', textAlign: 'center', marginBottom: 16, lineHeight: 1.1 }}>
              Diese Templates stehen dir zur Verfügung.
            </h2>
            <p style={{ textAlign: 'center', fontSize: 16, color: '#777', maxWidth: 440, margin: '0 auto' }}>
              Fertige Designs. Fertige Texte. Deine Daten eintragen, live gehen.
            </p>
          </div>

          {/* Premium vs Standard explanation */}
          <div className="fs-type-explain">
            <div style={{
              background: 'linear-gradient(135deg, #F0E8FF 0%, #E6D4FF 100%)',
              border: '1.5px solid #D4B8F8',
              borderRadius: 18,
              padding: '20px 24px',
            }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#7C3AED', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                Premium-Seiten
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#3B0764', margin: '0 0 6px', lineHeight: 1.3 }}>
                Speziell für dein Unternehmen
              </p>
              <p style={{ fontSize: 13, color: '#6D28D9', lineHeight: 1.65, margin: 0 }}>
                Produkt-Seiten für FitLine, Thermomix und Co. Fertige Texte und Designs, die genau zu deinem Produkt passen.
              </p>
            </div>
            <div style={{
              background: '#F7F7F9',
              border: '1px solid #E5E7EB',
              borderRadius: 18,
              padding: '20px 24px',
            }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                Standard-Seiten
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 6px', lineHeight: 1.3 }}>
                Unterstützende Seiten
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.65, margin: 0 }}>
                Event-Einladungen für Infoabende und Teamevents. Oder eine Link-in-Bio als persönliche Übersichtsseite für deine Bio.
              </p>
            </div>
          </div>

          <TemplateGridSection templates={templateList} />

          {/* Coming soon note */}
          {templateList.some(t => t.isComingSoon) && (
            <p style={{ textAlign: 'center', fontSize: 13, color: '#bbb', marginTop: 32 }}>
              Weitere Vorlagen für Vorwerk, LR Health &amp; Beauty, Herbalife, Nu Skin und mehr folgen in Kürze.
            </p>
          )}

          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link
              href="/vorlagen"
              style={{ display: 'inline-block', background: '#fff', color: '#111', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 100, padding: '13px 36px', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}
            >
              Alle Vorlagen ansehen →
            </Link>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <WaitlistSection />
      </Suspense>

      <PricingSection validatedRef={validatedRef} />

      {/* ══ FAQ ══════════════════════════════════════════════════════════ */}
      <FAQSection />

      <Footer />
    </div>
  )
}
