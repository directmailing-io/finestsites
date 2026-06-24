import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'FinestSites – Deine professionelle Website in Minuten',
  description: 'Professionelle Produktwebsite für Network-Marketing-Profis. In unter 5 Minuten live. Keine Technik, keine Agentur.',
}

const PASTEL_COLORS = ['#D4C5E2', '#B8CCDB', '#EDCBA8', '#C8D8B8', '#F2C5C5', '#C5DFE0', '#EAD4B5', '#C5D4F2']

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    monthly: 20,
    yearly: 200,
    sites: '1 aktive Website',
    features: ['Deine eigene Webadresse (z.B. barbaramueller.finestsites.io)', 'SSL-Verschlüsselung und rechtlich abgesichert', 'Kontaktformular inklusive', 'In unter 5 Minuten live', 'Alle Templates inklusive'],
    popular: false,
    cta: 'Jetzt starten',
  },
  {
    key: 'pro',
    name: 'Pro',
    monthly: 30,
    yearly: 300,
    sites: '3 aktive Websites',
    features: ['Alles aus Starter', 'EU-Health-Claims-Check (KI)', 'Deine eigene Wunsch-Adresse (z.B. www.barbaramueller.de)', 'Prioritäts-Support', '3 Websites gleichzeitig'],
    popular: true,
    cta: 'Beliebteste Wahl',
  },
  {
    key: 'unlimited',
    name: 'Unlimited',
    monthly: 50,
    yearly: 500,
    sites: 'Unbegrenzt Websites',
    features: ['Alles aus Pro', 'Unbegrenzt viele Websites', 'Frühzeitiger Template-Zugang', 'Persönlicher Onboarding-Call', 'Team-Verwaltung (bald)'],
    popular: false,
    cta: 'Jetzt starten',
  },
]

export default async function HomePage() {
  // Fetch real published templates from DB
  let templateList: { id: string; title: string; description: string | null; domain: string; isFree: boolean; previewImages: unknown }[] = []
  try {
    templateList = await db
      .select({
        id: templates.id,
        title: templates.title,
        description: templates.description,
        domain: templates.domain,
        isFree: templates.isFree,
        previewImages: templates.previewImages,
      })
      .from(templates)
      .where(and(eq(templates.status, 'published'), eq(templates.isTest, false)))
      .orderBy(templates.createdAt)
  } catch {
    // Fallback: show nothing if DB unavailable on marketing page
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
      `}</style>

      {/* ══ NAV ══════════════════════════════════════════════════════════ */}
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

      {/* ══ HERO ═════════════════════════════════════════════════════════ */}
      <section style={{
        width: '100%',
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: '#f5f3f0',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/hero-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, #ffffff 30%, rgba(255,255,255,0.88) 42%, rgba(255,255,255,0.2) 58%, rgba(255,255,255,0) 70%)',
        }} />

        <div style={{ position: 'relative', zIndex: 2, padding: '130px 7vw 90px', maxWidth: '56vw' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>
            Für Network-Marketing-Profis
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
            Wenn Kunden auf dich<br />zukommen, nicht<br />umgekehrt.
          </h1>
          <p style={{ fontSize: 16, color: '#555', lineHeight: 1.75, marginBottom: 40, maxWidth: 460 }}>
            Erstklassige Webseite für dein Network Marketing in unter 5 Minuten live. Interessenten melden sich bei dir, nicht du bei ihnen. So einfach, dass es eine Oma hinbekommt.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/register" style={{ background: '#111', color: '#fff', padding: '15px 36px', borderRadius: 100, fontSize: 15, fontWeight: 600, display: 'inline-block' }}>Kostenlos starten</a>
            <a href="#templates" style={{ background: 'rgba(255,255,255,0.8)', color: '#111', padding: '15px 36px', borderRadius: 100, fontSize: 15, fontWeight: 500, display: 'inline-block', border: '1.5px solid rgba(0,0,0,0.12)' }}>Templates ansehen</a>
          </div>
          <p style={{ marginTop: 20, fontSize: 13, color: '#999' }}>Keine Kreditkarte nötig · In 5 Minuten live</p>
        </div>
      </section>

      {/* ══ WAS IST FINESTSITES ══════════════════════════════════════════ */}
      <section id="was-ist" style={{ background: '#fff', padding: '96px 7vw' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Das Problem</p>
            <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 400, color: '#111', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 24 }}>
              Du hast ein tolles Produkt.<br />Aber niemand weiss davon.
            </h2>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, marginBottom: 20 }}>
              Die meisten Network-Marketer kämpfen täglich darum, neue Interessenten zu finden. Du postest, chattest, rufst an und trotzdem bleibt der Durchbruch aus.
            </p>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75 }}>
              <strong style={{ color: '#111' }}>FinestSites ändert das.</strong> Du bekommst eine professionelle Produktwebsite, die für dich arbeitet. 24/7, auch wenn du schläfst.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: '⚡', bg: '#D4C5E2', title: 'In unter 5 Minuten live', desc: 'Kein Designer, kein Entwickler, kein Technik-Stress. Template wählen, Inhalte einfügen, fertig.' },
              { icon: '✏️', bg: '#EDCBA8', title: 'Keine Texte ausdenken, kein Design', desc: 'Jede Vorlage ist professionell getextet, auf die Branche optimiert und rechtlich geprüft. Du musst nichts erfinden.' },
              { icon: '🔄', bg: '#C8D8B8', title: 'Templates werden laufend verbessert', desc: 'Wir optimieren deine Website kontinuierlich. Neue Funktionen, bessere Conversion, aktuelles Design. Ohne dass du etwas tun musst.' },
              { icon: '✓', bg: '#B8CCDB', title: 'Kein Hosting, kein DSGVO-Stress', desc: 'Wir kümmern uns um alles: Hosting, Sicherheit, Datenschutz, Impressum. Du musst dich um nichts davon kümmern.' },
            ].map((item, i) => (
              <div key={i} style={{ background: item.bg + '33', border: `1px solid ${item.bg}`, borderRadius: 16, padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 4 }}>{item.title}</h4>
                  <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TEMPLATES ════════════════════════════════════════════════════ */}
      <section id="templates" style={{ background: '#F9F7FF', padding: '96px 7vw' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>Vorlagen</p>
          <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', textAlign: 'center', marginBottom: 16, lineHeight: 1.1 }}>
            Wähle dein Template.
          </h2>
          <p style={{ textAlign: 'center', fontSize: 16, color: '#777', marginBottom: 52, maxWidth: 480, margin: '0 auto 52px' }}>
            Alle Templates entwickelt für Network-Marketing-Profis. Professionell, schnell und ohne technisches Vorwissen.
          </p>

          {templateList.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', fontSize: 14 }}>Bald verfügbar.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {templateList.map((tpl, i) => {
                const pastel = PASTEL_COLORS[i % PASTEL_COLORS.length]
                const images = Array.isArray(tpl.previewImages) ? tpl.previewImages as string[] : []
                const coverImg = images[0] ?? null
                return (
                  <div key={tpl.id} style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', border: '1px solid #ebebeb', boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
                    {/* Preview */}
                    <div style={{ height: 180, background: pastel, position: 'relative', overflow: 'hidden' }}>
                      {coverImg ? (
                        <img src={coverImg} alt={tpl.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tpl.domain}</div>
                          </div>
                        </div>
                      )}
                      {tpl.isFree && (
                        <div style={{ position: 'absolute', top: 12, right: 12, background: '#16A34A', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 100 }}>KOSTENLOS</div>
                      )}
                    </div>
                    {/* Info */}
                    <div style={{ padding: '20px 22px' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 6 }}>{tpl.title}</h3>
                      {tpl.description && <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, marginBottom: 16 }}>{tpl.description}</p>}
                      <a href="/register" style={{ display: 'inline-block', background: '#f5f3f0', color: '#333', fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 100, border: '1px solid #e5e5e5' }}>
                        Template nutzen
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ══ PREISE ═══════════════════════════════════════════════════════ */}
      <section id="preise" style={{ background: '#fff', padding: '96px 7vw' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>Preise</p>
          <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(32px, 4.5vw, 56px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', textAlign: 'center', marginBottom: 16, lineHeight: 1.1 }}>
            Einfache Preise. Kein Kleingedrucktes.
          </h2>
          <p style={{ textAlign: 'center', fontSize: 15, color: '#777', marginBottom: 56 }}>
            Registriere dich kostenlos und buche direkt den passenden Tarif.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {PLANS.map((plan) => (
              <div key={plan.key} style={{
                background: plan.popular ? '#1a2530' : '#fff',
                borderRadius: 24,
                padding: '36px 32px',
                border: plan.popular ? 'none' : '1px solid #ebebeb',
                position: 'relative',
                boxShadow: plan.popular ? '0 8px 40px rgba(26,37,48,0.18)' : 'none',
              }}>
                {plan.popular && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#D4C5E2', color: '#4a3060', fontSize: 11, fontWeight: 700, padding: '4px 16px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                    BELIEBTESTE WAHL
                  </div>
                )}
                <p style={{ fontSize: 13, fontWeight: 600, color: plan.popular ? 'rgba(255,255,255,0.45)' : '#888', marginBottom: 16 }}>{plan.name}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: '"Plein", sans-serif', fontSize: 52, fontWeight: 400, color: plan.popular ? '#fff' : '#111', letterSpacing: '-0.04em', lineHeight: 1 }}>€{plan.monthly}</span>
                  <span style={{ fontSize: 13, color: plan.popular ? 'rgba(255,255,255,0.35)' : '#aaa' }}>/Monat</span>
                </div>
                <p style={{ fontSize: 12, color: plan.popular ? 'rgba(255,255,255,0.3)' : '#bbb', marginBottom: 24 }}>oder €{plan.yearly}/Jahr · 2 Monate gratis</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: plan.popular ? 'rgba(255,255,255,0.65)' : '#555', marginBottom: 20 }}>{plan.sites}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                  {plan.features.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.popular ? '#D4C5E2' : '#16A34A'} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize: 13, color: plan.popular ? 'rgba(255,255,255,0.6)' : '#555', lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <a href="/register" style={{ display: 'block', textAlign: 'center', background: plan.popular ? '#D4C5E2' : '#111', color: plan.popular ? '#3a2060' : '#fff', padding: '13px 24px', borderRadius: 100, fontSize: 14, fontWeight: 600 }}>
                  {plan.popular ? 'Pro wählen' : plan.cta}
                </a>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#bbb', marginTop: 32 }}>Alle Preise inkl. MwSt. · Jederzeit kündbar · Keine versteckten Kosten</p>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer style={{ background: '#f5f3f0', padding: '28px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee' }}>
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
