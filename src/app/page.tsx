import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FinestSites – Deine professionelle Website in Minuten',
  description: 'Erstelle deine professionelle Produktwebsite ohne Technik-Kenntnisse. Perfekt für Network-Marketing-Profis. Templates, KI-geprüfte Texte, eigene Domain.',
}

export default function HomePage() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f0ede8', minHeight: '100vh' }}>

      {/* ── Fonts ────────────────────────────────────────────────────────── */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" />
      <style>{`
        @font-face {
          font-family: 'Plein';
          src: url('/fonts/Plein-Bold.otf') format('opentype');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Plein';
          src: url('/fonts/Plein-Medium.otf') format('opentype');
          font-weight: 500;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Plein';
          src: url('/fonts/Plein-Regular.otf') format('opentype');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        a { text-decoration: none; }
      `}</style>

      {/* ── Floating Navbar ───────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 0', position: 'sticky', top: 20, zIndex: 100 }}>
        <nav style={{
          background: '#fff',
          borderRadius: 100,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          <div style={{ fontFamily: '"Plein", sans-serif', fontWeight: 700, fontSize: 18, color: '#111', letterSpacing: '-0.03em' }}>FinestSites</div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            <a href="#features" style={{ color: '#555', fontSize: 14, fontWeight: 500 }}>Features</a>
            <a href="#templates" style={{ color: '#555', fontSize: 14, fontWeight: 500 }}>Templates</a>
            <a href="#preise" style={{ color: '#555', fontSize: 14, fontWeight: 500 }}>Preise</a>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <a href="/login" style={{ color: '#111', fontSize: 14, fontWeight: 500, padding: '8px 16px' }}>Anmelden</a>
            <a href="/register" style={{
              background: '#111',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              padding: '9px 20px',
              borderRadius: 100,
            }}>Kostenlos starten</a>
          </div>
        </nav>
      </div>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <section style={{
        background: '#B8CCDB',
        margin: '20px 24px',
        borderRadius: 28,
        padding: '96px 40px 0',
        textAlign: 'center',
        overflow: 'hidden',
        minHeight: 580,
      }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#3a4a58', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 28 }}>
          Speziell für Network-Marketing-Profis
        </p>
        <h1 style={{
          fontFamily: '"Plein", sans-serif',
          fontSize: 'clamp(52px, 8.5vw, 112px)',
          fontWeight: 700,
          color: '#1a2530',
          lineHeight: 1.0,
          letterSpacing: '-0.04em',
          margin: '0 auto 28px',
          maxWidth: 900,
        }}>
          Deine Website.<br />In Minuten. Fertig.
        </h1>
        <p style={{
          fontSize: 17,
          color: '#3a4a58',
          lineHeight: 1.65,
          maxWidth: 460,
          margin: '0 auto 44px',
          fontWeight: 400,
        }}>
          Wähle ein Template, fülle deine Inhalte ein — und deine professionelle Produktwebsite ist live.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 56 }}>
          <a href="/register" style={{
            background: '#1a2530',
            color: '#fff',
            padding: '14px 32px',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 600,
            display: 'inline-block',
          }}>Jetzt kostenlos starten</a>
          <a href="#features" style={{
            background: 'rgba(255,255,255,0.55)',
            color: '#1a2530',
            padding: '14px 32px',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 600,
            display: 'inline-block',
            border: '1.5px solid rgba(26,37,48,0.18)',
          }}>So funktioniert es</a>
        </div>

        {/* ── Faithful Editor Mockup ── */}
        <div style={{
          background: '#1a2530',
          borderRadius: '18px 18px 0 0',
          padding: '14px 14px 0',
          maxWidth: 900,
          margin: '0 auto',
          boxShadow: '0 -6px 60px rgba(0,0,0,0.25)',
        }}>
          {/* Browser chrome dots + URL bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF5F57' }} />
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFBD2E' }} />
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28CA41' }} />
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>app.finestsites.io/sites/1/edit</span>
            </div>
          </div>

          {/* Editor UI */}
          <div style={{ background: 'white', borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>

            {/* ── Editor Header ── */}
            <div style={{
              background: 'white',
              borderBottom: '1px solid #E5E7EB',
              padding: '9px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              {/* Left */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {/* Back button */}
                <div style={{
                  width: 28, height: 28, borderRadius: 9,
                  background: '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5">
                    <path d="M19 12H5M12 5l-7 7 7 7"/>
                  </svg>
                </div>
                {/* Title + URL */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#111', lineHeight: 1.3 }}>NatureWell Pro</div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#9CA3AF', lineHeight: 1.3 }}>maria-m.finestsites.io</div>
                </div>
                {/* Live badge */}
                <div style={{
                  background: '#DCFCE7', color: '#16A34A',
                  fontSize: 9, fontWeight: 600,
                  padding: '3px 8px', borderRadius: 100,
                  flexShrink: 0,
                }}>● Live</div>
                {/* Autosave */}
                <div style={{ fontSize: 9, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Gespeichert
                </div>
              </div>
              {/* Right: action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {/* Live-Vorschau toggle (active = dark) */}
                <div style={{
                  background: '#1a1a1a', color: 'white',
                  fontSize: 9, fontWeight: 500,
                  padding: '5px 9px', borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  Live-Vorschau
                </div>
                {/* Vorschau button */}
                <div style={{
                  background: '#F3F4F6', color: '#374151',
                  fontSize: 9, fontWeight: 500,
                  padding: '5px 9px', borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  Vorschau
                </div>
                {/* Publish button */}
                <div style={{
                  background: '#1a1a1a', color: 'white',
                  fontSize: 9, fontWeight: 600,
                  padding: '5px 11px', borderRadius: 8,
                }}>Veröffentlichen</div>
              </div>
            </div>

            {/* ── Two-column body ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '176px 1fr', minHeight: 230 }}>

              {/* ── Left Sidebar ── */}
              <div style={{ borderRight: '1px solid #E5E7EB', padding: '12px 8px', background: 'white' }}>
                <p style={{ fontSize: 7.5, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 6px', marginBottom: 8 }}>
                  Abschnitte
                </p>
                {/* Section: Dein Name — complete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 9, marginBottom: 2 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </div>
                  <span style={{ fontSize: 10, color: '#374151', fontWeight: 400 }}>Dein Name</span>
                </div>
                {/* Section: Über mich — complete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 9, marginBottom: 2 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </div>
                  <span style={{ fontSize: 10, color: '#374151', fontWeight: 400 }}>Über mich</span>
                </div>
                {/* Section: Mein Produkt — ACTIVE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 9, marginBottom: 2, background: '#1a1a1a' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 8, color: 'white', fontWeight: 700 }}>3</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'white', fontWeight: 600 }}>Mein Produkt</span>
                </div>
                {/* Section: Kontakt — incomplete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 9, marginBottom: 2 }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 8, color: '#6B7280', fontWeight: 700 }}>4</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#374151', fontWeight: 400 }}>Kontakt</span>
                </div>
                {/* Domain */}
                <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 8, paddingTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 9 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 10, color: '#374151', fontWeight: 400 }}>Domain</span>
                  </div>
                </div>
              </div>

              {/* ── Right: Live Preview ── */}
              <div style={{ background: '#F9FAFB', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Preview label bar */}
                <div style={{ background: '#F3F4F6', borderBottom: '1px solid #E5E7EB', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                  <span style={{ fontSize: 8.5, color: '#6B7280', fontFamily: 'monospace' }}>maria-m.finestsites.io</span>
                </div>
                {/* Mini template preview */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {/* Hero */}
                  <div style={{ background: 'linear-gradient(135deg, #0f4c35 0%, #1a6b4a 100%)', padding: '20px 16px 18px', textAlign: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 14 }}>🌿</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '-0.02em', marginBottom: 3 }}>Maria Müller</div>
                    <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.7)' }}>Gesundheitsberaterin · PM International</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
                      <div style={{ background: '#22C55E', color: 'white', fontSize: 8, fontWeight: 600, padding: '4px 10px', borderRadius: 100 }}>Mehr erfahren</div>
                      <div style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 8, fontWeight: 500, padding: '4px 10px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.25)' }}>Kontakt</div>
                    </div>
                  </div>
                  {/* Active editing section: Mein Produkt */}
                  <div style={{ background: 'white', padding: '14px 16px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#1a1a1a', marginBottom: 8, letterSpacing: '-0.01em' }}>Mein Produkt</div>
                    {/* Text field being edited */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 7.5, fontWeight: 600, color: '#6B7280', marginBottom: 3 }}>Produktname</div>
                      <div style={{ border: '1.5px solid #3B82F6', borderRadius: 7, padding: '5px 8px', fontSize: 9, color: '#111', background: '#F8FAFF' }}>
                        FitLine Activize Oxyplus
                        <span style={{ display: 'inline-block', width: 1, height: 10, background: '#3B82F6', marginLeft: 1, verticalAlign: 'text-bottom', animation: 'none' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 7.5, fontWeight: 600, color: '#6B7280', marginBottom: 3 }}>Kurzbeschreibung</div>
                      <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 7, padding: '5px 8px', fontSize: 9, color: '#9CA3AF', background: 'white' }}>
                        Beschreibe dein Produkt in 1–2 Sätzen…
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── Stats / Social Proof ──────────────────────────────────────── */}
      <section style={{
        background: '#EDCBA8',
        margin: '20px 24px',
        borderRadius: 28,
        padding: '56px 40px',
      }}>
        <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#7a5035', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 40 }}>
          Alles was du brauchst
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, maxWidth: 880, margin: '0 auto' }}>
          {[
            { number: '< 5 Min', label: 'bis zur fertigen Website' },
            { number: '12+', label: 'professionelle Templates' },
            { number: '100%', label: 'EU-Compliance-geprüft' },
            { number: 'Keine', label: 'Technik-Kenntnisse nötig' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.5)',
              borderRadius: 20,
              padding: '28px 20px',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.7)',
            }}>
              <p style={{ fontFamily: '"Plein", sans-serif', fontSize: 30, fontWeight: 700, color: '#3a1f00', letterSpacing: '-0.04em', marginBottom: 6 }}>{stat.number}</p>
              <p style={{ fontSize: 13, color: '#7a5035', lineHeight: 1.4 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section id="features" style={{
        background: '#fff',
        margin: '20px 24px',
        borderRadius: 28,
        padding: '72px 40px',
      }}>
        <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          So einfach geht es
        </p>
        <h2 style={{
          fontFamily: '"Plein", sans-serif',
          textAlign: 'center',
          fontSize: 'clamp(32px, 5vw, 60px)',
          fontWeight: 700,
          color: '#111',
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
          maxWidth: 680,
          margin: '0 auto 56px',
        }}>
          In 3 Schritten zur eigenen Website.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 940, margin: '0 auto 56px' }}>
          {[
            { step: '01', title: 'Template wählen', desc: 'Wähle aus 12+ professionellen Templates für deine Branche und dein Produkt.', bg: '#B8CCDB' },
            { step: '02', title: 'Inhalte anpassen', desc: 'Fülle deine Texte, Bilder und Kontaktdaten ein — kein Code, kein Designer nötig.', bg: '#EDCBA8' },
            { step: '03', title: 'Veröffentlichen', desc: 'Mit einem Klick live — auf deiner Subdomain oder eigener Domain.', bg: '#C8D8B8' },
          ].map((card) => (
            <div key={card.step} style={{ background: card.bg, borderRadius: 20, padding: '36px 28px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.3)', letterSpacing: '0.06em', marginBottom: 20 }}>{card.step}</p>
              <h3 style={{ fontFamily: '"Plein", sans-serif', fontSize: 20, fontWeight: 700, color: '#111', letterSpacing: '-0.02em', marginBottom: 10 }}>{card.title}</h3>
              <p style={{ fontSize: 14, color: '#444', lineHeight: 1.65 }}>{card.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 940, margin: '0 auto' }}>
          {[
            { icon: '⚡', title: 'Blitzschnell live', desc: 'Deine Website ist in unter 5 Minuten fertig und öffentlich erreichbar.' },
            { icon: '✓', title: 'EU-Health-Claims-Check', desc: 'KI prüft deine Texte auf unzulässige Wirkaussagen. Kein Abmahnrisiko.' },
            { icon: '🌐', title: 'Eigene Domain', desc: 'Verbinde deine eigene Domain oder nutze deine kostenlose Subdomain.' },
            { icon: '📬', title: 'Kontaktformular', desc: 'Kundenanfragen landen direkt in deinem Postfach — vollautomatisch.' },
            { icon: '📱', title: 'Mobil optimiert', desc: 'Alle Templates sehen auf Handy, Tablet und Desktop perfekt aus.' },
            { icon: '✏️', title: 'Jederzeit änderbar', desc: 'Keine Agentur, kein Techniker. Änderungen in Sekunden selbst erledigt.' },
          ].map((f, i) => (
            <div key={i} style={{ background: '#fafafa', border: '1px solid #ebebeb', borderRadius: 16, padding: '24px 20px' }}>
              <span style={{ fontSize: 20, display: 'block', marginBottom: 10 }}>{f.icon}</span>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>{f.title}</h4>
              <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section style={{
        background: '#1a2530',
        margin: '20px 24px',
        borderRadius: 28,
        padding: '88px 40px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: '"Plein", sans-serif',
          fontSize: 'clamp(36px, 6vw, 72px)',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
          maxWidth: 680,
          margin: '0 auto 20px',
        }}>
          Bereit für deine Website?
        </h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', maxWidth: 420, margin: '0 auto 44px' }}>
          Kostenlos starten. Keine Kreditkarte nötig.
        </p>
        <a href="/register" style={{
          background: '#fff',
          color: '#1a2530',
          padding: '16px 44px',
          borderRadius: 100,
          fontSize: 16,
          fontWeight: 700,
          display: 'inline-block',
        }}>Jetzt kostenlos starten</a>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer style={{ padding: '28px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: '"Plein", sans-serif', fontSize: 14, fontWeight: 700, color: '#333' }}>FinestSites</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="/login" style={{ fontSize: 12, color: '#999' }}>Anmelden</a>
          <a href="/register" style={{ fontSize: 12, color: '#999' }}>Registrieren</a>
        </div>
        <span style={{ fontSize: 12, color: '#bbb' }}>© 2026 FinestSites</span>
      </footer>

    </div>
  )
}
