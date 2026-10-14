/* ── Features: jedes Extra als eigener Logo-Schriftzug im Stil von ClaimGuard ──
 * Liegt im dunklen Wrapper der ClaimGuardSection (gemeinsamer Hintergrund). Normale Namen
 * (Farbwahl, QR-Code, …), jeder als leuchtende Wortmarke mit eigenem Farbverlauf, dazu genau
 * ein Satz. ClaimGuard selbst hat seine eigene Sektion darüber und taucht hier nicht nochmal auf.
 * Alles davon steckt in jedem Tarif, deshalb kein Tarif-Hinweis je Kachel. */

type Feature = {
  name: string
  text: string
  /** Verlauf der Wortmarke (oben hell, unten satt) */
  grad: string
  /** Farbe von Schein und Lichtkante */
  glow: string
}

const FEATURES: Feature[] = [
  { name: 'Farbwahl', glow: '#FF9ECF', grad: 'linear-gradient(90deg, #FF9ECF 0%, #FFB86B 35%, #7FE3C4 70%, #8AB4FF 100%)',
    text: 'Wähle deine Farbe, und die ganze Seite passt sich an.' },
  { name: 'Mehrsprachig', glow: '#5CCBFF', grad: 'linear-gradient(180deg, #EAF8FF 0%, #9BDCFF 55%, #38BDF8 100%)',
    text: 'Deine Seite gibt es auch auf Englisch, Polnisch, Italienisch und mehr. Übersetzt wird automatisch.' },
  { name: 'QR-Code', glow: '#E5E7EB', grad: 'linear-gradient(180deg, #FFFFFF 0%, #E5E7EB 55%, #9CA3AF 100%)',
    text: 'Ein QR-Code, der direkt zu deiner Seite führt. Zum Aufdrucken auf Flyer oder Visitenkarte.' },
  { name: 'Linkseite', glow: '#5EEAD4', grad: 'linear-gradient(180deg, #ECFDF5 0%, #A7F3D0 55%, #34D399 100%)',
    text: 'Alle deine Links auf einer Seite, perfekt für dein Instagram-Profil. Immer kostenlos.' },
  { name: 'Eigene Domain', glow: '#FCD34D', grad: 'linear-gradient(180deg, #FFFBEB 0%, #FDE68A 55%, #F59E0B 100%)',
    text: 'Deine Seite unter deiner eigenen Internetadresse, z. B. max-mustermann.de.' },
  { name: 'Duo-Seite', glow: '#C4B5FD', grad: 'linear-gradient(180deg, #F5F3FF 0%, #DDD6FE 55%, #A78BFA 100%)',
    text: 'Du arbeitest zu zweit? Dann steht ihr beide auf der Seite, jeder mit Foto und Kontakt.' },
  { name: 'Werbe-Tracking', glow: '#FB7185', grad: 'linear-gradient(180deg, #FFF1F2 0%, #FDA4AF 55%, #FB7185 100%)',
    text: 'Schaltest du Werbung bei Meta, Google oder TikTok? Ein Klick, und du siehst, was sie bringt.' },
  { name: 'Rechtstexte', glow: '#A5B4FC', grad: 'linear-gradient(180deg, #EEF2FF 0%, #C7D2FE 55%, #818CF8 100%)',
    text: 'Impressum und Datenschutzerklärung sind schon drauf. Wir halten sie aktuell.' },
]

export default function FeaturesSection() {
  return (
    <section id="features" style={{ position: 'relative', zIndex: 2, color: '#fff' }}>
      <style>{`
        .ft-pad { padding: 40px 7vw 110px; }
        .ft-inner { max-width: 1200px; margin: 0 auto; }
        .ft-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .ft-card {
          position: relative; display: block; padding: 34px 26px 32px; border-radius: 22px; overflow: hidden;
          text-decoration: none; color: inherit;
          background: linear-gradient(180deg, rgba(255,255,255,0.065) 0%, rgba(255,255,255,0.025) 100%);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
        }
        /* Schein in der Farbe des Features oben links, Lichtkante oben */
        .ft-card::before { content: ''; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 75% 60% at 12% 0%, var(--ft-glow-soft) 0%, transparent 70%); }
        .ft-card::after { content: ''; position: absolute; left: 20px; right: 20px; top: 0; height: 1px; pointer-events: none;
          background: linear-gradient(90deg, transparent, var(--ft-line), transparent); }
        .ft-word {
          position: relative; display: inline-block; z-index: 1;
          font-family: "Plus Jakarta Sans", sans-serif; font-weight: 700; letter-spacing: -0.035em; line-height: 1.05;
          font-size: clamp(26px, 2.1vw, 29px);
          background: var(--ft-grad); -webkit-background-clip: text; background-clip: text; color: transparent;
          filter: drop-shadow(0 0 16px var(--ft-shadow));
        }
        .ft-text { position: relative; z-index: 1; margin: 14px 0 0; font-size: 15px; line-height: 1.55; color: rgba(255,255,255,0.72); }
        @media (max-width: 1023px) {
          .ft-pad { padding: 24px 5vw 84px; }
          .ft-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
          .ft-card { padding: 28px 22px 26px; }
          .ft-word { font-size: 29px; }
        }
        @media (max-width: 767px) {
          .ft-pad { padding: 16px 22px 64px; }
          .ft-grid { grid-template-columns: 1fr; gap: 12px; }
          .ft-card { padding: 24px 22px 24px; }
          .ft-word { font-size: 27px; }
          .ft-text { font-size: 14.5px; margin-top: 10px; }
        }
      `}</style>

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
          {FEATURES.map(f => {
            const vars = {
              '--ft-grad': f.grad,
              '--ft-shadow': `${f.glow}66`,
              '--ft-glow-soft': `${f.glow}2E`,
              '--ft-line': `${f.glow}80`,
            } as React.CSSProperties
            return (
              <div key={f.name} className="ft-card" style={vars}>
                <span className="ft-word">{f.name}</span>
                <p className="ft-text">{f.text}</p>
              </div>
            )
          })}
        </div>
      </div></div>
    </section>
  )
}
