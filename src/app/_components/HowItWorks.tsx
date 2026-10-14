/* ── So funktioniert's: drei Schritte, je ein Satz und ein ruhiges, großes Bild ──
 * Die Bilder zeigen die Oberfläche so, wie sie im Editor aussieht (weiße Karten, Pillen,
 * große Schrift), ohne Mini-App-Rahmen mit winziger Schrift. */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'

const frame: React.CSSProperties = {
  background: '#F7F5FB',
  border: '1px solid #EAE4F5',
  borderRadius: 20,
  padding: 18,
  height: 250,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  overflow: 'hidden',
}

const Check = ({ size = 14, color = '#fff' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
)

/* Schritt 1: drei Vorlagen, die mittlere ist gewählt */
function VisualChoose() {
  const cards = [
    { src: '/previews/pm-business.jpg', label: 'Business' },
    { src: '/previews/naehrstoff-system.jpg', label: 'Produkt', selected: true },
    { src: '/previews/pm-cellrestart.jpg', label: 'Kur' },
  ]
  return (
    <div style={frame}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr 1fr', gap: 10, alignItems: 'center' }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: c.selected ? '2.5px solid #8060b0' : '1px solid #EAE4F5', boxShadow: c.selected ? '0 10px 30px rgba(128,96,176,0.25)' : '0 2px 8px rgba(0,0,0,0.04)', position: 'relative', transform: c.selected ? 'scale(1.04)' : 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.src} alt="" style={{ width: '100%', aspectRatio: '16 / 11', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
            <div style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: c.selected ? '#8060b0' : '#555' }}>{c.label}</div>
            {c.selected && (
              <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: '#8060b0', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(128,96,176,0.4)' }}>
                <Check size={13} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* Schritt 2: zwei ausgefüllte Felder und ein Foto, mehr nicht */
function VisualFill() {
  const field = (label: string, value: string) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 5 }}>{label}</div>
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '11px 14px', fontSize: 14, color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{value}</span>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} /></span>
      </div>
    </div>
  )
  return (
    <div style={frame}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg, #D4C5E2, #8060b0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>SM</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Dein Foto</div>
            <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><Check size={12} color="#16A34A" /> Hochgeladen</div>
          </div>
        </div>
        {field('Dein Name', 'Sandra Müller')}
        {field('Deine Telefonnummer', '0171 234 56 78')}
      </div>
    </div>
  )
}

/* Schritt 3: online, mit Link zum Teilen */
function VisualLive() {
  return (
    <div style={frame}>
      <div style={{ background: '#fff', border: '1px solid #EAE4F5', borderRadius: 16, padding: '20px 18px', textAlign: 'center', boxShadow: '0 8px 30px rgba(22,163,74,0.10)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#DCFCE7', color: '#15803D', borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 4px rgba(22,163,74,0.18)' }} />
          ONLINE
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 12 }}>Deine Seite ist live</div>
        <div style={{ background: '#F7F5FB', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#8060b0', fontWeight: 600, marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          sandra-mueller.dailyoptimal.de
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <span style={{ background: '#111', color: '#fff', borderRadius: 99, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>Link kopieren</span>
          <span style={{ background: '#25D366', color: '#fff', borderRadius: 99, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>WhatsApp</span>
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  { title: 'Vorlage aussuchen', text: 'Texte und Design sind schon fertig.', visual: <VisualChoose /> },
  { title: 'Name und Foto eintragen', text: 'Ein paar Felder, mehr nicht.', visual: <VisualFill /> },
  { title: 'Online gehen', text: 'Ein Klick, und deine Seite ist da.', visual: <VisualLive /> },
]

export default function HowItWorks() {
  return (
    <section id="wie-es-geht" style={{ background: 'radial-gradient(ellipse 110% 55% at 50% 0%, rgba(128,96,176,0.07) 0%, #fff 65%)' }} className="fs-section-pad">
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#8060b0', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>So funktioniert&apos;s</p>
          <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(28px, 3.8vw, 48px)', fontWeight: 400, color: '#111', letterSpacing: '-0.022em', lineHeight: 1.12, marginBottom: 16 }}>
            Drei Schritte. Fertig.
          </h2>
          <p style={{ fontSize: 16, color: '#666', lineHeight: 1.7, maxWidth: 460, margin: '0 auto' }}>
            Du musst nichts gestalten und nichts schreiben.
          </p>
        </div>

        {/* Schritt: erst die Nummer mit dem Titel, darunter das Bild, darunter ein kurzer Satz */}
        <div className="fs-how-grid">
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: '#8060b0', color: '#fff', fontSize: 17, fontWeight: 700, flexShrink: 0, boxShadow: '0 4px 14px rgba(128,96,176,0.35)' }}>{i + 1}</div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1.25, margin: 0 }}>{step.title}</h3>
              </div>
              {step.visual}
              <p style={{ fontSize: 15, color: '#666', lineHeight: 1.6, margin: 0, paddingLeft: 4 }}>{step.text}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 52 }}>
          <a href={`${APP_URL}/register`} style={{ display: 'inline-block', background: '#111', color: '#fff', padding: '15px 36px', borderRadius: 100, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
            Kostenlos starten
          </a>
          <p style={{ fontSize: 13, color: '#888', marginTop: 10 }}>Dauert keine 5 Minuten. Zahlen musst du erst, wenn du online gehst.</p>
        </div>

      </div>
    </section>
  )
}
