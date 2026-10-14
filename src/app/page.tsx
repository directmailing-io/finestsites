import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { templates, users } from '@/lib/db/schema'
import { eq, and, inArray, asc, sql } from 'drizzle-orm'
import PricingSection from './_components/PricingSection'
import FeatureCardsAnimated from './_components/FeatureCardsAnimated'
import ProblemSection from './_components/ProblemSection'
import NavBar from './_components/NavBar'
import HeroSection from './_components/HeroSection'
import VorlagenSection from './_components/VorlagenSection'
import HowItWorks from './_components/HowItWorks'
import ClaimGuardSection from './_components/ClaimGuardSection'
import TemplateGridSection, { type TemplateCardData } from './_components/TemplateGridSection'
import { Suspense } from 'react'
import FAQSection from './_components/FAQSection'
import WaitlistToast from './_components/WaitlistToast'
import Footer from './_components/Footer'
import { getActiveCampaign, toPublicCampaign } from '@/lib/billing/campaign'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'FinestSites – Deine professionelle Website in Minuten',
  description: 'Professionelle Produktwebsite für Network-Marketing-Profis. In unter 3 Minuten live. Keine Technik, keine Agentur.',
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

  // Site-wide campaign (e.g. INNERVISIONDAY). Partner-link visitors keep the partner discount instead.
  const campaign = validatedRef ? null : toPublicCampaign(await getActiveCampaign())

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
      .where(and(eq(templates.status, 'published'), eq(templates.isTest, false), eq(templates.isAllrounder, false)))
      .orderBy(asc(sql`COALESCE(${templates.sortOrder}, 100)`), asc(templates.createdAt))
    templateList = rows.map(r => ({
      ...r,
      tags: (r.tags as string[] | null) ?? [],
      nmCompanies: [], // Firmen-Zuordnung bleibt serverseitig (keine Markennennung im Marketing)
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
        .fs-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .fs-pricing-banner-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; align-items: stretch; }
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
          .fs-section-pad { padding: 72px 5vw; }
          .fs-template-grid { grid-template-columns: repeat(2, 1fr); }
          .fs-pricing-grid { grid-template-columns: 1fr; max-width: 440px; margin-left: auto; margin-right: auto; }
          .fs-pricing-mascot { display: none !important; }
          .fs-prob-grid { grid-template-columns: 1fr; max-width: 500px; margin-left: auto; margin-right: auto; }
          .fs-solution-grid { grid-template-columns: 1fr; }
          .fs-solution-cards { grid-template-columns: repeat(3, 1fr); gap: 14px; }
          .fs-solution-tile { padding: 24px 20px !important; }
          .fs-solution-bg { height: 300px; }
          .fs-how-grid { grid-template-columns: 1fr; gap: 40px; max-width: 560px; margin-left: auto; margin-right: auto; }
        }

        /* ── Mobile (< 768 px) ───────────────────────────── */
        @media (max-width: 767px) {
          .fs-nav-links { display: none; }
          .fs-nav-actions { display: none !important; }
          .fs-hamburger { display: flex !important; }
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
          .fs-pricing-grid { max-width: 100%; }
          .fs-how-grid { grid-template-columns: 1fr; gap: 40px; max-width: 100%; }
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
          .fs-footer-grid { grid-template-columns: minmax(0, 1fr); gap: 36px; padding-bottom: 40px; }
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
      <NavBar campaign={campaign} />

      {/* ══ HERO ═════════════════════════════════════════════════════════ */}
      <HeroSection registerHref={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'}/register${validatedRef ? `?ref=${validatedRef}` : ''}`} />

      {/* ══ DAS PROBLEM ══════════════════════════════════════════════════ */}
      <ProblemSection />

      {/* ══ WAS FINESTSITES BIETET ═══════════════════════════════════════ */}
      <section id="was-ist" style={{ background: 'radial-gradient(ellipse 90% 60% at 50% 100%, rgba(128,96,176,0.09) 0%, #fff 70%)' }} className="fs-section-pad">
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#8060b0', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18, background: '#F5F0FB', border: '1px solid #E8E0F5', borderRadius: 100, padding: '6px 14px' }}>Die Lösung</span>
            <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.15, color: '#111', margin: '0 auto', maxWidth: 600 }}>
              Einmal einrichten. Immer gefunden werden.
            </h2>
            <p style={{ fontSize: 16, color: '#888', maxWidth: 480, margin: '16px auto 0' }}>
              Du kümmerst dich ums Netzwerk. Den Rest übernehmen wir.
            </p>
          </div>

          <div className="fs-solution-cards">
            {([
              { label: 'Schnell',  title: 'In 3 Minuten online',          desc: 'Vorlage wählen, Namen eintragen, Foto hochladen. Fertig.', tint: '#FFF4E5', ink: '#D97706',
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg> },
              { label: 'Einfach', title: 'Texte und Design sind fertig', desc: 'Du schreibst nichts und gestaltest nichts. Alles ist schon drin.', tint: '#F3EDFB', ink: '#8060b0',
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8060b0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg> },
              { label: 'Sicher',  title: 'Um den Rest kümmern wir uns', desc: 'Hosting, Impressum, Datenschutz, ClaimGuard. Läuft alles automatisch.', tint: '#E8F7EE', ink: '#16A34A',
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg> },
            ] as { label: string; title: string; desc: string; tint: string; ink: string; icon: React.ReactNode }[]).map((f, i) => (
              <div key={i} className="fs-solution-tile" style={{
                background: 'linear-gradient(180deg, #fff 0%, #FBFAFD 100%)',
                border: '1px solid #ECE8F3',
                borderRadius: 22,
                padding: '30px 28px',
                boxShadow: '0 10px 30px rgba(128,96,176,0.08), 0 1px 0 rgba(255,255,255,0.8) inset',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 50, height: 50, borderRadius: 15, background: f.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.icon}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: f.ink, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{f.label}</span>
                </div>
                <h3 style={{ fontSize: 19, fontWeight: 700, color: '#111', lineHeight: 1.3, margin: '6px 0 0' }}>{f.title}</h3>
                <p style={{ fontSize: 15, color: '#666', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <a
              href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'}/register${validatedRef ? `?ref=${validatedRef}` : ''}`}
              style={{ display: 'inline-block', background: '#111', color: '#fff', padding: '14px 32px', borderRadius: 100, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}
            >
              Kostenlos starten
            </a>
            <p style={{ fontSize: 12, color: '#555', marginTop: 10, fontWeight: 500 }}>Kostenlos bearbeiten. Erst zahlen wenn du live gehst.</p>
          </div>
        </div>
      </section>

      <HowItWorks />

      {/* ══ CLAIMGUARD (KI-Prüfung) ══════════════════════════════════════ */}
      <ClaimGuardSection />

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

          <TemplateGridSection templates={templateList} />
        </div>
      </section>

      {/* Rückmeldung für Bestätigungs-/Abmeldelinks aus bereits verschickten Insider-Mails (?waitlist=…) */}
      <Suspense fallback={null}>
        <WaitlistToast />
      </Suspense>

      <PricingSection validatedRef={validatedRef} campaign={campaign} />

      {/* ══ FAQ ══════════════════════════════════════════════════════════ */}
      <FAQSection />

      <Footer />
    </div>
  )
}
