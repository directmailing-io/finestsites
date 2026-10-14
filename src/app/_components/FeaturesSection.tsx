/* ── Features: jedes Extra als eigener Logo-Schriftzug im Stil von ClaimGuard ──
 * Dunkle Fortsetzung der ClaimGuard-Sektion. Normale Namen (Farbwahl, QR-Code, …), aber jeder
 * Name als leuchtende Wortmarke mit eigenem Farbverlauf und Funken, dazu genau ein Satz.
 * Alles davon steckt in jedem Tarif, deshalb kein Tarif-Hinweis je Kachel. */

type Feature = {
  name: string
  text: string
  /** Verlauf der Wortmarke (oben hell, unten satt) */
  grad: string
  /** Farbe von Funken, Schein und Lichtkante */
  glow: string
  href?: string
}

const FEATURES: Feature[] = [
  { name: 'ClaimGuard', href: '#claimguard', glow: '#B08CFF', grad: 'linear-gradient(180deg, #F6EEFF 0%, #CDA8FF 55%, #9B6BF2 100%)',
    text: 'Deine Texte, automatisch geprüft auf Heil- und Wirkaussagen.' },
  { name: 'Farbwahl', glow: '#FF9ECF', grad: 'linear-gradient(90deg, #FF9ECF 0%, #FFB86B 35%, #7FE3C4 70%, #8AB4FF 100%)',
    text: 'Ein Klick, und die ganze Seite trägt deine Farbe.' },
  { name: '8 Sprachen', glow: '#5CCBFF', grad: 'linear-gradient(180deg, #EAF8FF 0%, #9BDCFF 55%, #38BDF8 100%)',
    text: 'Deine Seite spricht bis zu 8 Sprachen, automatisch übersetzt.' },
  { name: 'QR-Code', glow: '#E5E7EB', grad: 'linear-gradient(180deg, #FFFFFF 0%, #E5E7EB 55%, #9CA3AF 100%)',
    text: 'Für Flyer und Visitenkarte, fertig zum Drucken.' },
  { name: 'Linkseite', glow: '#5EEAD4', grad: 'linear-gradient(180deg, #ECFDF5 0%, #A7F3D0 55%, #34D399 100%)',
    text: 'Alle deine Links auf einer Seite, für Instagram und WhatsApp. Immer kostenlos.' },
  { name: 'Eigene Domain', glow: '#FCD34D', grad: 'linear-gradient(180deg, #FFFBEB 0%, #FDE68A 55%, #F59E0B 100%)',
    text: 'Deine eigene Internetadresse, z. B. max-mustermann.de.' },
  { name: 'Werbe-Tracking', glow: '#FB7185', grad: 'linear-gradient(180deg, #FFF1F2 0%, #FDA4AF 55%, #FB7185 100%)',
    text: 'Meta, Google und TikTok mit einem Klick verbunden. Werbung, die messbar ist.' },
  { name: 'Rechtstexte', glow: '#A5B4FC', grad: 'linear-gradient(180deg, #EEF2FF 0%, #C7D2FE 55%, #818CF8 100%)',
    text: 'Impressum und Datenschutz, automatisch erstellt und immer aktuell.' },
]

/* derselbe Funke wie bei der ClaimGuard-Wortmarke, in der Farbe des Features */
const Spark = ({ color, id }: { color: string; id: string }) => (
  <svg className="ft-spark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <path d="M24 2c1.5 11.5 10.5 20.5 22 22-11.5 1.5-20.5 10.5-22 22-1.5-11.5-10.5-20.5-22-22C13.5 22.5 22.5 13.5 24 2z" fill={`url(#${id})`} />
    <defs><radialGradient id={id} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor={color} /></radialGradient></defs>
  </svg>
)

export default function FeaturesSection() {
  return (
    <section id="features" style={{ position: 'relative', overflow: 'hidden', color: '#fff', background: 'linear-gradient(180deg, #150E3C 0%, #0C0A2C 40%, #07061C 100%)' }}>
      <style>{`
        .ft-pad { position: relative; z-index: 2; padding: 96px 7vw 110px; }
        .ft-inner { max-width: 1200px; margin: 0 auto; }
        .ft-glow { position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(ellipse 50% 40% at 15% 20%, rgba(139,92,246,0.22) 0%, rgba(139,92,246,0) 70%),
            radial-gradient(ellipse 45% 40% at 88% 75%, rgba(217,70,239,0.14) 0%, rgba(217,70,239,0) 70%);
        }
        .ft-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .ft-card {
          position: relative; display: block; padding: 34px 26px 32px; border-radius: 22px; overflow: hidden;
          text-decoration: none; color: inherit;
          background: linear-gradient(180deg, rgba(255,255,255,0.065) 0%, rgba(255,255,255,0.025) 100%);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
          transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
        }
        /* Schein in der Farbe des Features oben links, Lichtkante oben */
        .ft-card::before { content: ''; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 75% 60% at 12% 0%, var(--ft-glow-soft) 0%, transparent 70%); }
        .ft-card::after { content: ''; position: absolute; left: 20px; right: 20px; top: 0; height: 1px; pointer-events: none;
          background: linear-gradient(90deg, transparent, var(--ft-line), transparent); }
        a.ft-card:hover { transform: translateY(-4px); border-color: var(--ft-line); box-shadow: 0 30px 70px rgba(0,0,0,0.45), 0 0 40px var(--ft-glow-soft), inset 0 1px 0 rgba(255,255,255,0.12); }
        .ft-word {
          position: relative; display: inline-block; z-index: 1;
          font-family: "Plus Jakarta Sans", sans-serif; font-weight: 700; letter-spacing: -0.035em; line-height: 1.05;
          font-size: clamp(26px, 2.1vw, 29px); padding-right: 0.42em;
          background: var(--ft-grad); -webkit-background-clip: text; background-clip: text; color: transparent;
          filter: drop-shadow(0 0 16px var(--ft-shadow));
        }
        .ft-spark { position: absolute; top: -0.28em; right: 0; width: 0.46em; height: 0.46em; }
        .ft-text { position: relative; z-index: 1; margin: 14px 0 0; font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.72); }
        @media (max-width: 1023px) {
          .ft-pad { padding: 72px 5vw 84px; }
          .ft-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
          .ft-card { padding: 28px 22px 26px; }
          .ft-word { font-size: 29px; }
        }
        @media (max-width: 767px) {
          .ft-pad { padding: 56px 22px 64px; }
          .ft-grid { grid-template-columns: 1fr; gap: 12px; }
          .ft-card { padding: 24px 22px 24px; }
          .ft-word { font-size: 27px; }
          .ft-text { font-size: 14.5px; margin-top: 10px; }
        }
      `}</style>

      <div className="ft-glow" aria-hidden="true" />

      <div className="ft-pad"><div className="ft-inner">
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#C9A3FF', letterSpacing: '0.01em', marginBottom: 14 }}>Alles inklusive</p>
          <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(30px, 4vw, 52px)', fontWeight: 400, color: '#fff', letterSpacing: '-0.022em', lineHeight: 1.1, marginBottom: 16 }}>
            Alles drin. In jedem Tarif.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            Fertig eingebaut, kein Aufpreis.
          </p>
        </div>

        <div className="ft-grid">
          {FEATURES.map((f, i) => {
            const vars = {
              '--ft-grad': f.grad,
              '--ft-shadow': `${f.glow}66`,
              '--ft-glow-soft': `${f.glow}2E`,
              '--ft-line': `${f.glow}80`,
            } as React.CSSProperties
            const body = (
              <>
                <span className="ft-word">
                  {f.name}
                  <Spark color={f.glow} id={`ft-spark-${i}`} />
                </span>
                <p className="ft-text">{f.text}</p>
              </>
            )
            return f.href
              ? <a key={f.name} href={f.href} className="ft-card" style={vars}>{body}</a>
              : <div key={f.name} className="ft-card" style={vars}>{body}</div>
          })}
        </div>
      </div></div>
    </section>
  )
}
