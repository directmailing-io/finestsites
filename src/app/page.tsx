import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FinestSites – Deine professionelle Website in Minuten',
  description: 'Erstelle deine professionelle Produktwebsite ohne Technik-Kenntnisse. Perfekt für Network-Marketing-Profis. Templates, KI-geprüfte Texte, eigene Domain.',
}

export default function HomePage() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f0ede8', minHeight: '100vh' }}>

      {/* ── Fonts ─────────────────────────────────────────────────────── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" />
      <style>{`
        @font-face {
          font-family: 'Plein';
          src: url('/fonts/Plein-Regular.otf') format('opentype');
          font-weight: 400;
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
          src: url('/fonts/Plein-Bold.otf') format('opentype');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        a { text-decoration: none; }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════
          SEKTION 1 — Floating Nav + Hero
          Referenz: Vida — weiße Pill-Nav, blaues Hero-Panel, dünne Headline
      ══════════════════════════════════════════════════════════════════ */}

      {/* Floating Navbar */}
      <div style={{ padding: '20px 24px 0', position: 'sticky', top: 20, zIndex: 100 }}>
        <nav style={{
          background: '#fff',
          borderRadius: 100,
          padding: '10px 16px 10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 20px rgba(0,0,0,0.07)',
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          {/* Logo */}
          <img src="/logos/logo-black.svg" alt="FinestSites" style={{ height: 22, display: 'block' }} />

          {/* Nav links */}
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            <a href="#features" style={{ color: '#555', fontSize: 14, fontWeight: 500 }}>Features</a>
            <a href="#templates" style={{ color: '#555', fontSize: 14, fontWeight: 500 }}>Templates</a>
            <a href="#preise" style={{ color: '#555', fontSize: 14, fontWeight: 500 }}>Preise</a>
          </div>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href="/login" style={{
              color: '#111',
              fontSize: 14,
              fontWeight: 500,
              padding: '8px 18px',
              borderRadius: 100,
              border: '1.5px solid rgba(0,0,0,0.12)',
            }}>Anmelden</a>
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

      {/* Hero */}
      <section style={{
        background: '#B8CCDB',
        margin: '16px 24px',
        borderRadius: 28,
        padding: '120px 40px 140px',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#3a4a58',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 40,
        }}>
          Speziell für Network-Marketing-Profis
        </p>

        <h1 style={{
          fontFamily: '"Plein", sans-serif',
          fontSize: 'clamp(64px, 10vw, 132px)',
          fontWeight: 400,
          color: '#1a2530',
          lineHeight: 1.0,
          letterSpacing: '-0.025em',
          margin: '0 auto 36px',
          maxWidth: 960,
        }}>
          Deine Website.<br />In Minuten. Fertig.
        </h1>

        <p style={{
          fontSize: 18,
          color: '#3a4a58',
          lineHeight: 1.65,
          maxWidth: 480,
          margin: '0 auto 52px',
          fontWeight: 400,
        }}>
          Wähle ein Template, fülle deine Inhalte ein — und deine professionelle Produktwebsite ist live.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <a href="/register" style={{
            background: '#1a2530',
            color: '#fff',
            padding: '15px 36px',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 600,
            display: 'inline-block',
          }}>Jetzt kostenlos starten</a>
          <a href="#features" style={{
            background: 'rgba(255,255,255,0.5)',
            color: '#1a2530',
            padding: '15px 36px',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 600,
            display: 'inline-block',
            border: '1.5px solid rgba(26,37,48,0.15)',
          }}>Mehr erfahren</a>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SEKTION 2 — Stats / Social Proof (Pfirsich-Kacheln)
          Referenz: Vida — warme Hintergrundfarbe, große Zahlen, Stats-Grid
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: '#EDCBA8',
        margin: '0 24px 0',
        borderRadius: 28,
        padding: '80px 48px',
      }}>
        <p style={{
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 600,
          color: '#7a5035',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          Alles, was du brauchst
        </p>
        <h2 style={{
          fontFamily: '"Plein", sans-serif',
          textAlign: 'center',
          fontSize: 'clamp(32px, 4vw, 52px)',
          fontWeight: 400,
          color: '#3a1f00',
          letterSpacing: '-0.025em',
          marginBottom: 56,
          lineHeight: 1.15,
        }}>
          Deine professionelle Website.<br />Ohne Technik. Ohne Agentur.
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, maxWidth: 960, margin: '0 auto' }}>
          {[
            { number: '< 5 Min', label: 'bis zur fertigen Website' },
            { number: '12+', label: 'professionelle Templates' },
            { number: '100%', label: 'EU-Compliance-geprüft' },
            { number: 'Keine', label: 'Technik-Kenntnisse nötig' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.55)',
              borderRadius: 20,
              padding: '32px 24px',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.8)',
            }}>
              <p style={{
                fontFamily: '"Plein", sans-serif',
                fontSize: 34,
                fontWeight: 400,
                color: '#3a1f00',
                letterSpacing: '-0.03em',
                marginBottom: 8,
              }}>{stat.number}</p>
              <p style={{ fontSize: 13, color: '#7a5035', lineHeight: 1.4 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SEKTION 3 — Features / So funktioniert es (Weiß)
          Referenz: Vida — weißer Hintergrund, große Heading, Bento-Grid
      ══════════════════════════════════════════════════════════════════ */}
      <section id="features" style={{
        background: '#fff',
        margin: '16px 24px',
        borderRadius: 28,
        padding: '88px 48px',
      }}>
        <p style={{
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 600,
          color: '#bbb',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          So einfach geht es
        </p>
        <h2 style={{
          fontFamily: '"Plein", sans-serif',
          textAlign: 'center',
          fontSize: 'clamp(36px, 5vw, 64px)',
          fontWeight: 400,
          color: '#111',
          letterSpacing: '-0.025em',
          lineHeight: 1.05,
          maxWidth: 720,
          margin: '0 auto 64px',
        }}>
          In 3 Schritten zur eigenen Website.
        </h2>

        {/* Steps grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 960, margin: '0 auto 16px' }}>
          {[
            { step: '01', title: 'Template wählen', desc: 'Wähle aus 12+ professionellen Templates für deine Branche und dein Produkt.', bg: '#B8CCDB' },
            { step: '02', title: 'Inhalte anpassen', desc: 'Fülle deine Texte, Bilder und Kontaktdaten ein — kein Code, kein Designer nötig.', bg: '#EDCBA8' },
            { step: '03', title: 'Veröffentlichen', desc: 'Mit einem Klick live — auf deiner Subdomain oder deiner eigenen Domain.', bg: '#C8D8B8' },
          ].map((card) => (
            <div key={card.step} style={{ background: card.bg, borderRadius: 20, padding: '40px 32px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.28)', letterSpacing: '0.06em', marginBottom: 24 }}>{card.step}</p>
              <h3 style={{
                fontFamily: '"Plein", sans-serif',
                fontSize: 22,
                fontWeight: 500,
                color: '#111',
                letterSpacing: '-0.02em',
                marginBottom: 12,
              }}>{card.title}</h3>
              <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>{card.desc}</p>
            </div>
          ))}
        </div>

        {/* Feature grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 960, margin: '0 auto' }}>
          {[
            { icon: '⚡', title: 'Blitzschnell live', desc: 'Deine Website ist in unter 5 Minuten fertig und öffentlich erreichbar.' },
            { icon: '✓', title: 'EU-Health-Claims-Check', desc: 'KI prüft deine Texte auf unzulässige Wirkaussagen. Kein Abmahnrisiko.' },
            { icon: '🌐', title: 'Eigene Domain', desc: 'Verbinde deine eigene Domain oder nutze deine kostenlose Subdomain.' },
            { icon: '📬', title: 'Kontaktformular', desc: 'Kundenanfragen landen direkt in deinem Postfach — vollautomatisch.' },
            { icon: '📱', title: 'Mobil optimiert', desc: 'Alle Templates sehen auf Handy, Tablet und Desktop perfekt aus.' },
            { icon: '✏️', title: 'Jederzeit änderbar', desc: 'Keine Agentur, kein Techniker. Änderungen in Sekunden selbst erledigt.' },
          ].map((f, i) => (
            <div key={i} style={{ background: '#fafafa', border: '1px solid #ebebeb', borderRadius: 16, padding: '28px 24px' }}>
              <span style={{ fontSize: 22, display: 'block', marginBottom: 12 }}>{f.icon}</span>
              <h4 style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 8 }}>{f.title}</h4>
              <p style={{ fontSize: 13, color: '#666', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SEKTION 4 — CTA (Dunkel)
          Referenz: Vida — schwarzer/dunkler Bereich, große dünne Headline, Pill-Button
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: '#1a2530',
        margin: '16px 24px',
        borderRadius: 28,
        padding: '100px 48px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: '"Plein", sans-serif',
          fontSize: 'clamp(40px, 6.5vw, 88px)',
          fontWeight: 400,
          color: '#fff',
          letterSpacing: '-0.025em',
          lineHeight: 1.0,
          maxWidth: 720,
          margin: '0 auto 24px',
        }}>
          Bereit für deine Website?
        </h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', marginBottom: 52, maxWidth: 380, margin: '0 auto 52px' }}>
          Kostenlos starten. Keine Kreditkarte nötig.
        </p>
        <a href="/register" style={{
          background: '#fff',
          color: '#1a2530',
          padding: '16px 48px',
          borderRadius: 100,
          fontSize: 16,
          fontWeight: 600,
          display: 'inline-block',
        }}>Jetzt kostenlos starten</a>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <img src="/logos/logo-black.svg" alt="FinestSites" style={{ height: 18, opacity: 0.5 }} />
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="/login" style={{ fontSize: 12, color: '#999' }}>Anmelden</a>
          <a href="/register" style={{ fontSize: 12, color: '#999' }}>Registrieren</a>
        </div>
        <span style={{ fontSize: 12, color: '#bbb' }}>© 2026 FinestSites</span>
      </footer>

    </div>
  )
}
