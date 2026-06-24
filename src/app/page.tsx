import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import PricingSection from './_components/PricingSection'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'FinestSites – Deine professionelle Website in Minuten',
  description: 'Professionelle Produktwebsite für Network-Marketing-Profis. In unter 5 Minuten live. Keine Technik, keine Agentur.',
}

const PASTEL_COLORS = ['#D4C5E2', '#B8CCDB', '#EDCBA8', '#C8D8B8', '#F2C5C5', '#C5DFE0', '#EAD4B5', '#C5D4F2']


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
        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
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

          {/* 2×2 feature grid — all cards same lavender colour */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { img: '/features/5min-live.png',            title: 'In unter 5 Minuten live',             desc: 'Template wählen, Inhalte einfügen, fertig. Kein Designer, kein Technik-Stress.' },
              { img: '/features/kein-design.png',          title: 'Keine Texte, kein Design',             desc: 'Jede Vorlage ist professionell getextet, optimiert und rechtlich geprüft.' },
              { img: '/features/templates-verbessert.png', title: 'Laufend verbessert',                   desc: 'Neue Funktionen, bessere Conversion, aktuelles Design. Automatisch.' },
              { img: '/features/kein-hosting.png',         title: 'Kein Hosting, kein DSGVO-Stress',      desc: 'Hosting, Sicherheit, Datenschutz, Impressum. Alles inklusive.' },
            ].map((item, i) => (
              <div key={i} style={{ background: '#F5F0FB', border: '1px solid #D4C5E2', borderRadius: 20, padding: '22px 18px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
                <img src={item.img} alt="" style={{ width: 100, height: 100, objectFit: 'contain', display: 'block' }} />
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 6, lineHeight: 1.3 }}>{item.title}</h4>
                  <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TEMPLATES ════════════════════════════════════════════════════ */}
      <section id="templates" style={{ background: '#F9F7FF', padding: '96px 7vw' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <img src="/mascot.png" alt="" style={{ height: 104, width: 'auto', display: 'block' }} />
          </div>
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
                      {tpl.isFree ? (
                        <div style={{ position: 'absolute', top: 12, right: 12, background: '#16A34A', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 100 }}>KOSTENLOS</div>
                      ) : (
                        <div style={{ position: 'absolute', top: 12, right: 12, background: '#1a2530', color: '#D4C5E2', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 100 }}>PREMIUM</div>
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

      <PricingSection />

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
