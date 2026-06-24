import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FinestSites – Deine professionelle Website in Minuten',
  description: 'Professionelle Produktwebsite für Network-Marketing-Profis. In unter 5 Minuten live. Keine Technik, keine Agentur — einfach starten.',
}

// ─── Plans data ───────────────────────────────────────────────────────────────
const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    monthly: 20,
    yearly: 200,
    sites: '1 aktive Website',
    features: ['∞ kostenlose Entwürfe', 'Eigene Subdomain', 'SSL & DSGVO-konform', 'Kontaktformular', 'Online in unter 5 Min'],
    popular: false,
    cta: 'Jetzt starten',
  },
  {
    key: 'pro',
    name: 'Pro',
    monthly: 30,
    yearly: 300,
    sites: '3 aktive Websites',
    features: ['Alles aus Starter', 'EU-Health-Claims-Check (KI)', 'Eigene Domain verbinden', 'Prioritäts-Support', '3 Websites parallel'],
    popular: true,
    cta: 'Beliebteste Wahl',
  },
  {
    key: 'unlimited',
    name: 'Unlimited',
    monthly: 50,
    yearly: 500,
    sites: '∞ aktive Websites',
    features: ['Alles aus Pro', 'Unbegrenzt Websites', 'Frühzeitiger Template-Zugang', 'Persönlicher Onboarding-Call', 'Team-Verwaltung (bald)'],
    popular: false,
    cta: 'Jetzt starten',
  },
]

// ─── Templates data ───────────────────────────────────────────────────────────
const TEMPLATES = [
  { name: 'FitLine Starter', niche: 'PM International', desc: 'Für FitLine-Berater. Produkte präsentieren, Kontaktanfragen sammeln, Downline aufbauen.', color: '#B8CCDB', free: true, emoji: '💚' },
  { name: 'Beauty & Wellness', niche: 'Kosmetik / Pflege', desc: 'Elegantes Design für Schönheitsprodukte. Perfekt für LR, Avon oder Juice Plus.', color: '#EDCBA8', free: false, emoji: '✨' },
  { name: 'Coach & Berater', niche: 'Coaching / MLM', desc: 'Zeig wer du bist, was du anbietest — und warum Menschen mit dir arbeiten sollten.', color: '#C8D8B8', free: false, emoji: '🎯' },
  { name: 'Ernährung & Fitness', niche: 'Health / Sports', desc: 'Für Herbalife, Forever Living & Co. Produkt-Fokus mit Testimonials und Kontaktformular.', color: '#D4C5E2', free: false, emoji: '🏋️' },
  { name: 'Naturkosmetik', niche: 'Organic / Green', desc: 'Minimalistisches, naturnahes Design. Ideal für nachhaltige Produkte und grüne Brands.', color: '#C8D8B8', free: false, emoji: '🌿' },
  { name: 'Business Opportunity', niche: 'Recruiting / MLM', desc: 'Zeig die Geschäftsmöglichkeit — strukturiert, seriös und überzeugend.', color: '#B8CCDB', free: false, emoji: '🚀' },
]

export default function HomePage() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f5f4f0', minHeight: '100vh' }}>

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
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════
          NAV — Floating white pill (fixed so hero is truly fullbleed)
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{ padding: '20px 24px 0', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
        <nav style={{
          background: '#fff',
          borderRadius: 100,
          padding: '10px 14px 10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 24px rgba(0,0,0,0.07)',
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          <img src="/logos/logo-black.svg" alt="FinestSites" style={{ height: 22, display: 'block' }} />
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <a href="#was-ist" style={{ color: '#555', fontSize: 14, fontWeight: 500 }}>Was ist FinestSites?</a>
            <a href="#templates" style={{ color: '#555', fontSize: 14, fontWeight: 500 }}>Templates</a>
            <a href="#preise" style={{ color: '#555', fontSize: 14, fontWeight: 500 }}>Preise</a>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href="/login" style={{ color: '#111', fontSize: 14, fontWeight: 500, padding: '8px 18px', borderRadius: 100, border: '1.5px solid rgba(0,0,0,0.12)' }}>Anmelden</a>
            <a href="/register" style={{ background: '#111', color: '#fff', fontSize: 14, fontWeight: 600, padding: '9px 20px', borderRadius: 100 }}>Kostenlos starten</a>
          </div>
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          HERO — Vollbild, Links Text (max 3 Zeilen), rechts Bild
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{
        width: '100%',
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: '#f0ede8',
        overflow: 'hidden',
      }}>
        {/* Background image — full cover */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/hero-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
        }} />

        {/* White gradient — strong left, fades to transparent ~55% */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, #ffffff 42%, rgba(255,255,255,0.88) 54%, rgba(255,255,255,0.3) 68%, rgba(255,255,255,0) 82%)',
        }} />

        {/* Text content */}
        <div style={{ position: 'relative', zIndex: 2, padding: '120px 7vw 80px', maxWidth: '54vw' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>
            Für Network-Marketing-Profis
          </p>

          <h1 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(48px, 6.5vw, 90px)',
            fontWeight: 400,
            color: '#111',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: 28,
            whiteSpace: 'nowrap',
          }}>
            Wenn Kunden auf dich<br />zukommen — nicht<br />umgekehrt.
          </h1>

          <p style={{ fontSize: 17, color: '#444', lineHeight: 1.7, marginBottom: 40, maxWidth: 480 }}>
            Professionelle Produktwebsite in unter 5 Minuten live — und Interessenten melden sich bei <em>dir</em>.
          </p>

          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/register" style={{
              background: '#111',
              color: '#fff',
              padding: '15px 36px',
              borderRadius: 100,
              fontSize: 15,
              fontWeight: 600,
              display: 'inline-block',
            }}>Kostenlos starten</a>
            <a href="#templates" style={{
              background: 'rgba(255,255,255,0.75)',
              color: '#111',
              padding: '15px 36px',
              borderRadius: 100,
              fontSize: 15,
              fontWeight: 500,
              display: 'inline-block',
              border: '1.5px solid rgba(0,0,0,0.12)',
              backdropFilter: 'blur(8px)',
            }}>Templates ansehen</a>
          </div>

          <p style={{ marginTop: 20, fontSize: 13, color: '#999' }}>
            Keine Kreditkarte nötig · Kostenlos ausprobieren
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          WAS IST FINESTSITES? — Value Proposition
      ══════════════════════════════════════════════════════════════════ */}
      <section id="was-ist" style={{
        background: '#fff',
        margin: '16px 24px',
        borderRadius: 28,
        padding: '80px 60px',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
            {/* Left: text */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                Das Problem
              </p>
              <h2 style={{
                fontFamily: '"Plein", sans-serif',
                fontSize: 'clamp(28px, 3.5vw, 44px)',
                fontWeight: 400,
                color: '#111',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                marginBottom: 24,
              }}>
                Du hast ein tolles Produkt. Aber niemand weiß davon.
              </h2>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, marginBottom: 20 }}>
                Die meisten Network-Marketer kämpfen täglich darum, neue Interessenten zu finden. Du postest, chattest, rufst an — und trotzdem bleibt der Durchbruch aus.
              </p>
              <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75 }}>
                <strong style={{ color: '#111' }}>FinestSites ändert das.</strong> Du bekommst eine professionelle Produktwebsite, die für dich arbeitet — 24/7, auch wenn du schläfst.
              </p>
            </div>
            {/* Right: benefit cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { icon: '⚡', title: 'In unter 5 Minuten live', desc: 'Kein Designer, kein Entwickler, kein Technik-Stress. Einfach Template wählen, Inhalte einfügen — fertig.' },
                { icon: '✓', title: 'KI-geprüfte Texte', desc: 'Automatische Prüfung auf unzulässige Health Claims. Du bist auf der sicheren Seite — rechtlich und inhaltlich.' },
                { icon: '🌐', title: 'Eigene Domain oder Subdomain', desc: 'Präsentiere dich unter deiner eigenen Adresse oder nutze kostenlos deine FinestSites-Subdomain.' },
              ].map((item, i) => (
                <div key={i} style={{ background: '#fafafa', border: '1px solid #ebebeb', borderRadius: 16, padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 4 }}>{item.title}</h4>
                    <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          TEMPLATES — Alle Vorlagen mit Vorschau
      ══════════════════════════════════════════════════════════════════ */}
      <section id="templates" style={{
        background: '#1a2530',
        margin: '16px 24px',
        borderRadius: 28,
        padding: '80px 60px',
      }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
            Vorlagen
          </p>
          <h2 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(32px, 4vw, 52px)',
            fontWeight: 400,
            color: '#fff',
            letterSpacing: '-0.025em',
            textAlign: 'center',
            marginBottom: 16,
            lineHeight: 1.1,
          }}>
            Wähle dein Template.
          </h2>
          <p style={{ textAlign: 'center', fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 52, maxWidth: 480, margin: '0 auto 52px' }}>
            Alle Templates sind für Network-Marketing-Profis entwickelt — professionell, schnell und ohne technisches Vorwissen.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {TEMPLATES.map((tpl, i) => (
              <div key={i} style={{
                background: '#232f3a',
                borderRadius: 20,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                {/* Preview card */}
                <div style={{
                  background: tpl.color,
                  height: 160,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}>
                  {tpl.free && (
                    <div style={{ position: 'absolute', top: 12, right: 12, background: '#16A34A', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100 }}>
                      KOSTENLOS
                    </div>
                  )}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>{tpl.emoji}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.45)', letterSpacing: '0.05em' }}>{tpl.niche.toUpperCase()}</div>
                  </div>
                </div>
                {/* Info */}
                <div style={{ padding: '20px 22px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 6 }}>{tpl.name}</h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 16 }}>{tpl.desc}</p>
                  <a href="/register" style={{
                    display: 'inline-block',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '7px 16px',
                    borderRadius: 100,
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}>
                    Template nutzen →
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 32 }}>
            Weitere Templates kommen regelmäßig dazu. Alle Premium-Templates sind in jedem Tarif enthalten.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          PREISE — Tarife
      ══════════════════════════════════════════════════════════════════ */}
      <section id="preise" style={{
        background: '#f5f4f0',
        padding: '80px 24px',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>
            Preise
          </p>
          <h2 style={{
            fontFamily: '"Plein", sans-serif',
            fontSize: 'clamp(32px, 4.5vw, 56px)',
            fontWeight: 400,
            color: '#111',
            letterSpacing: '-0.025em',
            textAlign: 'center',
            marginBottom: 16,
            lineHeight: 1.1,
          }}>
            Einfache Preise. Kein Kleingedrucktes.
          </h2>
          <p style={{ textAlign: 'center', fontSize: 15, color: '#777', marginBottom: 56 }}>
            Starte kostenlos — buche erst, wenn du überzeugt bist.
          </p>

          {/* Free tier banner */}
          <div style={{
            background: '#fff',
            borderRadius: 20,
            padding: '24px 32px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #ebebeb',
          }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 4 }}>Kostenlos für immer</p>
              <p style={{ fontSize: 13, color: '#888' }}>Erstelle unbegrenzt Entwürfe, nutze kostenlose Templates, teste alles ohne Kreditkarte.</p>
            </div>
            <div style={{ flexShrink: 0, marginLeft: 32 }}>
              <a href="/register" style={{ background: '#f0ede8', color: '#111', padding: '10px 24px', borderRadius: 100, fontSize: 14, fontWeight: 600, display: 'inline-block' }}>
                Kostenlos starten
              </a>
            </div>
          </div>

          {/* Paid plans */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {PLANS.map((plan) => (
              <div key={plan.key} style={{
                background: plan.popular ? '#1a2530' : '#fff',
                borderRadius: 24,
                padding: '36px 32px',
                border: plan.popular ? 'none' : '1px solid #ebebeb',
                position: 'relative',
              }}>
                {plan.popular && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#16A34A', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                    BELIEBTESTE WAHL
                  </div>
                )}
                <p style={{ fontSize: 13, fontWeight: 600, color: plan.popular ? 'rgba(255,255,255,0.5)' : '#888', marginBottom: 16 }}>{plan.name}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: '"Plein", sans-serif', fontSize: 48, fontWeight: 400, color: plan.popular ? '#fff' : '#111', letterSpacing: '-0.04em', lineHeight: 1 }}>€{plan.monthly}</span>
                  <span style={{ fontSize: 13, color: plan.popular ? 'rgba(255,255,255,0.4)' : '#aaa' }}>/Monat</span>
                </div>
                <p style={{ fontSize: 12, color: plan.popular ? 'rgba(255,255,255,0.35)' : '#bbb', marginBottom: 24 }}>
                  oder €{plan.yearly}/Jahr · 2 Monate gratis
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: plan.popular ? 'rgba(255,255,255,0.7)' : '#555', marginBottom: 20 }}>{plan.sites}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                  {plan.features.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.popular ? '#16A34A' : '#16A34A'} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span style={{ fontSize: 13, color: plan.popular ? 'rgba(255,255,255,0.65)' : '#555', lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>

                <a href="/register" style={{
                  display: 'block',
                  textAlign: 'center',
                  background: plan.popular ? '#fff' : '#111',
                  color: plan.popular ? '#1a2530' : '#fff',
                  padding: '13px 24px',
                  borderRadius: 100,
                  fontSize: 14,
                  fontWeight: 600,
                }}>
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#999', marginTop: 32 }}>
            Alle Preise inkl. MwSt. · Jederzeit kündbar · Keine versteckten Kosten
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════ */}
      <footer style={{ background: '#f5f4f0', padding: '28px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e8e5e0' }}>
        <img src="/logos/logo-black.svg" alt="FinestSites" style={{ height: 18, opacity: 0.4 }} />
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="/login" style={{ fontSize: 12, color: '#999' }}>Anmelden</a>
          <a href="/register" style={{ fontSize: 12, color: '#999' }}>Registrieren</a>
        </div>
        <span style={{ fontSize: 12, color: '#bbb' }}>© 2026 FinestSites</span>
      </footer>

    </div>
  )
}
