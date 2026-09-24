import type { CSSProperties, ReactNode } from 'react'

/**
 * Marketing hero. Colors come from a theme so the same content can be
 * previewed in several looks (see /hero-varianten) and switched with one prop.
 */

export type HeroTheme = {
  /** Section background (gradient or color) */
  bg: string
  /** Decorative light spots layered over the background */
  spots: string
  text: string
  muted: string
  eyebrow: string
  accent: string
  iconBg: string
  iconBorder: string
  iconColor: string
  ctaBg: string
  ctaColor: string
  ctaRing: string
  ghostColor: string
  ghostBorder: string
  trust: string
  glow: string
  phoneShadow: string
  chipBg: string
  chipText: string
  /** Light area the phones overlap into (must match the following section) */
  after: string
}

export const heroThemes: Record<string, { label: string; note: string; theme: HeroTheme }> = {
  violett: {
    label: 'Violett (aktuell)',
    note: 'Der bisherige Look: satter Lila-Verlauf, Akzent in warmem Apricot.',
    theme: {
      bg: 'linear-gradient(180deg, #1B0F3F 0%, #2E1D6E 30%, #4A35A0 60%, #6247AF 100%)',
      spots: 'radial-gradient(60% 50% at 78% 62%, rgba(255,207,140,0.18), transparent 70%), radial-gradient(45% 40% at 15% 20%, rgba(255,255,255,0.07), transparent 70%)',
      text: '#fff', muted: 'rgba(255,255,255,0.84)', eyebrow: 'rgba(255,255,255,0.8)', accent: '#FFCF8C',
      iconBg: 'rgba(255,255,255,0.09)', iconBorder: 'rgba(255,255,255,0.16)', iconColor: '#FFCF8C',
      ctaBg: '#fff', ctaColor: '#2A1A6E', ctaRing: 'rgba(255,255,255,0.08)',
      ghostColor: '#fff', ghostBorder: 'rgba(255,255,255,0.35)', trust: 'rgba(255,255,255,0.6)',
      glow: 'radial-gradient(closest-side, rgba(255,207,140,0.38), rgba(142,111,208,0.3) 60%, transparent 100%)',
      phoneShadow: 'rgba(15,8,50,0.55)', chipBg: 'rgba(255,255,255,0.95)', chipText: '#1a1530',
      after: '#FAFAF8',
    },
  },
  mitternacht: {
    label: 'Mitternachtsblau',
    note: 'Tiefes Navy wie das mittlere Handy, Akzent in Gold. Wirkt seriös und hochwertig, klassischer SaaS-Look.',
    theme: {
      bg: 'linear-gradient(180deg, #070D24 0%, #0C1A4A 40%, #12296F 75%, #1B3A8F 100%)',
      spots: 'radial-gradient(55% 45% at 78% 60%, rgba(255,196,110,0.16), transparent 70%), radial-gradient(40% 40% at 10% 15%, rgba(96,165,250,0.14), transparent 70%)',
      text: '#fff', muted: 'rgba(226,232,255,0.82)', eyebrow: 'rgba(191,205,255,0.8)', accent: '#FFC46E',
      iconBg: 'rgba(255,255,255,0.08)', iconBorder: 'rgba(255,255,255,0.14)', iconColor: '#FFC46E',
      ctaBg: '#FFC46E', ctaColor: '#0C1A4A', ctaRing: 'rgba(255,196,110,0.18)',
      ghostColor: '#fff', ghostBorder: 'rgba(255,255,255,0.3)', trust: 'rgba(226,232,255,0.55)',
      glow: 'radial-gradient(closest-side, rgba(255,196,110,0.32), rgba(59,91,219,0.35) 60%, transparent 100%)',
      phoneShadow: 'rgba(2,6,30,0.6)', chipBg: 'rgba(255,255,255,0.96)', chipText: '#0C1A4A',
      after: '#FAFAF8',
    },
  },
  creme: {
    label: 'Hell & Creme',
    note: 'Warmer heller Hintergrund, dunkle Schrift, Akzent in tiefem Violett. Frisch, Apple-artig, die dunklen Handys stechen hervor.',
    theme: {
      bg: 'linear-gradient(180deg, #FFFDF9 0%, #FAF5EC 55%, #F3ECE0 100%)',
      spots: 'radial-gradient(55% 45% at 78% 60%, rgba(255,190,120,0.35), transparent 70%), radial-gradient(45% 40% at 12% 18%, rgba(160,130,240,0.18), transparent 70%)',
      text: '#1A1530', muted: '#4B4660', eyebrow: '#8A6BD6', accent: '#5B3FC4',
      iconBg: '#fff', iconBorder: 'rgba(26,21,48,0.08)', iconColor: '#5B3FC4',
      ctaBg: '#1A1530', ctaColor: '#fff', ctaRing: 'rgba(26,21,48,0.08)',
      ghostColor: '#1A1530', ghostBorder: 'rgba(26,21,48,0.22)', trust: '#7A7590',
      glow: 'radial-gradient(closest-side, rgba(255,190,120,0.55), rgba(160,130,240,0.28) 60%, transparent 100%)',
      phoneShadow: 'rgba(60,40,20,0.35)', chipBg: 'rgba(255,255,255,0.98)', chipText: '#1A1530',
      after: '#FFFFFF',
    },
  },
  wellness: {
    label: 'Wellness-Grün',
    note: 'Dunkles Tannengrün mit Mint-Akzent. Passt zu Gesundheit, Ernährung und Wellness-Produkten, wirkt ruhig und vertrauensvoll.',
    theme: {
      bg: 'linear-gradient(180deg, #0B1F1A 0%, #10302A 40%, #164A3F 75%, #1D5C4E 100%)',
      spots: 'radial-gradient(55% 45% at 78% 60%, rgba(185,243,214,0.14), transparent 70%), radial-gradient(40% 40% at 10% 15%, rgba(255,214,150,0.12), transparent 70%)',
      text: '#fff', muted: 'rgba(226,245,238,0.84)', eyebrow: 'rgba(185,243,214,0.85)', accent: '#B9F3D6',
      iconBg: 'rgba(255,255,255,0.08)', iconBorder: 'rgba(255,255,255,0.14)', iconColor: '#B9F3D6',
      ctaBg: '#B9F3D6', ctaColor: '#0B1F1A', ctaRing: 'rgba(185,243,214,0.16)',
      ghostColor: '#fff', ghostBorder: 'rgba(255,255,255,0.3)', trust: 'rgba(226,245,238,0.55)',
      glow: 'radial-gradient(closest-side, rgba(185,243,214,0.3), rgba(255,214,150,0.22) 60%, transparent 100%)',
      phoneShadow: 'rgba(2,20,14,0.6)', chipBg: 'rgba(255,255,255,0.96)', chipText: '#0B1F1A',
      after: '#FAFAF8',
    },
  },
  aurora: {
    label: 'Aurora Dark',
    note: 'Fast schwarz mit weichen Farbwolken in Lila, Koralle und Petrol. Modern und auffällig, sehr viel Tiefe hinter den Handys.',
    theme: {
      bg: 'linear-gradient(180deg, #0B0716 0%, #120C24 60%, #1A1233 100%)',
      spots: 'radial-gradient(45% 55% at 80% 55%, rgba(255,120,110,0.28), transparent 70%), radial-gradient(40% 45% at 62% 35%, rgba(120,80,255,0.35), transparent 70%), radial-gradient(35% 40% at 15% 25%, rgba(20,184,166,0.22), transparent 70%)',
      text: '#fff', muted: 'rgba(235,230,255,0.82)', eyebrow: 'rgba(255,170,150,0.9)', accent: '#FFB69B',
      iconBg: 'rgba(255,255,255,0.07)', iconBorder: 'rgba(255,255,255,0.14)', iconColor: '#FFB69B',
      ctaBg: '#fff', ctaColor: '#120C24', ctaRing: 'rgba(255,255,255,0.08)',
      ghostColor: '#fff', ghostBorder: 'rgba(255,255,255,0.3)', trust: 'rgba(235,230,255,0.55)',
      glow: 'radial-gradient(closest-side, rgba(255,150,120,0.35), rgba(120,80,255,0.35) 60%, transparent 100%)',
      phoneShadow: 'rgba(0,0,0,0.7)', chipBg: 'rgba(255,255,255,0.95)', chipText: '#120C24',
      after: '#FAFAF8',
    },
  },
}

export const DEFAULT_HERO_THEME = 'violett'

const benefits: { title: string; desc: string; icon: ReactNode }[] = [
  {
    title: 'Fertige Seiten für Produkt und Zielgruppe',
    desc: 'Optimalset, Stoffwechselkur, Mütter, Sportler: In der Bibliothek ist die passende Seite schon fertig.',
    icon: <><rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/></>,
  },
  {
    title: 'Kein Texten, kein Designen',
    desc: 'Name, Foto, Kontakt anpassen. In wenigen Minuten ist deine Seite live.',
    icon: <><path d="M9.94 14.54 12 21l2.06-6.46L20 12l-5.94-2.54L12 3 9.94 9.46 4 12z"/><path d="M5 3v4M3 5h4"/><path d="M19 17v4M17 19h4"/></>,
  },
  {
    title: 'Teil den Link, die Seite macht den Rest',
    desc: 'Instagram-Bio, Story, WhatsApp, Visitenkarte: Schick die Leute auf deine Seite. Sie überzeugt Kunden und Teampartner für dich, auch wenn du gerade keine Zeit hast.',
    icon: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></>,
  },
]

export default function HeroSection({
  registerHref,
  themeKey = DEFAULT_HERO_THEME,
  /** unique per instance when several heroes render on one page (SVG clipPath ids) */
  idPrefix = 'fs',
}: {
  registerHref: string
  themeKey?: string
  idPrefix?: string
}) {
  const t = (heroThemes[themeKey] ?? heroThemes[DEFAULT_HERO_THEME]).theme
  const vars = {
    '--h-bg': t.bg, '--h-spots': t.spots, '--h-text': t.text, '--h-muted': t.muted, '--h-eyebrow': t.eyebrow,
    '--h-accent': t.accent, '--h-icon-bg': t.iconBg, '--h-icon-border': t.iconBorder, '--h-icon': t.iconColor,
    '--h-cta-bg': t.ctaBg, '--h-cta': t.ctaColor, '--h-cta-ring': t.ctaRing, '--h-ghost': t.ghostColor,
    '--h-ghost-border': t.ghostBorder, '--h-trust': t.trust, '--h-glow': t.glow, '--h-phone-shadow': t.phoneShadow,
    '--h-chip-bg': t.chipBg, '--h-chip-text': t.chipText, '--h-after': t.after,
  } as CSSProperties

  return (
    <>
      <style>{heroCss}</style>
      <section className="fs-hero-section" style={vars}>
        <div className="fs-hero-content">

          <div className="fs-hero-head">
            <p className="fs-hero-eyebrow">Für Network Marketer</p>
            <h1 className="fs-hero-h1">
              Deine Website fürs<br /><span className="fs-hero-h1-accent">Network-Marketing-Business.</span>
            </h1>
          </div>

          <div className="fs-hero-grid">
            <div className="fs-hero-copy">
              <p className="fs-hero-sub">
                Nicht jeder will sofort in ein Zoom-Meeting oder einen Info-Call. Auf deiner Seite informieren sich Kunden und Teampartner rund um die Uhr selbst und buchen dann einen Termin bei dir.
              </p>

              <ul className="fs-hero-benefits">
                {benefits.map((b, i) => (
                  <li key={i} className="fs-hero-benefit">
                    <span className="fs-hero-benefit-icon" aria-hidden="true">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{b.icon}</svg>
                    </span>
                    <span>
                      <strong>{b.title}</strong>
                      <span className="fs-hero-benefit-desc">{b.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="fs-hero-buttons">
                <a href={registerHref} className="fs-hero-cta">
                  Jetzt kostenlos starten
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </a>
                <a href="#templates" className="fs-hero-cta-ghost">Vorlagen anschauen</a>
              </div>
              <p className="fs-hero-trust">Kostenlos ausprobieren. Bezahlt wird erst, wenn deine Seite online geht.</p>
            </div>

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
                <span className="fs-hero-chip-flags">
                  <svg viewBox="0 0 30 30" width="26" height="26" aria-hidden="true">
                    <clipPath id={`${idPrefix}-flag-de`}><circle cx="15" cy="15" r="15" /></clipPath>
                    <g clipPath={`url(#${idPrefix}-flag-de)`}><rect width="30" height="10" fill="#000" /><rect y="10" width="30" height="10" fill="#DD0000" /><rect y="20" width="30" height="10" fill="#FFCE00" /></g>
                  </svg>
                  <svg viewBox="0 0 30 30" width="26" height="26" aria-hidden="true">
                    <clipPath id={`${idPrefix}-flag-uk`}><circle cx="15" cy="15" r="15" /></clipPath>
                    <g clipPath={`url(#${idPrefix}-flag-uk)`}>
                      <rect width="30" height="30" fill="#012169" />
                      <path d="M0 0 30 30M30 0 0 30" stroke="#fff" strokeWidth="6" />
                      <path d="M0 0 30 30M30 0 0 30" stroke="#C8102E" strokeWidth="2" />
                      <path d="M15 0v30M0 15h30" stroke="#fff" strokeWidth="10" />
                      <path d="M15 0v30M0 15h30" stroke="#C8102E" strokeWidth="6" />
                    </g>
                  </svg>
                </span>
                <span>Mehrsprachig<br />mit einem Klick</span>
              </div>
              <div className="fs-hero-chip fs-hero-chip-2" aria-hidden="true">
                <span className="fs-hero-chip-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
                </span>
                <span>Richtlinien<br />geprüft</span>
              </div>
              <div className="fs-hero-chip fs-hero-chip-3" aria-hidden="true">
                <span className="fs-hero-chip-icon" style={{ background: '#FFF4E5', color: '#D97706' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
                </span>
                <span>Live in<br />3 Minuten</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spacer: the hero phones overlap into this light area */}
      <div className="fs-hero-spacer" style={{ background: t.after }} aria-hidden="true" />
    </>
  )
}

const heroCss = `
  .fs-hero-section { width: 100%; position: relative; z-index: 2; overflow-x: clip; background: var(--h-bg); }
  .fs-hero-section::before { content: ""; position: absolute; inset: 0; background: var(--h-spots); pointer-events: none; }
  .fs-hero-content { position: relative; z-index: 2; padding: 150px 24px 0; max-width: 1180px; margin: 0 auto; }
  .fs-hero-head { max-width: 980px; margin-bottom: 36px; }
  .fs-hero-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: var(--h-eyebrow); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 22px; }
  .fs-hero-h1 { font-family: "Plein", sans-serif; font-size: clamp(38px, 5.2vw, 72px); font-weight: 400; color: var(--h-text); line-height: 1.02; letter-spacing: -0.03em; white-space: nowrap; }
  .fs-hero-h1-accent { color: var(--h-accent); }
  .fs-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 40px; align-items: center; }
  .fs-hero-copy { padding-bottom: 80px; }
  .fs-hero-sub { font-size: 17px; color: var(--h-muted); line-height: 1.7; margin-bottom: 30px; max-width: 520px; }
  .fs-hero-benefits { list-style: none; display: flex; flex-direction: column; gap: 16px; margin: 0 0 36px; padding: 0; max-width: 520px; }
  .fs-hero-benefit { display: flex; gap: 14px; align-items: flex-start; font-size: 15px; line-height: 1.5; color: var(--h-muted); }
  .fs-hero-benefit strong { display: block; color: var(--h-text); font-weight: 700; margin-bottom: 3px; font-size: 16px; }
  .fs-hero-benefit-desc { display: block; font-size: 14px; }
  .fs-hero-benefit-icon { flex: none; width: 36px; height: 36px; border-radius: 11px; background: var(--h-icon-bg); border: 1px solid var(--h-icon-border); color: var(--h-icon); display: inline-flex; align-items: center; justify-content: center; margin-top: 1px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); }
  .fs-hero-buttons { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .fs-hero-cta { display: inline-flex; align-items: center; gap: 10px; background: var(--h-cta-bg); color: var(--h-cta); padding: 17px 30px 17px 34px; border-radius: 100px; font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 8px 30px rgba(0,0,0,0.25), 0 0 0 6px var(--h-cta-ring); transition: transform 0.15s ease, box-shadow 0.15s ease; }
  .fs-hero-cta:hover { transform: translateY(-1px); box-shadow: 0 12px 34px rgba(0,0,0,0.3), 0 0 0 6px var(--h-cta-ring); }
  .fs-hero-cta-ghost { display: inline-flex; align-items: center; color: var(--h-ghost); padding: 17px 28px; border-radius: 100px; font-size: 15px; font-weight: 600; border: 1.5px solid var(--h-ghost-border); text-decoration: none; transition: background 0.15s ease; }
  .fs-hero-cta-ghost:hover { background: rgba(127,127,127,0.1); }
  .fs-hero-trust { font-size: 13px; color: var(--h-trust); margin-top: 16px; font-weight: 500; }
  .fs-hero-visual { position: relative; width: 122%; max-width: none; transform: translateY(110px); }
  .fs-hero-glow { position: absolute; left: 8%; right: 8%; top: 12%; bottom: 14%; border-radius: 50%; background: var(--h-glow); filter: blur(46px); }
  .fs-hero-phones { position: relative; width: 100%; height: auto; display: block; filter: drop-shadow(0 40px 70px var(--h-phone-shadow)); }
  .fs-hero-chip { position: absolute; display: flex; align-items: center; gap: 12px; background: var(--h-chip-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-radius: 18px; padding: 13px 18px 13px 14px; font-size: 14.5px; font-weight: 700; line-height: 1.25; color: var(--h-chip-text); box-shadow: 0 14px 34px rgba(15,8,50,0.35), 0 0 0 1px rgba(255,255,255,0.6) inset; animation: fs-hero-float 6s ease-in-out infinite; }
  .fs-hero-chip-icon { flex: none; width: 34px; height: 34px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; }
  .fs-hero-chip-flags { flex: none; display: inline-flex; align-items: center; }
  .fs-hero-chip-flags svg { border-radius: 50%; box-shadow: 0 0 0 2px #fff; }
  .fs-hero-chip-flags svg + svg { margin-left: -8px; }
  .fs-hero-chip-1 { left: 0; top: 10%; animation-delay: 0s; }
  .fs-hero-chip-2 { right: 6%; top: 24%; animation-delay: -2s; }
  .fs-hero-chip-3 { left: 4%; bottom: 20%; animation-delay: -4s; }
  .fs-hero-spacer { height: 72px; }
  @keyframes fs-hero-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
  @media (prefers-reduced-motion: reduce) { .fs-hero-chip { animation: none; } }

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
  }

  @media (max-width: 767px) {
    .fs-hero-buttons { flex-direction: column; align-items: stretch; }
    .fs-hero-content { padding: 116px 22px 0; }
    .fs-hero-h1 { font-size: clamp(30px, 8.4vw, 40px); white-space: normal; overflow-wrap: anywhere; }
    .fs-hero-sub { font-size: 16px; }
    .fs-hero-cta, .fs-hero-cta-ghost { justify-content: center; }
    .fs-hero-visual { margin: 28px -8px -60px; }
    .fs-hero-spacer { height: 52px; }
    .fs-hero-chip { font-size: 12.5px; padding: 10px 13px 10px 11px; border-radius: 14px; gap: 9px; }
    .fs-hero-chip-icon { width: 28px; height: 28px; border-radius: 9px; }
    .fs-hero-chip-flags svg { width: 22px; height: 22px; }
    .fs-hero-chip-1 { top: 6%; }
    .fs-hero-chip-2 { right: 0; top: 20%; }
    .fs-hero-chip-3 { bottom: 18%; }
    .fs-hero-visual { width: auto; }
  }
`
