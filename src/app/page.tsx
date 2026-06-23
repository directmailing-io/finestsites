import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FinestSites – Deine professionelle Website in Minuten',
  description: 'Erstelle deine professionelle Produktwebsite ohne Technik-Kenntnisse. Perfekt für Network-Marketing-Profis. Templates, KI-geprüfte Texte, eigene Domain.',
}

export default function MarketingPage() {
  return (
    <main style={{ fontFamily: 'var(--font-geist-sans), -apple-system, sans-serif' }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>FinestSites</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', padding: '8px 16px' }}>
              Anmelden
            </Link>
            <Link href="/register" style={{
              fontSize: 14, fontWeight: 600, color: '#000', background: '#fff',
              textDecoration: 'none', padding: '8px 20px', borderRadius: 100,
              transition: 'opacity 0.15s',
            }}>
              Kostenlos starten
            </Link>
          </div>
        </div>
      </nav>

      {/* ── SECTION 1: HERO ──────────────────────────────────────────────── */}
      <section style={{
        background: '#0A0A0A',
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '120px 24px 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 800, height: 500,
          background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 100, padding: '6px 16px', marginBottom: 40,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
            Speziell für Network-Marketing-Profis
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(42px, 7vw, 88px)',
          fontWeight: 800,
          color: '#fff',
          textAlign: 'center',
          lineHeight: 1.05,
          letterSpacing: '-0.04em',
          maxWidth: 900,
          marginBottom: 24,
        }}>
          Deine professionelle
          <br />
          <span style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #6d28d9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Website in Minuten.</span>
        </h1>

        {/* Subline */}
        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)',
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          maxWidth: 560,
          lineHeight: 1.6,
          marginBottom: 48,
        }}>
          Wähle dein Template, passe deine Inhalte an — und deine Website ist live.
          Ohne Technik-Kenntnisse, ohne Agentur, ohne Aufwand.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 80 }}>
          <Link href="/register" style={{
            background: '#7c3aed', color: '#fff',
            textDecoration: 'none', fontWeight: 700, fontSize: 16,
            padding: '16px 36px', borderRadius: 100,
            boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
          }}>
            Jetzt kostenlos starten
          </Link>
          <Link href="#how-it-works" style={{
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            textDecoration: 'none', fontWeight: 600, fontSize: 16,
            padding: '16px 36px', borderRadius: 100,
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            Wie es funktioniert →
          </Link>
        </div>

        {/* Product mockup — browser window */}
        <div style={{
          width: '100%', maxWidth: 960,
          background: '#1a1a1a',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}>
          {/* Browser chrome */}
          <div style={{
            background: '#252525',
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => (
                <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <div style={{
              flex: 1, height: 28, background: 'rgba(255,255,255,0.05)',
              borderRadius: 8, display: 'flex', alignItems: 'center',
              justifyContent: 'center', maxWidth: 360, margin: '0 auto',
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>maria-mueller.finestsites.io</span>
            </div>
          </div>

          {/* Fake website preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 360 }}>
            {/* Left: editor panel */}
            <div style={{ background: '#141414', padding: 24, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Inhalte</div>
                {['Dein Name', 'Über mich', 'Mein Produkt', 'Kontakt'].map((label, i) => (
                  <div key={i} style={{
                    background: i === 1 ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                    border: i === 1 ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '10px 14px', marginBottom: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 13, color: i === 1 ? 'rgba(167,139,250,0.9)' : 'rgba(255,255,255,0.5)' }}>{label}</span>
                    {i === 1 && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>✓ Fertig</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: website preview */}
            <div style={{
              background: 'linear-gradient(160deg, #f8f0ff 0%, #fdf4ff 100%)',
              padding: '32px 28px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#7c3aed', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 22 }}>✦</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', marginBottom: 8, lineHeight: 1.2 }}>
                Maria Müller
                <br />
                <span style={{ color: '#7c3aed' }}>FitLine Partnerin</span>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.5 }}>
                Ich helfe dir, mehr Energie und Vitalität in deinen Alltag zu bringen.
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#7c3aed', color: '#fff', borderRadius: 100,
                padding: '8px 18px', fontSize: 12, fontWeight: 600, width: 'fit-content',
              }}>
                Mehr erfahren →
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: SOCIAL PROOF / ZAHLEN ────────────────────────────── */}
      <section style={{
        background: '#fff',
        padding: '80px 24px',
        borderBottom: '1px solid #f0f0f0',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 48 }}>
            Vertrauen in Zahlen
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 48,
          }}>
            {[
              { number: '< 5 Min', label: 'Von Template zur fertigen Website', sub: 'Kein Code, kein Designer nötig' },
              { number: '12+', label: 'Professionelle Templates', sub: 'Für jede Nische im Network Marketing' },
              { number: '100%', label: 'EU-rechtskonform', sub: 'KI-geprüfte Texte nach HCVO 1924/2006' },
              { number: '∞', label: 'Änderungen jederzeit', sub: 'Deine Website wächst mit dir' },
            ].map(({ number, label, sub }) => (
              <div key={number} style={{ padding: '24px 16px' }}>
                <div style={{
                  fontSize: 'clamp(36px, 5vw, 56px)',
                  fontWeight: 800,
                  color: '#0a0a0a',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  marginBottom: 12,
                }}>
                  {number}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: FEATURES ──────────────────────────────────────────── */}
      <section style={{
        background: '#F8FAFC',
        padding: '100px 24px',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
              Was FinestSites besonders macht
            </p>
            <h2 style={{
              fontSize: 'clamp(32px, 4vw, 52px)',
              fontWeight: 800, color: '#0a0a0a',
              letterSpacing: '-0.03em', lineHeight: 1.1,
              marginBottom: 20,
            }}>
              Alles was du brauchst.
              <br />Nichts was dich aufhält.
            </h2>
            <p style={{ fontSize: 17, color: '#6b7280', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
              Vom Template zur eigenen Domain — alles an einem Ort, in einer Oberfläche.
            </p>
          </div>

          {/* Feature grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
          }}>
            {[
              {
                icon: '⚡',
                iconBg: '#fef3c7',
                title: 'Blitzschnell live',
                desc: 'Wähle ein Template, trage deine Infos ein und veröffentliche mit einem Klick. Keine Technik-Vorkenntnisse nötig.',
              },
              {
                icon: '🛡',
                iconBg: '#f0fdf4',
                title: 'KI-Compliance-Check',
                desc: 'Vor der Veröffentlichung prüft unsere KI deinen Text automatisch auf verbotene Heil- und Wirkaussagen (HCVO).',
              },
              {
                icon: '🌐',
                iconBg: '#eff6ff',
                title: 'Eigene Domain',
                desc: 'Verbinde deine eigene Domain (z.B. maria-mueller.de) oder nutze deine kostenlose Subdomain auf finestsites.io.',
              },
              {
                icon: '✉️',
                iconBg: '#fdf4ff',
                title: 'Kontaktformular',
                desc: 'Eingehende Anfragen landen direkt in deiner Inbox. Alle Einreichungen übersichtlich im Dashboard.',
              },
              {
                icon: '📱',
                iconBg: '#fff1f2',
                title: 'Mobil perfekt',
                desc: 'Alle Templates sind responsiv und sehen auf Smartphone, Tablet und Desktop gleich professionell aus.',
              },
              {
                icon: '✏️',
                iconBg: '#f0fdf4',
                title: 'Jederzeit anpassbar',
                desc: 'Texte, Bilder, Farben — du kannst jederzeit alles ändern. Änderungen sind sofort live.',
              },
            ].map(({ icon, iconBg, title, desc }) => (
              <div key={title} style={{
                background: '#fff',
                borderRadius: 20,
                padding: '32px 28px',
                border: '1px solid #f0f0f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, marginBottom: 20,
                }}>
                  {icon}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 10, letterSpacing: '-0.02em' }}>
                  {title}
                </h3>
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: HOW IT WORKS ──────────────────────────────────────── */}
      <section id="how-it-works" style={{
        background: '#0A0A0A',
        padding: '100px 24px',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
              So einfach geht&apos;s
            </p>
            <h2 style={{
              fontSize: 'clamp(32px, 4vw, 52px)',
              fontWeight: 800, color: '#fff',
              letterSpacing: '-0.03em', lineHeight: 1.1,
              marginBottom: 20,
            }}>
              In 3 Schritten zur
              <br />eigenen Website.
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
              Kein Designer, keine Agentur, kein Technik-Stress.
            </p>
          </div>

          {/* Steps */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 2,
          }}>
            {[
              {
                step: '01',
                title: 'Template wählen',
                desc: 'Wähle aus unserer wachsenden Bibliothek das Template, das am besten zu deinem Produkt und deiner Marke passt.',
                detail: 'FitLine, Herbalife, PM International, und mehr',
              },
              {
                step: '02',
                title: 'Inhalte anpassen',
                desc: 'Trage deinen Namen, deine Story und deine Bilder ein. Unser Editor führt dich Schritt für Schritt durch.',
                detail: 'Kein Code — alles mit Klick und Tippen',
              },
              {
                step: '03',
                title: 'Veröffentlichen',
                desc: 'Mit einem Klick ist deine Website live. Optional: Verbinde deine eigene Domain für einen noch professionelleren Auftritt.',
                detail: 'Live in unter 60 Sekunden',
              },
            ].map(({ step, title, desc, detail }, i) => (
              <div key={step} style={{
                background: i === 1 ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${i === 1 ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: i === 0 ? '20px 0 0 20px' : i === 2 ? '0 20px 20px 0' : 0,
                padding: '40px 36px',
                position: 'relative',
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: i === 1 ? '#a78bfa' : 'rgba(255,255,255,0.2)',
                  letterSpacing: 2, marginBottom: 24,
                }}>
                  {step}
                </div>
                <h3 style={{
                  fontSize: 24, fontWeight: 700, color: '#fff',
                  letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.2,
                }}>
                  {title}
                </h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 24 }}>
                  {desc}
                </p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.06)', borderRadius: 100,
                  padding: '6px 14px',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: i === 1 ? '#a78bfa' : '#22c55e', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{detail}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CTA below steps */}
          <div style={{ textAlign: 'center', marginTop: 64 }}>
            <Link href="/register" style={{
              background: '#7c3aed', color: '#fff',
              textDecoration: 'none', fontWeight: 700, fontSize: 17,
              padding: '18px 48px', borderRadius: 100,
              boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
              display: 'inline-block',
            }}>
              Jetzt kostenlos starten
            </Link>
            <p style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
              Keine Kreditkarte nötig · Jederzeit kündbar
            </p>
          </div>
        </div>
      </section>

    </main>
  )
}
