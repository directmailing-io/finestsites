/* ── FinestSites ClaimGuard: die KI-Prüfung der Texte, als Premium-Feature inszeniert ──
 * Dunkle Sektion mit leuchtender Wortmarke, drei Zeilen (was, wofür, Nutzen), Handy in der Hand.
 * Hinter dem Feature steckt /api/check-compliance (RichTextField im Editor, Publish-Gate). */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'

const POINTS = [
  { k: 'Prüft automatisch:', v: 'Jeder Text, den du schreibst, wird auf EU-Gesundheitsrecht geprüft.' },
  { k: 'Formuliert um:', v: 'Heikle Sätze werden markiert und sauber umgeschrieben. Ein Klick, übernommen.' },
  { k: 'Schützt dich:', v: 'Keine verbotenen Heilversprechen auf deiner Seite. Du gehst beruhigt online.' },
]

export default function ClaimGuardSection() {
  return (
    <section id="claimguard" style={{ position: 'relative', overflow: 'hidden', background: '#0A0A1E', color: '#fff' }}>
      <style>{`
        .cg-inner { position: relative; z-index: 1; max-width: 1120px; margin: 0 auto; padding: 96px 7vw; min-height: 720px; display: flex; align-items: center; }
        .cg-text { max-width: 600px; width: 56%; }
        /* Handy hängt unten rechts am Rand der Sektion, der Arm läuft aus dem Bild (wie auf dem Inspirationsbild) */
        .cg-phone { position: absolute; right: 0; bottom: 0; width: clamp(420px, 44vw, 640px); z-index: 1; pointer-events: none; }
        .cg-phone img { width: 100%; height: auto; display: block; filter: drop-shadow(0 30px 60px rgba(0,0,0,0.55)); }
        .cg-word {
          font-family: "Plus Jakarta Sans", sans-serif; font-weight: 700; letter-spacing: -0.035em; line-height: 1;
          font-size: clamp(56px, 8.5vw, 104px);
          background: linear-gradient(180deg, #F4ECFF 0%, #C9A3FF 55%, #9B6BF2 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          filter: drop-shadow(0 0 28px rgba(165,120,255,0.45));
          display: inline-block; position: relative;
        }
        .cg-spark { position: absolute; top: -0.22em; right: -0.42em; width: 0.42em; height: 0.42em; }
        .cg-glow { position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 60% 55% at 78% 50%, rgba(124,58,237,0.55) 0%, rgba(124,58,237,0) 70%),
            radial-gradient(ellipse 40% 40% at 15% 100%, rgba(80,40,160,0.35) 0%, rgba(80,40,160,0) 70%);
        }
        .cg-orbit { position: absolute; left: 50%; bottom: -120px; width: 1600px; height: 520px; transform: translateX(-50%); pointer-events: none; opacity: 0.9; }
        .cg-cta { display: inline-flex; align-items: center; justify-content: center; padding: 15px 30px; border-radius: 12px; font-size: 15px; font-weight: 700; color: #fff; text-decoration: none;
          background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); box-shadow: 0 10px 30px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.25); }
        .cg-pill { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 12px; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); }
        @media (max-width: 1023px) {
          .cg-inner { padding: 72px 5vw 0; min-height: 0; display: block; }
          .cg-text { max-width: 640px; width: auto; }
          .cg-phone { position: relative; width: auto; height: 500px; margin-top: 28px; }
          .cg-phone img { position: absolute; right: 0; bottom: 0; width: 440px; }
        }
        @media (max-width: 767px) {
          .cg-inner { padding: 56px 22px 0; }
          .cg-phone { height: 410px; margin-top: 20px; }
          .cg-phone img { width: 360px; }
          .cg-actions { flex-direction: column; align-items: stretch !important; }
          .cg-cta, .cg-pill { justify-content: center; }
        }
      `}</style>

      <div className="cg-glow" aria-hidden="true" />
      {/* feine Umlaufbahn wie auf dem Inspirationsbild */}
      <svg className="cg-orbit" viewBox="0 0 1600 520" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="cg-orbit-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#C9A3FF" stopOpacity="0" />
            <stop offset="0.5" stopColor="#D9C2FF" stopOpacity="0.55" />
            <stop offset="1" stopColor="#C9A3FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse cx="800" cy="260" rx="760" ry="220" stroke="url(#cg-orbit-g)" strokeWidth="1.5" />
      </svg>

      <div className="cg-inner">
        <div className="cg-text" style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#C9A3FF', letterSpacing: '0.01em', marginBottom: 10 }}>FinestSites</p>
          <h2 style={{ margin: '0 0 24px', lineHeight: 1 }}>
            <span className="cg-word">
              ClaimGuard
              <svg className="cg-spark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path d="M24 2c1.5 11.5 10.5 20.5 22 22-11.5 1.5-20.5 10.5-22 22-1.5-11.5-10.5-20.5-22-22C13.5 22.5 22.5 13.5 24 2z" fill="#F2E8FF" />
                <path d="M24 2c1.5 11.5 10.5 20.5 22 22-11.5 1.5-20.5 10.5-22 22-1.5-11.5-10.5-20.5-22-22C13.5 22.5 22.5 13.5 24 2z" fill="url(#cg-spark-g)" />
                <defs><radialGradient id="cg-spark-g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#C084FC" /></radialGradient></defs>
              </svg>
            </span>
          </h2>
          <p style={{ fontSize: 'clamp(18px, 2vw, 22px)', color: 'rgba(255,255,255,0.88)', lineHeight: 1.5, maxWidth: 560, marginBottom: 28, fontWeight: 500 }}>
            Deine Texte werden automatisch geprüft, bevor sie online gehen. Damit auf deiner Seite nichts steht, was nicht erlaubt ist.
          </p>

          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
            {POINTS.map(p => (
              <li key={p.k} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <span style={{ fontSize: 'clamp(15px, 1.5vw, 17px)', lineHeight: 1.5, color: 'rgba(255,255,255,0.78)' }}>
                  <strong style={{ color: '#fff', fontWeight: 700 }}>{p.k}</strong> {p.v}
                </span>
              </li>
            ))}
          </ul>

          <div className="cg-actions" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <a href={`${APP_URL}/register`} className="cg-cta">Kostenlos starten</a>
            <span className="cg-pill">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A3FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              In jedem Tarif inklusive
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 22, maxWidth: 520, lineHeight: 1.5 }}>
            ClaimGuard ist eine Hilfe, keine Rechtsberatung. Für die Inhalte deiner Seite bleibst du selbst verantwortlich.
          </p>
        </div>

      </div>

        <div className="cg-phone">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/claimguard-phone.webp" alt="ClaimGuard prüft einen Text im Editor auf dem Smartphone" loading="lazy" width={1000} height={1128} />
        </div>
    </section>
  )
}
