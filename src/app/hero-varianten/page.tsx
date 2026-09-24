import type { Metadata } from 'next'
import NavBar from '../_components/NavBar'
import HeroSection, { heroThemes } from '../_components/HeroSection'
import ProblemSection from '../_components/ProblemSection'

// Internal design preview: the hero with the same content in several color
// schemes. Not linked anywhere, not indexed.
export const metadata: Metadata = {
  title: 'Hero-Varianten (intern)',
  robots: { index: false, follow: false },
}

export default function HeroVariantenPage() {
  const registerHref = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.finestsites.io'}/register`
  const entries = Object.entries(heroThemes)

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
      <style>{`
        @font-face {
          font-family: 'Plus Jakarta Sans';
          src: url('/fonts/PlusJakartaSans-latin-ext.woff2') format('woff2');
          font-weight: 400 700; font-style: normal; font-display: swap;
          unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
        }
        @font-face {
          font-family: 'Plus Jakarta Sans';
          src: url('/fonts/PlusJakartaSans-latin.woff2') format('woff2');
          font-weight: 400 700; font-style: normal; font-display: swap;
          unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
        }
        @font-face { font-family: 'Plein'; src: url('/fonts/Plein-Regular.otf') format('opentype'); font-weight: 400; font-display: swap; }
        @font-face { font-family: 'Plein'; src: url('/fonts/Plein-Medium.otf') format('opentype'); font-weight: 500; font-display: swap; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        a { text-decoration: none; }
        .hv-label { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 14px; padding: 12px 24px; background: #111; color: #fff; font-size: 13px; }
        .hv-label b { font-size: 14px; }
        .hv-label span { color: #aaa; }
        .hv-label code { margin-left: auto; font-family: ui-monospace, Menlo, monospace; font-size: 12px; background: #333; padding: 3px 8px; border-radius: 6px; color: #eee; }
        .hv-after { padding: 40px 24px 96px; text-align: center; color: #9CA3AF; font-size: 13px; }
        .hv-intro { max-width: 720px; margin: 0 auto; padding: 130px 24px 24px; }
        .hv-intro h1 { font-family: 'Plein', sans-serif; font-weight: 400; font-size: 34px; letter-spacing: -0.02em; margin-bottom: 10px; color: #111; }
        .hv-intro p { color: #555; font-size: 15px; line-height: 1.6; }
        .hv-intro ol { margin: 16px 0 0 20px; color: #333; font-size: 14px; line-height: 1.8; }
        /* Each variant renders its own NavBar spacing; hide the nav offset for all but the first */
        .hv-variant + .hv-variant .fs-hero-content { padding-top: 90px; }
        @media (max-width: 767px) { .hv-label { padding: 10px 16px; font-size: 12px; } .hv-label code { display: none; } }
      `}</style>

      <NavBar />

      <div className="hv-intro">
        <h1>Hero-Varianten</h1>
        <p>Gleicher Inhalt, andere Anmutung. Alle Varianten sind hell und nehmen die Farben der restlichen Seite auf (Weiß, Lavendel, Creme, schwarzer CTA). Unter jedem Hero folgt die echte nächste Sektion, damit du den Übergang siehst.</p>
        <ol>
          {entries.map(([key, v]) => <li key={key}><b>{v.label}</b>: {v.note}</li>)}
        </ol>
      </div>

      {entries.map(([key, v], i) => (
        <div key={key} className="hv-variant">
          <div className="hv-label">
            <b>{i + 1}. {v.label}</b>
            <span>{v.note}</span>
            <code>themeKey=&quot;{key}&quot;</code>
          </div>
          <HeroSection registerHref={registerHref} themeKey={key} idPrefix={`hv-${key}`} />
          <div style={{ background: v.theme.after }}>
            <ProblemSection />
          </div>
        </div>
      ))}
    </div>
  )
}
