/* ── FinestSites ClaimGuard: die KI-Prüfung der Texte, als Premium-Feature inszeniert ──
 * Dunkle Sektion mit leuchtender Wortmarke, drei Zeilen (was, wofür, Nutzen), Handy in der Hand.
 * Hinter dem Feature steckt /api/check-compliance (RichTextField im Editor, Publish-Gate).
 * Der dunkle Hintergrund (Verlauf, Lichter, Sterne, Korn) liegt auf einem Wrapper, der auch die
 * nachfolgende Feature-Sektion (children) umschließt, damit beide ohne Kante ineinander übergehen. */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'

const POINTS = [
  { k: 'Prüft jeden Satz, den du schreibst.', v: 'Wörter wie „heilt“ oder „hilft bei“ fallen sofort auf.' },
  { k: 'Macht dir einen erlaubten Vorschlag.', v: 'Du klickst einmal, und der Satz ist ersetzt.' },
  { k: 'Erst wenn alles passt, geht die Seite online.', v: 'So bist du auf der sicheren Seite.' },
]

/* feines Korn für den Hintergrund (SVG-Rauschen, sehr schwach) */
const NOISE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.07 0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>\")"

export default function ClaimGuardSection({ children }: { children?: React.ReactNode }) {
  return (
    <div className="cg-wrap" style={{ position: 'relative', overflow: 'hidden', color: '#fff', background: 'linear-gradient(180deg, #06061A 0%, #0B0A2A 28%, #150E3C 52%, #0C0A2C 78%, #07061C 100%)' }}>
      <style>{`
        .cg-inner { position: relative; z-index: 2; max-width: 1120px; margin: 0 auto; padding: 100px 7vw; min-height: 740px; display: flex; align-items: center; }
        .cg-text { max-width: 560px; width: 56%; }
        /* Handy hängt unten rechts am Rand der Sektion, der Arm läuft aus dem Bild */
        .cg-phone { position: absolute; right: 0; bottom: 0; width: clamp(400px, 40vw, 580px); z-index: 2; pointer-events: none; }
        .cg-phone img { width: 100%; height: auto; display: block; filter: drop-shadow(0 30px 60px rgba(0,0,0,0.6)); }
        .cg-word {
          font-family: "Plus Jakarta Sans", sans-serif; font-weight: 700; letter-spacing: -0.035em; line-height: 1;
          font-size: clamp(56px, 8.5vw, 104px);
          background: linear-gradient(180deg, #F6EEFF 0%, #CDA8FF 55%, #9B6BF2 100%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          filter: drop-shadow(0 0 30px rgba(165,120,255,0.5));
          display: inline-block; position: relative;
        }
        .cg-spark { position: absolute; top: -0.22em; right: -0.42em; width: 0.42em; height: 0.42em; }
        /* Lichter: großer Schein hinter dem Handy, kleiner links unten, Sterne, Korn, Lichtkante oben */
        .cg-glow { position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(ellipse 55% 440px at 80% 460px, rgba(139,92,246,0.62) 0%, rgba(139,92,246,0) 68%),
            radial-gradient(ellipse 36% 240px at 62% 800px, rgba(217,70,239,0.28) 0%, rgba(217,70,239,0) 70%),
            radial-gradient(ellipse 40% 280px at 8% 720px, rgba(76,29,149,0.45) 0%, rgba(76,29,149,0) 70%),
            radial-gradient(ellipse 50% 220px at 50% -40px, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0) 70%),
            radial-gradient(ellipse 45% 320px at 12% 1100px, rgba(139,92,246,0.20) 0%, rgba(139,92,246,0) 70%),
            radial-gradient(ellipse 45% 320px at 90% 1500px, rgba(217,70,239,0.14) 0%, rgba(217,70,239,0) 70%);
        }
        .cg-stars { position: absolute; inset: 0; pointer-events: none; z-index: 0; opacity: 0.9; background-size: 100% 900px; background-repeat: repeat-y;
          background-image:
            radial-gradient(1.2px 1.2px at 12% 18%, rgba(255,255,255,0.8) 50%, transparent 51%),
            radial-gradient(1px 1px at 28% 72%, rgba(255,255,255,0.55) 50%, transparent 51%),
            radial-gradient(1.5px 1.5px at 46% 12%, rgba(255,255,255,0.7) 50%, transparent 51%),
            radial-gradient(1px 1px at 58% 38%, rgba(255,255,255,0.5) 50%, transparent 51%),
            radial-gradient(1.2px 1.2px at 70% 16%, rgba(255,255,255,0.75) 50%, transparent 51%),
            radial-gradient(1px 1px at 86% 28%, rgba(255,255,255,0.6) 50%, transparent 51%),
            radial-gradient(1.4px 1.4px at 92% 70%, rgba(255,255,255,0.7) 50%, transparent 51%),
            radial-gradient(1px 1px at 36% 50%, rgba(255,255,255,0.45) 50%, transparent 51%),
            radial-gradient(1px 1px at 6% 56%, rgba(255,255,255,0.5) 50%, transparent 51%),
            radial-gradient(1.3px 1.3px at 78% 88%, rgba(255,255,255,0.6) 50%, transparent 51%);
        }
        .cg-noise { position: absolute; inset: 0; pointer-events: none; z-index: 1; background-image: ${NOISE}; opacity: 0.5; mix-blend-mode: overlay; }
        .cg-edge { position: absolute; left: 0; right: 0; top: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(201,163,255,0.45), transparent); z-index: 1; }
        .cg-section { position: relative; z-index: 2; }
        .cg-orbit { position: absolute; left: 50%; bottom: 40px; width: 1700px; height: 300px; transform: translateX(-50%); pointer-events: none; z-index: 1; }
        .cg-cta { display: inline-flex; align-items: center; justify-content: center; padding: 15px 32px; border-radius: 100px; font-size: 15px; font-weight: 700; color: #fff; text-decoration: none;
          background: linear-gradient(135deg, #9F67FF 0%, #6D28D9 100%); box-shadow: 0 12px 34px rgba(124,58,237,0.5), inset 0 1px 0 rgba(255,255,255,0.3); }
        .cg-pill { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 100px; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); backdrop-filter: blur(6px); }
        @media (max-width: 1023px) {
          .cg-inner { padding: 72px 5vw 0; min-height: 0; display: block; }
          .cg-text { max-width: 640px; width: auto; }
          .cg-phone { position: relative; width: auto; margin: 28px -5vw 0 0; display: flex; justify-content: flex-end; }
          .cg-phone img { width: min(100%, 460px); }
          .cg-orbit { opacity: 0.6; bottom: 40%; }
        }
        @media (max-width: 767px) {
          .cg-inner { padding: 56px 22px 0; }
          .cg-phone { margin: 20px -22px 0 0; }
          .cg-phone img { width: 100%; }
          .cg-actions { flex-direction: column; align-items: stretch !important; }
          .cg-cta, .cg-pill { justify-content: center; }
        }
      `}</style>

      <div className="cg-glow" aria-hidden="true" />
      <div className="cg-stars" aria-hidden="true" />
      <div className="cg-noise" aria-hidden="true" />
      <div className="cg-edge" aria-hidden="true" />

      <section id="claimguard" className="cg-section">
      {/* feiner Lichtbogen nur hinter dem Handy (rechte Hälfte eines oberen Bogens, links ausgeblendet) */}
      <svg className="cg-orbit" viewBox="0 0 1700 300" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="cg-orbit-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#C9A3FF" stopOpacity="0" />
            <stop offset="0.42" stopColor="#C9A3FF" stopOpacity="0" />
            <stop offset="0.72" stopColor="#E2CFFF" stopOpacity="0.65" />
            <stop offset="1" stopColor="#C9A3FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M40 300 A810 236 0 0 1 1660 300" stroke="url(#cg-orbit-g)" strokeWidth="1.5" />
        <path d="M150 300 A700 200 0 0 1 1550 300" stroke="url(#cg-orbit-g)" strokeWidth="1" opacity="0.45" />
      </svg>

      <div className="cg-inner">
        <div className="cg-text">
          <p style={{ fontSize: 15, fontWeight: 700, color: '#C9A3FF', letterSpacing: '0.01em', marginBottom: 10 }}>FinestSites</p>
          <h2 style={{ margin: '0 0 24px', lineHeight: 1 }}>
            <span className="cg-word">
              ClaimGuard
              <svg className="cg-spark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path d="M24 2c1.5 11.5 10.5 20.5 22 22-11.5 1.5-20.5 10.5-22 22-1.5-11.5-10.5-20.5-22-22C13.5 22.5 22.5 13.5 24 2z" fill="url(#cg-spark-g)" />
                <defs><radialGradient id="cg-spark-g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#C084FC" /></radialGradient></defs>
              </svg>
            </span>
          </h2>
          <p style={{ fontSize: 'clamp(20px, 2.2vw, 26px)', color: '#fff', lineHeight: 1.35, maxWidth: 520, marginBottom: 30, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Du schreibst deinen Text. Die KI prüft ihn auf Heil- und Wirkaussagen.
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
        <img
          src="/claimguard-phone.webp"
          srcSet="/claimguard-phone-480.webp 480w, /claimguard-phone.webp 900w"
          sizes="(max-width: 767px) 100vw, (max-width: 1023px) 460px, 40vw"
          alt="ClaimGuard prüft einen Text im Editor auf dem Smartphone" loading="lazy" decoding="async" width={900} height={1036}
        />
      </div>
      </section>

      {children}
    </div>
  )
}
