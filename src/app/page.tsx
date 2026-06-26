import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { templates, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import PricingSection from './_components/PricingSection'
import FeatureCardsAnimated from './_components/FeatureCardsAnimated'
import NavBar from './_components/NavBar'
import HowItWorks from './_components/HowItWorks'
import TemplateGridSection, { type TemplateCardData } from './_components/TemplateGridSection'

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
        previewImages: templates.previewImages,
      })
      .from(templates)
      .where(and(eq(templates.status, 'published'), eq(templates.isTest, false)))
      .orderBy(templates.createdAt)
    templateList = rows.map(r => ({ ...r, tags: (r.tags as string[] | null) ?? [] }))
    console.log('[HomePage] templates fetched:', templateList.length)
  } catch (err) {
    console.error('[HomePage] templates fetch error:', err)
  }

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>

      {/* ── Fonts ─────────────────────────────────────────────────────── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" />
      <style>{`
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
        .fs-hero-content { position: relative; z-index: 2; padding: 130px 7vw 90px; max-width: 56vw; }
        .fs-section-pad { padding: 96px 7vw; }
        .fs-was-ist-inner { max-width: 1060px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
        .fs-feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .fs-template-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
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

          .fs-section-pad { padding: 52px 22px; }
          .fs-was-ist-inner { grid-template-columns: 1fr; gap: 36px; }
          .fs-feature-grid { gap: 10px; }
          .fs-template-grid { grid-template-columns: 1fr 1fr; gap: 14px; }
          .fs-template-grid > * { min-width: 0; }
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
            fontSize: 'clamp(36px, 4.4vw, 62px)',
            fontWeight: 400,
            color: '#111',
            lineHeight: 1.08,
            letterSpacing: '-0.028em',
            marginBottom: 28,
          }}>
            Lass dich von Kunden und<br />Partnern über deine<br />Webseite finden.
          </h1>
          <p style={{ fontSize: 16, color: '#555', lineHeight: 1.75, marginBottom: 40, maxWidth: 460 }}>
            Überzeuge Interessenten von deinen Produkten und deiner Geschäftsmöglichkeit, noch bevor sie mit dir gesprochen haben. Erhalte Anfragen und lass dein Network Marketing Business wachsen.
          </p>
          <div className="fs-hero-buttons">
            <a href="https://app.finestsites.io/register" style={{ background: '#111', color: '#fff', padding: '15px 36px', borderRadius: 100, fontSize: 15, fontWeight: 600, display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>Jetzt starten</a>
            <a href="#templates" style={{ background: 'rgba(255,255,255,0.8)', color: '#111', padding: '15px 36px', borderRadius: 100, fontSize: 15, fontWeight: 500, display: 'inline-block', border: '1.5px solid rgba(0,0,0,0.12)', textDecoration: 'none', textAlign: 'center' }}>Templates ansehen</a>
          </div>
        </div>
      </section>

      {/* ══ WAS IST FINESTSITES ══════════════════════════════════════════ */}
      <section id="was-ist" style={{ background: '#fff' }} className="fs-section-pad">
        <div className="fs-was-ist-inner">
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Das Problem</p>
            <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 24 }}>
              <span style={{ color: '#111' }}>Du hast ein tolles Produkt.</span><br />
              <span style={{ color: '#8060b0' }}>Aber niemand weiss davon.</span>
            </h2>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, marginBottom: 20 }}>
              Die meisten Network-Marketer kämpfen täglich darum, neue Interessenten zu finden. Du postest, chattest, rufst an und trotzdem bleibt der Durchbruch aus.
            </p>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75 }}>
              <strong style={{ color: '#111' }}>FinestSites ändert das.</strong> Du bekommst eine professionelle Produktwebsite, die für dich arbeitet. 24/7, auch wenn du schläfst.
            </p>
          </div>

          {/* 2×2 feature grid — animated with GSAP */}
          <FeatureCardsAnimated />
        </div>
      </section>

      <HowItWorks />

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
              Wähle dein Template.
            </h2>
            <p style={{ textAlign: 'center', fontSize: 16, color: '#777', maxWidth: 500, margin: '0 auto' }}>
              Jedes Template wurde speziell für ein Network-Marketing-Unternehmen entwickelt — fertige Texte, fertige Designs.
            </p>
          </div>

          {templateList.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '60px 0' }}>Templates folgen in Kürze.</p>
          ) : (
            <TemplateGridSection templates={templateList} />
          )}
        </div>
      </section>

      <PricingSection validatedRef={validatedRef} />

      {/* ══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="fs-footer-dark">
        {/* ── Main grid ─── */}
        <div className="fs-footer-grid">
          {/* Brand column */}
          <div className="fs-footer-brand">
            <img src="/logos/logo-black.svg" alt="FinestSites" style={{ height: 22, display: 'block', filter: 'brightness(0) invert(1)', opacity: 0.85, marginBottom: 16 }} />
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: 28, maxWidth: 260 }}>
              Professionelle Websites für Network-Marketing-Profis. In 5 Minuten live.
            </p>
            <a href="https://app.finestsites.io/register" style={{ display: 'inline-block', background: '#D4C5E2', color: '#2d1a50', fontSize: 13, fontWeight: 700, padding: '11px 24px', borderRadius: 100 }}>
              Jetzt starten →
            </a>
          </div>

          {/* Produkt column */}
          <div>
            <h5 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>Produkt</h5>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Templates ansehen', href: '#templates' },
                { label: 'Preise',            href: '#preise' },
                { label: 'Anmelden',          href: 'https://app.finestsites.io/login' },
                { label: 'Konto erstellen',   href: 'https://app.finestsites.io/register' },
              ].map(l => (
                <li key={l.label}><a href={l.href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>{l.label}</a></li>
              ))}
            </ul>
          </div>

          {/* Rechtliches column */}
          <div>
            <h5 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>Rechtliches</h5>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Impressum',             href: '/impressum' },
                { label: 'Datenschutzerklärung',  href: '/datenschutz' },
                { label: 'AGB',                   href: '/agb' },
              ].map(l => (
                <li key={l.label}><a href={l.href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>{l.label}</a></li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Bottom bar ─── */}
        <div className="fs-footer-bottom">
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>© 2026 FinestSites · Alle Rechte vorbehalten</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>Zahlungsarten</span>
            {[
              { src: '/payment/visa.svg',       alt: 'Visa' },
              { src: '/payment/mastercard.svg', alt: 'Mastercard' },
              { src: '/payment/amex.svg',       alt: 'American Express' },
              { src: '/payment/sepa.svg',       alt: 'SEPA' },
            ].map(p => (
              <div key={p.alt} style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 40,
                minWidth: 56,
              }}>
                <img src={p.src} alt={p.alt} style={{ height: 22, filter: 'brightness(0) invert(1)', opacity: 0.75 }} />
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
