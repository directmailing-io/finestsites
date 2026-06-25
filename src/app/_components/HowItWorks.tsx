/* ── So funktioniert's — section with real UI mockups ── */

function BrowserChrome({ url }: { url: string }) {
  return (
    <div style={{ background: '#DEDEDE', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF5F57' }} />
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FEBC2E' }} />
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28C840' }} />
      <div style={{ flex: 1, background: '#fff', borderRadius: 4, height: 18, marginLeft: 8, display: 'flex', alignItems: 'center', paddingLeft: 8, gap: 5 }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
        <span style={{ fontSize: 9, color: '#777' }}>{url}</span>
      </div>
    </div>
  )
}

function AppSidebar({ activeIdx = 0 }: { activeIdx?: number }) {
  const icons = [
    // Grid / dashboard
    <svg key="a" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>,
    // Globe
    <svg key="b" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10" /></svg>,
    // Layout (templates)
    <svg key="c" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="21" /></svg>,
    // Settings
    <svg key="d" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  ]
  return (
    <div style={{ width: 44, background: '#1a2530', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 2, flexShrink: 0 }}>
      <div style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.15)', borderRadius: 6, marginBottom: 10 }} />
      {icons.map((icon, i) => (
        <div key={i} style={{ width: 32, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: i === activeIdx ? 'rgba(212,197,226,0.2)' : 'transparent', color: i === activeIdx ? '#D4C5E2' : 'rgba(255,255,255,0.35)' }}>
          {icon}
        </div>
      ))}
    </div>
  )
}

/* ── Mockup 1: Vorlage wählen ── */
function MockupTemplateSelect() {
  const cards = [
    { bg: '#DCD0ED', label: 'MyEvnt', sub: 'Events & Webinare', selected: false },
    { bg: '#B8CCDB', label: 'Fitline', sub: 'OptimalSet', selected: true },
    { bg: '#C8D8B8', label: 'VitalCheck', sub: 'Gesundheits-Quiz', selected: false },
    { bg: '#EAD4B5', label: 'lnko.bio', sub: 'Link in Bio', selected: false },
  ]
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.14)', border: '1px solid #ddd' }}>
      <BrowserChrome url="app.finestsites.io/sites/library" />
      <div style={{ display: 'flex', height: 210 }}>
        <AppSidebar activeIdx={2} />
        <div style={{ flex: 1, background: '#f8f9fb', padding: '12px 14px', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#222', marginBottom: 3 }}>Vorlage wählen</div>
          <div style={{ fontSize: 9, color: '#888', marginBottom: 10 }}>Alle Texte und Designs sind bereits fertig</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {cards.map((c, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', border: c.selected ? '2px solid #8060b0' : '1px solid #e5e5e5', position: 'relative', cursor: 'pointer' }}>
                <div style={{ height: 48, background: c.bg }} />
                <div style={{ padding: '5px 7px' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#222' }}>{c.label}</div>
                  <div style={{ fontSize: 7, color: '#888' }}>{c.sub}</div>
                </div>
                {c.selected && (
                  <div style={{ position: 'absolute', top: 5, right: 5, width: 16, height: 16, background: '#8060b0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, background: '#111', color: '#fff', borderRadius: 20, padding: '5px 12px', fontSize: 9, fontWeight: 600, display: 'inline-block' }}>Vorlage nutzen →</div>
        </div>
      </div>
    </div>
  )
}

/* ── Mockup 2: Anpassen (Wizard) ── */
function MockupEditor() {
  const fields = [
    { label: 'Dein Name', value: 'Sandra Müller', done: true },
    { label: 'Telefon / WhatsApp', value: '+49 151 2349 0012', done: true },
    { label: 'Kurztext über dich', value: 'Ich helfe Menschen dabei...', done: false },
  ]
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.14)', border: '1px solid #ddd' }}>
      <BrowserChrome url="app.finestsites.io/sites/abc123/edit" />
      <div style={{ display: 'flex', height: 210 }}>
        <AppSidebar activeIdx={1} />
        <div style={{ flex: 1, background: '#fff', padding: '12px 14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#8060b0' }}>Schritt 2 von 3</div>
            <div style={{ flex: 1, height: 4, background: '#f0eaf8', borderRadius: 2 }}>
              <div style={{ width: '66%', height: '100%', background: 'linear-gradient(to right, #8060b0, #D4C5E2)', borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#222', marginBottom: 10 }}>Kontaktdaten</div>
          {fields.map((f, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8, color: '#888', marginBottom: 2 }}>{f.label}</div>
              <div style={{ border: `1px solid ${f.done ? '#D4C5E2' : '#e5e5e5'}`, borderRadius: 6, padding: '5px 8px', fontSize: 9, color: f.done ? '#333' : '#bbb', background: f.done ? '#fdfbff' : '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{f.value}</span>
                {f.done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#8060b0" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 'auto', background: '#111', color: '#fff', borderRadius: 20, padding: '6px 14px', fontSize: 9, fontWeight: 600, display: 'inline-block', alignSelf: 'flex-start' }}>Weiter →</div>
        </div>
        {/* Live preview panel */}
        <div style={{ width: 110, background: '#f5f3f0', borderLeft: '1px solid #eee', padding: '10px 8px', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: 7, fontWeight: 700, color: '#aaa', letterSpacing: '0.08em', marginBottom: 8 }}>VORSCHAU</div>
          <div style={{ background: '#fff', borderRadius: 8, padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ height: 28, background: '#B8CCDB', borderRadius: 4, marginBottom: 6 }} />
            <div style={{ fontSize: 8, fontWeight: 700, color: '#111', marginBottom: 2 }}>Sandra Müller</div>
            <div style={{ fontSize: 7, color: '#777', marginBottom: 6 }}>+49 151 2349 0012</div>
            <div style={{ height: 18, background: '#1a2530', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 6, color: '#D4C5E2', fontWeight: 700 }}>Jetzt Kontakt aufnehmen</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Mockup 3: Live schalten ── */
function MockupPublished() {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.14)', border: '1px solid #ddd' }}>
      <BrowserChrome url="sandra-m.finestsites.io" />
      <div style={{ display: 'flex', height: 210 }}>
        <AppSidebar activeIdx={1} />
        <div style={{ flex: 1, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10 }}>
          {/* Success badge */}
          <div style={{ width: 48, height: 48, background: '#edfaed', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #C8D8B8' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111', textAlign: 'center', marginBottom: 3 }}>Deine Seite ist live!</div>
            <div style={{ fontSize: 9, color: '#888', textAlign: 'center' }}>Sie läuft jetzt rund um die Uhr</div>
          </div>
          {/* URL chip */}
          <div style={{ background: '#f5f3f0', borderRadius: 20, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#555', fontWeight: 500 }}>sandra-m.finestsites.io</span>
          </div>
          {/* Stats strip */}
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            {[
              { label: 'Besucher', val: '0', icon: '👁' },
              { label: 'Anfragen', val: '0', icon: '✉️' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 13 }}>{s.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{s.val}</div>
                <div style={{ fontSize: 7, color: '#aaa' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ background: '#111', color: '#fff', borderRadius: 20, padding: '5px 12px', fontSize: 9, fontWeight: 600 }}>Seite besuchen →</div>
            <div style={{ border: '1px solid #ddd', color: '#555', borderRadius: 20, padding: '5px 12px', fontSize: 9, fontWeight: 500 }}>Teilen</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main export ── */
const STEPS = [
  {
    num: '01',
    title: 'Vorlage wählen',
    label: 'Wählen',
    text: 'Nicht irgendeine. Jede Vorlage folgt einer klaren Strategie, die Besucher dazu bringt, sich bei dir zu melden. Texte, Struktur und Design sind bereits fertig und rechtlich geprüft. Du wählst einfach die, die zu deinem Produkt passt.',
    visual: <MockupTemplateSelect />,
  },
  {
    num: '02',
    title: 'Anpassen',
    label: 'Anpassen',
    text: 'Dein Name, deine Nummer, dein Foto. Optional ein Erfahrungsbericht oder ein Produktbild. Du füllst ein paar Felder aus und siehst live, wie deine Seite aussieht. Kein Designer, keine Agentur, kein Stress.',
    visual: <MockupEditor />,
  },
  {
    num: '03',
    title: 'Live schalten',
    label: 'Live',
    text: 'Ein Klick, deine Seite ist online. Mit einer eigenen Webadresse. Ab jetzt läuft sie rund um die Uhr, bringt dir Anfragen und stellt sich selbst vor. Du schläfst. Die Seite arbeitet.',
    visual: <MockupPublished />,
  },
]

export default function HowItWorks() {
  return (
    <section id="wie-es-geht" style={{ background: '#fff' }} className="fs-section-pad">
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#8060b0', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>So funktioniert&apos;s</p>
          <h2 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(28px, 3.8vw, 48px)', fontWeight: 400, color: '#111', letterSpacing: '-0.022em', lineHeight: 1.12, marginBottom: 20 }}>
            In 3 Schritten online.<br />Wirklich.
          </h2>
          <p style={{ fontSize: 16, color: '#666', lineHeight: 1.7, maxWidth: 520, margin: '0 auto' }}>
            Diese Seiten wurden nicht einfach schön gemacht. Sie wurden so aufgebaut, dass aus Besuchern echte Anfragen werden. Kein Nachfassen, kein Kalt-Anschreiben.
          </p>
        </div>

        {/* Steps */}
        <div className="fs-how-grid">
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Step badge + connector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: '#F5F0FB', border: '1.5px solid #D4C5E2', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8060b0' }}>{step.num}</span>
                </div>
                <div style={{ flex: 1, height: 1, background: i < STEPS.length - 1 ? 'linear-gradient(to right, #D4C5E2, transparent)' : 'transparent' }} className="fs-how-connector" />
              </div>

              {/* Mockup visual */}
              <div style={{ borderRadius: 16, overflow: 'hidden' }}>
                {step.visual}
              </div>

              {/* Text */}
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 8, lineHeight: 1.3 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7 }}>{step.text}</p>
              </div>

            </div>
          ))}
        </div>

        {/* CTA strip */}
        <div style={{ marginTop: 56, background: '#F5F0FB', border: '1px solid #D4C5E2', borderRadius: 20, padding: '28px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>Bereit? Das dauert keine 5 Minuten.</p>
            <p style={{ fontSize: 13, color: '#888' }}>Keine Kreditkarte, keine Technik, kein Designer nötig.</p>
          </div>
          <a href="https://app.finestsites.io/register" style={{ background: '#111', color: '#fff', padding: '13px 28px', borderRadius: 100, fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Jetzt starten →
          </a>
        </div>

      </div>
    </section>
  )
}
