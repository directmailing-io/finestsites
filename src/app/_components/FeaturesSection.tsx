/* ── Features: jedes Extra hat einen eigenen Namen (wie ClaimGuard) und genau einen Satz ──
 * Acht Kacheln, jede mit eigener Akzentfarbe, Icon-Kachel mit Schein und leichtem Farbhauch
 * oben links. Alles davon steckt in jedem Tarif, deshalb kein Tarif-Hinweis je Kachel. */

type Feature = {
  name: string
  text: string
  color: string
  dark: string
  tag?: string
  href?: string
  icon: React.ReactNode
}

const stroke = { fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const FEATURES: Feature[] = [
  {
    name: 'ClaimGuard', color: '#9F67FF', dark: '#6D28D9', tag: 'KI', href: '#claimguard',
    text: 'Deine Texte, automatisch geprüft auf Heil- und Wirkaussagen.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>,
  },
  {
    name: 'ColorPick', color: '#F472B6', dark: '#DB2777',
    text: 'Ein Klick, und die ganze Seite trägt deine Farbe.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><circle cx="8.5" cy="10" r="1.2" fill="#fff" /><circle cx="12" cy="7.5" r="1.2" fill="#fff" /><circle cx="15.5" cy="10" r="1.2" fill="#fff" /><path d="M12 21c-1.5 0-2.5-1.2-2-2.5.4-1 1.5-1 2.5-1h1.5a2.5 2.5 0 0 0 0-5H13" /></svg>,
  },
  {
    name: 'MultiLang', color: '#38BDF8', dark: '#0284C7', tag: '8 Sprachen',
    text: 'Deine Seite in bis zu 8 Sprachen, automatisch übersetzt.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" /></svg>,
  },
  {
    name: 'QuickQR', color: '#64748B', dark: '#1E293B',
    text: 'Dein QR-Code für Flyer und Visitenkarte, fertig zum Drucken.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3M21 14v3M14 21h3M21 21h-1.5" /></svg>,
  },
  {
    name: 'LinkPage', color: '#34D399', dark: '#059669', tag: 'Immer kostenlos',
    text: 'Alle deine Links auf einer Seite, für Instagram und WhatsApp.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>,
  },
  {
    name: 'MyDomain', color: '#FBBF24', dark: '#D97706',
    text: 'Deine eigene Internetadresse, z. B. max-mustermann.de.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18" /><circle cx="6.5" cy="6.5" r="0.6" fill="#fff" /><circle cx="9" cy="6.5" r="0.6" fill="#fff" /><path d="M7 14.5h10" /></svg>,
  },
  {
    name: 'AdsReady', color: '#FB7185', dark: '#E11D48',
    text: 'Meta, Google und TikTok mit einem Klick verbunden. Werbung, die messbar ist.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><path d="M4 19V11M10 19V5M16 19v-6M22 19H2" /><circle cx="19" cy="7" r="2.2" /></svg>,
  },
  {
    name: 'AutoLegal', color: '#818CF8', dark: '#4338CA',
    text: 'Impressum und Datenschutz, automatisch erstellt und immer aktuell.',
    icon: <svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><polyline points="9 15 11 17 15 12" /></svg>,
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="fs-section-pad" style={{ position: 'relative', background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(128,96,176,0.08) 0%, #fff 60%)' }}>
      <style>{`
        .ft-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
        .ft-card {
          position: relative; display: flex; flex-direction: column; gap: 16px; padding: 26px 24px 28px;
          border-radius: 22px; background: #fff; text-decoration: none; color: inherit;
          border: 1px solid rgba(17,17,17,0.07);
          box-shadow: 0 1px 2px rgba(17,17,17,0.04), 0 14px 40px rgba(128,96,176,0.08);
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          overflow: hidden;
        }
        .ft-card::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(circle at 0% 0%, var(--ft-tint) 0%, transparent 55%);
        }
        .ft-card::after {
          content: ''; position: absolute; left: 24px; right: 24px; top: 0; height: 1px; pointer-events: none;
          background: linear-gradient(90deg, transparent, var(--ft-line), transparent);
        }
        a.ft-card:hover { transform: translateY(-4px); box-shadow: 0 2px 4px rgba(17,17,17,0.04), 0 22px 50px rgba(128,96,176,0.16); border-color: var(--ft-line); }
        .ft-icon {
          position: relative; width: 52px; height: 52px; border-radius: 15px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, var(--ft-color) 0%, var(--ft-dark) 100%);
          box-shadow: 0 10px 24px var(--ft-shadow), inset 0 1px 0 rgba(255,255,255,0.35);
        }
        .ft-name { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; color: #111; line-height: 1.2; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ft-tag { font-size: 11px; font-weight: 700; letter-spacing: 0.02em; padding: 3px 8px; border-radius: 99px; color: var(--ft-dark); background: var(--ft-tint); border: 1px solid var(--ft-line); }
        .ft-text { font-size: 14.5px; line-height: 1.55; color: #666; margin: 0; }
        .ft-guard { background: linear-gradient(90deg, #6D28D9, #A78BFA); -webkit-background-clip: text; background-clip: text; color: transparent; }
        @media (max-width: 1023px) {
          .ft-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
          .ft-card { padding: 22px 20px 24px; }
        }
        @media (max-width: 767px) {
          .ft-grid { grid-template-columns: 1fr; gap: 12px; }
          .ft-card { flex-direction: row; align-items: flex-start; gap: 16px; padding: 18px 18px; }
          .ft-icon { width: 46px; height: 46px; border-radius: 13px; }
          .ft-name { font-size: 17px; }
          .ft-text { font-size: 14px; }
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#8060b0', background: '#F5F0FB', borderRadius: 99, padding: '6px 14px', letterSpacing: '0.04em', marginBottom: 18 }}>Alles inklusive</span>
          <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(28px, 3.8vw, 48px)', fontWeight: 400, color: '#111', letterSpacing: '-0.022em', lineHeight: 1.12, marginBottom: 16 }}>
            Alles drin. In jedem Tarif.
          </h2>
          <p style={{ fontSize: 16, color: '#666', lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
            Fertig eingebaut, kein Aufpreis.
          </p>
        </div>

        <div className="ft-grid">
          {FEATURES.map(f => {
            const vars = { '--ft-color': f.color, '--ft-dark': f.dark, '--ft-tint': `${f.color}1F`, '--ft-line': `${f.color}66`, '--ft-shadow': `${f.color}66` } as React.CSSProperties
            const body = (
              <>
                <div className="ft-icon">{f.icon}</div>
                <div>
                  <div className="ft-name">
                    <span className={f.href ? 'ft-guard' : undefined}>{f.name}</span>
                    {f.tag && <span className="ft-tag">{f.tag}</span>}
                  </div>
                  <p className="ft-text" style={{ marginTop: 8 }}>{f.text}</p>
                </div>
              </>
            )
            return f.href
              ? <a key={f.name} href={f.href} className="ft-card" style={vars}>{body}</a>
              : <div key={f.name} className="ft-card" style={vars}>{body}</div>
          })}
        </div>
      </div>
    </section>
  )
}
