import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FinestSites – Deine professionelle Website in Minuten',
  description: 'Erstelle deine professionelle Produktwebsite ohne Technik-Kenntnisse. Perfekt für Network-Marketing-Profis. Templates, KI-geprüfte Texte, eigene Domain.',
}

export default function HomePage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f0ede8', minHeight: '100vh' }}>

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
          <div style={{ fontWeight: 700, fontSize: 18, color: '#111', letterSpacing: '-0.03em' }}>FinestSites</div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            <a href="#features" style={{ color: '#555', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Features</a>
            <a href="#templates" style={{ color: '#555', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Templates</a>
            <a href="#preise" style={{ color: '#555', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Preise</a>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <a href="/login" style={{ color: '#111', fontSize: 14, fontWeight: 500, textDecoration: 'none', padding: '8px 16px' }}>Anmelden</a>
            <a href="/register" style={{
              background: '#111',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
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
        padding: '100px 40px 0',
        textAlign: 'center',
        overflow: 'hidden',
        minHeight: 560,
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#3a4a58', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 32 }}>
          Speziell für Network-Marketing-Profis
        </p>
        <h1 style={{
          fontSize: 'clamp(56px, 9vw, 118px)',
          fontWeight: 700,
          color: '#1a2530',
          lineHeight: 1.0,
          letterSpacing: '-0.04em',
          margin: '0 auto 32px',
          maxWidth: 900,
        }}>
          Deine Website.<br />In Minuten. Fertig.
        </h1>
        <p style={{
          fontSize: 18,
          color: '#3a4a58',
          lineHeight: 1.6,
          maxWidth: 480,
          margin: '0 auto 44px',
          fontWeight: 400,
        }}>
          Wähle ein Template, fülle deine Inhalte ein — und deine professionelle Produktwebsite ist live.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 60 }}>
          <a href="/register" style={{
            background: '#1a2530',
            color: '#fff',
            padding: '14px 32px',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-block',
          }}>Jetzt kostenlos starten</a>
          <a href="#features" style={{
            background: 'rgba(255,255,255,0.55)',
            color: '#1a2530',
            padding: '14px 32px',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-block',
            border: '1.5px solid rgba(26,37,48,0.18)',
          }}>So funktioniert es</a>
        </div>

        {/* Product mockup */}
        <div style={{
          background: '#1a2530',
          borderRadius: '20px 20px 0 0',
          padding: '16px 16px 0',
          maxWidth: 860,
          margin: '0 auto',
          boxShadow: '0 -4px 60px rgba(0,0,0,0.2)',
        }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 10, paddingLeft: 2 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFBD2E' }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28CA41' }} />
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 6, height: 18, marginLeft: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>maria-mueller.finestsites.io</span>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 220 }}>
              <div style={{ padding: 16, borderRight: '1px solid #f0f0f0', background: '#fafafa' }}>
                <p style={{ fontSize: 8, fontWeight: 700, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>INHALTE</p>
                {['Dein Name', 'Über mich', 'Mein Produkt', 'Kontakt'].map((label, i) => (
                  <div key={i} style={{
                    padding: '7px 9px',
                    borderRadius: 7,
                    marginBottom: 5,
                    background: i === 1 ? '#7c3aed' : '#fff',
                    border: i === 1 ? 'none' : '1px solid #ebebeb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 10, color: i === 1 ? '#fff' : '#333', fontWeight: i === 1 ? 600 : 400 }}>{label}</span>
                    {i === 1 && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>✓ Fertig</span>}
                  </div>
                ))}
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <span style={{ color: '#fff', fontSize: 18 }}>✦</span>
                </div>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 3 }}>Maria Müller</p>
                <p style={{ fontSize: 10, color: '#999' }}>Ernährungsberaterin · PM International</p>
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
        <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#7a5035', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 40 }}>
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
              <p style={{ fontSize: 30, fontWeight: 800, color: '#3a1f00', letterSpacing: '-0.04em', marginBottom: 6 }}>{stat.number}</p>
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
        <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          So einfach geht es
        </p>
        <h2 style={{
          textAlign: 'center',
          fontSize: 'clamp(32px, 5vw, 60px)',
          fontWeight: 700,
          color: '#111',
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
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
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111', letterSpacing: '-0.02em', marginBottom: 10 }}>{card.title}</h3>
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
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', marginBottom: 44, maxWidth: 420, margin: '0 auto 44px' }}>
          Kostenlos starten. Kein Kreditkarte nötig.
        </p>
        <a href="/register" style={{
          background: '#fff',
          color: '#1a2530',
          padding: '16px 44px',
          borderRadius: 100,
          fontSize: 16,
          fontWeight: 700,
          textDecoration: 'none',
          display: 'inline-block',
        }}>Jetzt kostenlos starten</a>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer style={{ padding: '28px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>FinestSites</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="/login" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>Anmelden</a>
          <a href="/register" style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}>Registrieren</a>
        </div>
        <span style={{ fontSize: 12, color: '#bbb' }}>© 2026 FinestSites</span>
      </footer>

    </div>
  )
}
