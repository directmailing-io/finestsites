import type { Metadata } from 'next'
import type { CSSProperties, ReactNode } from 'react'

/**
 * finestsites.io/exemplare – interne Abstimmungsseite (Daniel, 26.10.2026): fünf Vorschläge, wie eine
 * Neuigkeit im Dashboard auffälliger und klar als Ankündigung erkennbar wird. Nicht verlinkt, nicht in
 * sitemap.ts, robots.ts sperrt den Pfad, dazu noindex. Gleiche Texte und Maße wie die echte Liste.
 */
export const metadata: Metadata = {
  title: 'Exemplare – Neuigkeiten',
  robots: { index: false, follow: false, nocache: true },
}

const INK = '#111827'
const BODY = '#374151'
const SEC = '#5B6472'
const TER = '#8A94A6'
const LINE = '#ECEEF2'
const SHADOW = '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.05)'

type Palette = { from: string; to: string; tint: string; deep: string }
const PEACH: Palette = { from: '#F7C4B4', to: '#F6DFA9', tint: '#FDF3EF', deep: '#F1D2C6' }
const MINT: Palette = { from: '#CDE8D3', to: '#BBD6F2', tint: '#F0F8F2', deep: '#D7EBDD' }
const LAVENDER: Palette = { from: '#D9D3F3', to: '#F5C9DC', tint: '#F4F1FB', deep: '#E3DCF6' }
const SKY: Palette = { from: '#BBD6F2', to: '#D9D3F3', tint: '#EFF5FC', deep: '#D3E3F6' }
const APRICOT: Palette = { from: '#F6DFA9', to: '#CDE8D3', tint: '#FCF6EA', deep: '#F0E3C0' }
const grad = (p: Palette, deg = 90) => `linear-gradient(${deg}deg, ${p.from}, ${p.to})`

const NEWS = {
  date: '26. Oktober 2026',
  day: '26',
  month: 'Okt',
  title: 'Neu: Besucher-Chat für alle',
  summary: 'Besucher schreiben dir direkt auf deiner Webseite, du antwortest aus der App. Jetzt im Editor einschalten.',
}

/* ── Bausteine ──────────────────────────────────────────────────────────────────────────────── */

const kicker: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: TER, lineHeight: 1 }
const titleStyle: CSSProperties = { margin: '12px 0 8px', fontSize: 22, fontWeight: 600, lineHeight: 1.25, letterSpacing: '-0.3px', color: INK }
const summaryStyle: CSSProperties = { margin: 0, fontSize: 15.5, lineHeight: 1.6, color: SEC }
const moreStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14.5, fontWeight: 600, color: INK, marginTop: 18 }
const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ opacity: 0.7 }}><path d="M9 18l6-6-6-6" /></svg>
)
const Pill = ({ children, bg, color = INK }: { children: ReactNode; bg: string; color?: string }) => (
  <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1, padding: '5px 9px', borderRadius: 999, background: bg, color, letterSpacing: '0.01em' }}>{children}</span>
)
const Edge = ({ p }: { p: Palette }) => <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: grad(p) }} />

function Sheet({ children, style, radius = 24 }: { children: ReactNode; style?: CSSProperties; radius?: number }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: '#fff', border: `1px solid ${LINE}`, borderRadius: radius, boxShadow: SHADOW, ...style }}>
      {children}
    </div>
  )
}

/* ── 1 · Etikett ───────────────────────────────────────────────────────────────────────────── */
function V1List({ p }: { p: Palette }) {
  return (
    <Sheet>
      <div style={{ padding: '28px 28px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 10px', borderRadius: 999, background: grad(p), color: INK }}>Neuigkeit</span>
          <span style={kicker}>{NEWS.date}</span>
        </div>
        <h3 style={titleStyle}>{NEWS.title}</h3>
        <p style={summaryStyle}>{NEWS.summary}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={moreStyle}>Weiterlesen <Chevron /></span></div>
      </div>
      <Edge p={p} />
    </Sheet>
  )
}
function V1Dash({ p }: { p: Palette }) {
  return (
    <Sheet radius={20}>
      <div style={{ padding: '18px 48px 21px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '5px 9px', borderRadius: 999, background: grad(p), color: INK }}>Neuigkeit</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: TER }}>{NEWS.date}</span>
        </div>
        <div style={{ fontWeight: 600, color: INK, fontSize: 15.5, lineHeight: 1.3, margin: '9px 0 3px', letterSpacing: '-0.2px' }}>{NEWS.title}</div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: SEC }}>{NEWS.summary} <b style={{ color: INK, fontWeight: 600, whiteSpace: 'nowrap' }}>Mehr erfahren ›</b></p>
      </div>
      <Edge p={p} />
    </Sheet>
  )
}

/* ── 2 · Pastellfläche ─────────────────────────────────────────────────────────────────────── */
function V2List({ p }: { p: Palette }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: p.tint, border: `1px solid ${p.deep}`, borderRadius: 24, boxShadow: SHADOW }}>
      <div style={{ padding: '28px 28px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...kicker, color: '#6B7280' }}>{NEWS.date}</span>
          <Pill bg={INK} color="#fff">Neu</Pill>
        </div>
        <h3 style={titleStyle}>{NEWS.title}</h3>
        <p style={{ ...summaryStyle, color: BODY }}>{NEWS.summary}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={moreStyle}>Weiterlesen <Chevron /></span></div>
      </div>
    </div>
  )
}
function V2Dash({ p }: { p: Palette }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: p.tint, border: `1px solid ${p.deep}`, borderRadius: 20, boxShadow: SHADOW }}>
      <div style={{ padding: '18px 48px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Pill bg={INK} color="#fff">Neu</Pill>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Neu bei FinestSites</span>
        </div>
        <div style={{ fontWeight: 600, color: INK, fontSize: 15.5, lineHeight: 1.3, margin: '9px 0 3px', letterSpacing: '-0.2px' }}>{NEWS.title}</div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: BODY }}>{NEWS.summary} <b style={{ color: INK, fontWeight: 600, whiteSpace: 'nowrap' }}>Mehr erfahren ›</b></p>
      </div>
    </div>
  )
}

/* ── 3 · Verlaufsrahmen ────────────────────────────────────────────────────────────────────── */
function Framed({ p, radius, children }: { p: Palette; radius: number; children: ReactNode }) {
  return (
    <div style={{
      position: 'relative', borderRadius: radius, padding: 1.5, boxShadow: SHADOW,
      background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
    }}>
      <div style={{ background: '#fff', borderRadius: radius - 1.5, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}
function V3List({ p }: { p: Palette }) {
  return (
    <Framed p={p} radius={24}>
      <div style={{ padding: '27px 27px 27px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={kicker}>{NEWS.date}</span>
          <Pill bg={p.tint}>Neu</Pill>
        </div>
        <h3 style={titleStyle}>{NEWS.title}</h3>
        <p style={summaryStyle}>{NEWS.summary}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={moreStyle}>Weiterlesen <Chevron /></span></div>
      </div>
    </Framed>
  )
}
function V3Dash({ p }: { p: Palette }) {
  return (
    <Framed p={p} radius={20}>
      <div style={{ padding: '17px 47px 19px 23px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', lineHeight: 1 }}>Neu bei FinestSites</div>
        <div style={{ fontWeight: 600, color: INK, fontSize: 15.5, lineHeight: 1.3, margin: '7px 0 3px', letterSpacing: '-0.2px' }}>{NEWS.title}</div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: SEC }}>{NEWS.summary} <b style={{ color: INK, fontWeight: 600, whiteSpace: 'nowrap' }}>Mehr erfahren ›</b></p>
      </div>
    </Framed>
  )
}

/* ── 4 · Vollton ───────────────────────────────────────────────────────────────────────────── */
function V4List({ p }: { p: Palette }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${p.from}, ${p.to})`, borderRadius: 24, boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(16,24,40,0.08)' }}>
      <div style={{ padding: '28px 28px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...kicker, color: 'rgba(17,24,39,0.6)' }}>{NEWS.date}</span>
          <Pill bg="rgba(255,255,255,0.75)">Neu</Pill>
        </div>
        <h3 style={{ ...titleStyle, fontSize: 24 }}>{NEWS.title}</h3>
        <p style={{ ...summaryStyle, color: 'rgba(17,24,39,0.78)' }}>{NEWS.summary}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ ...moreStyle, background: INK, color: '#fff', padding: '10px 16px', borderRadius: 999, fontSize: 14 }}>Weiterlesen <Chevron /></span>
        </div>
      </div>
    </div>
  )
}
function V4Dash({ p }: { p: Palette }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${p.from}, ${p.to})`, borderRadius: 20, boxShadow: SHADOW }}>
      <div style={{ padding: '18px 48px 20px 24px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(17,24,39,0.6)', lineHeight: 1 }}>Neu bei FinestSites</div>
        <div style={{ fontWeight: 600, color: INK, fontSize: 15.5, lineHeight: 1.3, margin: '7px 0 3px', letterSpacing: '-0.2px' }}>{NEWS.title}</div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: 'rgba(17,24,39,0.78)' }}>{NEWS.summary} <b style={{ color: INK, fontWeight: 600, whiteSpace: 'nowrap' }}>Mehr erfahren ›</b></p>
      </div>
    </div>
  )
}

/* ── 5 · Datum groß ────────────────────────────────────────────────────────────────────────── */
function DateLeaf({ p, size = 64 }: { p: Palette; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: p.tint, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${p.deep}` }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 700, color: INK, lineHeight: 1, letterSpacing: '-0.5px' }}>{NEWS.day}</span>
      <span style={{ fontSize: size * 0.17, fontWeight: 600, color: SEC, lineHeight: 1, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{NEWS.month}</span>
    </div>
  )
}
function V5List({ p }: { p: Palette }) {
  return (
    <Sheet>
      <div style={{ padding: '26px 28px 26px', display: 'flex', gap: 22, alignItems: 'flex-start' }}>
        <DateLeaf p={p} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={kicker}>Neuigkeit</span>
            <Pill bg={p.tint}>Neu</Pill>
          </div>
          <h3 style={{ ...titleStyle, margin: '10px 0 6px' }}>{NEWS.title}</h3>
          <p style={summaryStyle}>{NEWS.summary}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={{ ...moreStyle, marginTop: 14 }}>Weiterlesen <Chevron /></span></div>
        </div>
      </div>
      <Edge p={p} />
    </Sheet>
  )
}
function V5Dash({ p }: { p: Palette }) {
  return (
    <Sheet radius={20}>
      <div style={{ padding: '16px 48px 18px 18px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <DateLeaf p={p} size={52} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', lineHeight: 1 }}>Neu bei FinestSites</div>
          <div style={{ fontWeight: 600, color: INK, fontSize: 15.5, lineHeight: 1.3, margin: '6px 0 3px', letterSpacing: '-0.2px' }}>{NEWS.title}</div>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: SEC }}>{NEWS.summary} <b style={{ color: INK, fontWeight: 600, whiteSpace: 'nowrap' }}>Mehr erfahren ›</b></p>
        </div>
      </div>
      <Edge p={p} />
    </Sheet>
  )
}

/* ── Seite ─────────────────────────────────────────────────────────────────────────────────── */

const PROPOSALS: { n: number; name: string; why: string; list: (p: Palette) => ReactNode; dash: (p: Palette) => ReactNode; p: Palette }[] = [
  { n: 1, name: 'Etikett', p: PEACH, list: p => <V1List p={p} />, dash: p => <V1Dash p={p} />,
    why: 'Das Wort „Neuigkeit“ steht als Etikett im Pastellverlauf oben auf der Karte. Man weiß sofort, was das ist. Die Unterkante bleibt, sonst alles weiß.' },
  { n: 2, name: 'Pastellfläche', p: MINT, list: p => <V2List p={p} />, dash: p => <V2Dash p={p} />,
    why: 'Die ganze Karte liegt in der hellen Pastellfarbe der Neuigkeit, mit schwarzer „Neu“-Pille. Hebt sich vom weißen Dashboard ab, ohne laut zu sein. So macht es Apple bei Tipps und Fitness-Hinweisen.' },
  { n: 3, name: 'Verlaufsrahmen', p: LAVENDER, list: p => <V3List p={p} />, dash: p => <V3Dash p={p} />,
    why: 'Ein 1,5 px feiner Rahmen im Pastellverlauf um die weiße Karte. Edel und ruhig, aber unverwechselbar „besonders“. Innen bleibt alles wie gehabt.' },
  { n: 4, name: 'Vollton', p: APRICOT, list: p => <V4List p={p} />, dash: p => <V4Dash p={p} />,
    why: 'Der Pastellverlauf füllt die ganze Karte, Text in Schwarz, „Weiterlesen“ als schwarze Pille. Die auffälligste Variante, wirkt wie eine Ankündigungskarte im App Store. Für seltene, große Neuigkeiten.' },
  { n: 5, name: 'Datum groß', p: SKY, list: p => <V5List p={p} />, dash: p => <V5Dash p={p} />,
    why: 'Links ein Kalenderblatt mit Tag und Monat in Pastell, rechts die Neuigkeit. Liest sich wie ein Termin oder eine Ausgabe, die Unterkante bleibt. Ohne Icon, nur Zahl und Schrift.' },
]

export default function ExemplarePage() {
  return (
    <main style={{ minHeight: '100vh', background: '#FAFAFA', color: BODY, padding: '48px 20px 120px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <p style={{ ...kicker, color: TER, marginBottom: 14 }}>Intern · nicht indexiert</p>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: '-0.8px', color: INK }}>Neuigkeiten: fünf Vorschläge</h1>
        <p style={{ margin: '10px 0 0', fontSize: 17, color: SEC, maxWidth: 720, lineHeight: 1.55 }}>
          Gleicher Text, gleiche Maße wie die echte Liste. Links die Karte in „Neuigkeiten“, rechts die Karte über deinen Webseiten.
          Alle fünf nutzen nur Weiß, Schwarz und den Pastellverlauf der Neuigkeit, keine Icons, keine Bilder.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 64, marginTop: 56 }}>
          {PROPOSALS.map(v => (
            <section key={v.n}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: TER, letterSpacing: '0.08em' }}>0{v.n}</span>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px', color: INK }}>{v.name}</h2>
              </div>
              <p style={{ margin: '0 0 22px', fontSize: 15.5, color: SEC, maxWidth: 720, lineHeight: 1.55 }}>{v.why}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 28, alignItems: 'start' }} className="exemplare-grid">
                <div style={{ maxWidth: 720 }}>
                  <div style={{ ...kicker, marginBottom: 12 }}>In der Liste „Neuigkeiten“</div>
                  {v.list(v.p)}
                </div>
                <div style={{ maxWidth: 680 }}>
                  <div style={{ ...kicker, marginBottom: 12 }}>Über deinen Webseiten</div>
                  {v.dash(v.p)}
                  <div style={{ marginTop: 22, ...kicker, marginBottom: 12 }}>Gelesen (zum Vergleich, Variante 01)</div>
                  <Sheet>
                    <div style={{ padding: '24px 28px 24px' }}>
                      <span style={kicker}>19. Oktober 2026</span>
                      <h3 style={{ ...titleStyle, fontSize: 19, margin: '10px 0 6px' }}>Neue Vorlage: Dein Vitalprofil</h3>
                      <p style={{ ...summaryStyle, fontSize: 14.5 }}>Die neue Vorlage „Vitalprofil“ steht bereit. Schau sie dir an und leg direkt los.</p>
                    </div>
                    <Edge p={v.p} />
                  </Sheet>
                </div>
              </div>
            </section>
          ))}
        </div>

        <p style={{ marginTop: 72, fontSize: 14, color: TER }}>Sag mir einfach die Nummer. Mischungen gehen auch, zum Beispiel „02 für die Liste, 04 über den Webseiten“.</p>
      </div>
      <style>{`@media (max-width: 900px) { .exemplare-grid { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
    </main>
  )
}
