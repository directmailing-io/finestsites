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
      .where(and(inArray(templates.status, ['published', 'coming_soon']), eq(templates.isTest, false), eq(templates.isAllrounder, false)))
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
        /* ── Hero ────────────────────────────────────────── */
        .fs-hero-section { width: 100%; position: relative; z-index: 2; overflow-x: clip; background: linear-gradient(180deg, #1B0F3F 0%, #2E1D6E 30%, #4A35A0 60%, #6247AF 100%); }
        .fs-hero-section::before { content: ""; position: absolute; inset: 0; background: radial-gradient(60% 50% at 78% 62%, rgba(255,207,140,0.18), transparent 70%), radial-gradient(45% 40% at 15% 20%, rgba(255,255,255,0.07), transparent 70%); pointer-events: none; }
        .fs-hero-content { position: relative; z-index: 2; padding: 150px 24px 0; max-width: 1180px; margin: 0 auto; }
        .fs-hero-head { max-width: 980px; margin-bottom: 36px; }
        .fs-hero-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.8); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 22px; }
        .fs-hero-eyebrow-dot { width: 8px; height: 8px; border-radius: 50%; background: #FFCF8C; box-shadow: 0 0 0 4px rgba(255,207,140,0.22); }
        .fs-hero-h1 { font-family: "Plein", sans-serif; font-size: clamp(38px, 5.2vw, 72px); font-weight: 400; color: #fff; line-height: 1.02; letter-spacing: -0.03em; white-space: nowrap; }
        .fs-hero-h1-accent { color: #FFCF8C; }
        .fs-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 40px; align-items: center; }
        .fs-hero-copy { padding-bottom: 80px; }
        .fs-hero-sub { font-size: 17px; color: rgba(255,255,255,0.84); line-height: 1.7; margin-bottom: 30px; max-width: 520px; }
        .fs-hero-benefits { list-style: none; display: flex; flex-direction: column; gap: 16px; margin: 0 0 36px; padding: 0; max-width: 520px; }
        .fs-hero-benefit { display: flex; gap: 14px; align-items: flex-start; font-size: 15px; line-height: 1.5; color: rgba(255,255,255,0.75); }
        .fs-hero-benefit strong { display: block; color: #fff; font-weight: 700; margin-bottom: 3px; font-size: 16px; }
        .fs-hero-benefit-desc { display: block; font-size: 14px; }
        .fs-hero-check { flex: none; width: 24px; height: 24px; border-radius: 50%; background: #FFCF8C; display: inline-flex; align-items: center; justify-content: center; margin-top: 2px; }
        .fs-hero-buttons { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .fs-hero-cta { display: inline-flex; align-items: center; gap: 10px; background: #fff; color: #2A1A6E; padding: 17px 30px 17px 34px; border-radius: 100px; font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 8px 30px rgba(0,0,0,0.25), 0 0 0 6px rgba(255,255,255,0.08); transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .fs-hero-cta:hover { transform: translateY(-1px); box-shadow: 0 12px 34px rgba(0,0,0,0.3), 0 0 0 6px rgba(255,255,255,0.12); }
        .fs-hero-cta-ghost { display: inline-flex; align-items: center; color: #fff; padding: 17px 28px; border-radius: 100px; font-size: 15px; font-weight: 600; border: 1.5px solid rgba(255,255,255,0.35); text-decoration: none; transition: background 0.15s ease; }
        .fs-hero-cta-ghost:hover { background: rgba(255,255,255,0.08); }
        .fs-hero-trust { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 16px; font-weight: 500; }
        .fs-hero-visual { position: relative; width: 122%; max-width: none; transform: translateY(110px); }
        .fs-hero-glow { position: absolute; left: 8%; right: 8%; top: 12%; bottom: 14%; border-radius: 50%; background: radial-gradient(closest-side, rgba(255,207,140,0.38), rgba(142,111,208,0.3) 60%, transparent 100%); filter: blur(46px); }
        .fs-hero-phones { position: relative; width: 100%; height: auto; display: block; filter: drop-shadow(0 40px 70px rgba(15,8,50,0.55)); }
        .fs-hero-chip { position: absolute; display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.94); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-radius: 16px; padding: 10px 14px 10px 12px; font-size: 12.5px; font-weight: 700; line-height: 1.25; color: #1a1530; box-shadow: 0 14px 34px rgba(15,8,50,0.35), 0 0 0 1px rgba(255,255,255,0.6) inset; animation: fs-hero-float 6s ease-in-out infinite; }
        .fs-hero-chip-icon { flex: none; width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
        .fs-hero-chip-lang { flex: none; display: inline-flex; align-items: center; gap: 6px; background: #F3F0FA; border-radius: 99px; padding: 5px 9px; font-size: 11px; letter-spacing: 0.04em; color: #4A35A0; }
        .fs-hero-chip-lang i { width: 1px; height: 10px; background: rgba(74,53,160,0.3); }
        .fs-hero-chip-1 { left: 0; top: 10%; animation-delay: 0s; }
        .fs-hero-chip-2 { right: 6%; top: 24%; animation-delay: -2s; }
        .fs-hero-chip-3 { left: 4%; bottom: 20%; animation-delay: -4s; }
        .fs-hero-spacer { height: 72px; background: #FAFAF8; }
        @keyframes fs-hero-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @media (prefers-reduced-motion: reduce) { .fs-hero-chip { animation: none; } }
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
          .fs-hero-content { padding: 140px 5vw 0; }
          .fs-hero-head { text-align: center; margin: 0 auto 28px; }
          .fs-hero-h1 { font-size: clamp(36px, 6.4vw, 60px); }
          .fs-hero-grid { grid-template-columns: 1fr; gap: 28px; }
          .fs-hero-copy { padding-bottom: 0; text-align: center; }
          .fs-hero-sub, .fs-hero-benefits { margin-left: auto; margin-right: auto; }
          .fs-hero-benefits { text-align: left; }
          .fs-hero-buttons { justify-content: center; }
          .fs-hero-visual { width: 100%; max-width: 560px; margin: 32px auto -90px; transform: none; }
          .fs-hero-spacer { height: 56px; }
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
          .fs-hero-buttons { flex-direction: column; align-items: stretch; }

          .fs-hero-content { padding: 116px 22px 0; }
          .fs-hero-h1 { font-size: clamp(30px, 8.4vw, 40px); white-space: normal; overflow-wrap: anywhere; }
          .fs-hero-sub { font-size: 16px; }
          .fs-hero-cta, .fs-hero-cta-ghost { justify-content: center; }
          .fs-hero-visual { margin: 28px -8px -60px; }
          .fs-hero-spacer { height: 52px; }
          .fs-hero-chip { font-size: 11.5px; padding: 8px 11px 8px 9px; border-radius: 13px; }
          .fs-hero-chip-1 { top: 6%; }
          .fs-hero-chip-2 { right: 0; top: 20%; }
          .fs-hero-visual { width: auto; }
          .fs-hero-chip-3 { bottom: 18%; }
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
      <section className="fs-hero-section">
        <div className="fs-hero-content">

          {/* ── Headline across the full width ── */}
          <div className="fs-hero-head">
            <p className="fs-hero-eyebrow">
              <span className="fs-hero-eyebrow-dot" aria-hidden="true" />
              Für Networker
            </p>
            <h1 className="fs-hero-h1">
              Deine Website fürs<br /><span className="fs-hero-h1-accent">Network-Marketing-Business.</span>
            </h1>
          </div>

          <div className="fs-hero-grid">
            {/* ── Copy ── */}
            <div className="fs-hero-copy">
              <p className="fs-hero-sub">
                Du hast genug damit zu tun, Menschen zu erreichen. Deine Website soll dir dabei helfen und nicht noch mehr Arbeit machen. Deshalb ist bei FinestSites schon alles drin: Texte, Design, Rechtliches. Du trägst nur noch dich ein.
              </p>

              <ul className="fs-hero-benefits">
                {([
                  { title: 'Spricht die Sprache deiner Kontakte', desc: 'Deutsch und Englisch mit einem Klick. So verstehen dich auch Kunden und Teampartner im Ausland sofort.' },
                  { title: 'Richtliniengerecht, ohne dass du dich kümmern musst', desc: 'Alle Texte sind nach den Vorgaben deiner Firma geschrieben. Ändert sich was, passen wir es automatisch an.' },
                  { title: 'Fertig, bevor der Kaffee kalt ist', desc: 'Vorlage wählen, Name und Foto rein, live. Wer WhatsApp bedienen kann, kann das auch.' },
                ] as { title: string; desc: string }[]).map((b, i) => (
                  <li key={i} className="fs-hero-benefit">
                    <span className="fs-hero-check" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2 5 8.6l4.5-5" stroke="#201245" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <span>
                      <strong>{b.title}</strong>
                      <span className="fs-hero-benefit-desc">{b.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="fs-hero-buttons">
                <a href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'}/register${validatedRef ? `?ref=${validatedRef}` : ''}`} className="fs-hero-cta">
                  Jetzt kostenlos starten
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </a>
                <a href="#templates" className="fs-hero-cta-ghost">Vorlagen anschauen</a>
              </div>
              <p className="fs-hero-trust">Kostenlos ausprobieren. Bezahlt wird erst, wenn deine Seite online geht.</p>
            </div>

            {/* ── Phones with floating proof chips ── */}
            <div className="fs-hero-visual">
              <div className="fs-hero-glow" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero-phones.webp"
                alt="Drei Beispiel-Websites von FinestSites auf dem Smartphone"
                width={1421}
                height={1072}
                fetchPriority="high"
                className="fs-hero-phones"
              />
              <div className="fs-hero-chip fs-hero-chip-1" aria-hidden="true">
                <span className="fs-hero-chip-lang"><b>DE</b><i /><b>EN</b></span>
                <span>Zwei Sprachen,<br />ein Klick</span>
              </div>
              <div className="fs-hero-chip fs-hero-chip-2" aria-hidden="true">
                <span className="fs-hero-chip-icon" style={{ background: '#DCFCE7', color: '#16A34A' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </span>
                <span>Richtlinien<br />geprüft</span>
              </div>
              <div className="fs-hero-chip fs-hero-chip-3" aria-hidden="true">
                <span className="fs-hero-chip-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>
                </span>
                <span>Live in<br />3 Minuten</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spacer: the hero phones overlap into this light area */}
      <div className="fs-hero-spacer" aria-hidden="true" />

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
              { label: 'Schnell',  title: 'In unter 3 Minuten live',          desc: 'Template wählen, deinen Namen eintragen, ein Foto hochladen. Fertig. Kein Designer, kein Entwickler, kein Stress.' },
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
