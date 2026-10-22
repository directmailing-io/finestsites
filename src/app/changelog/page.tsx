import type { Metadata } from 'next'
import Link from 'next/link'

/* ── Changelog: nicht verlinkte Unterseite auf finestsites.io ──
 * Eine durchgehende Zeitleiste: oben gestrichelt das Geplante, dann „Heute“, darunter
 * alles, was seit dem Start live gegangen ist (neueste zuerst). Jeder größere Schritt
 * bekommt eine kleine, aus CSS gebaute UI-Grafik statt eines Screenshots.
 * Nicht in sitemap.ts, robots.ts sperrt alles außer / und /webinar, dazu noindex. */

export const metadata: Metadata = {
  title: 'Changelog · FinestSites',
  description: 'Was bei FinestSites neu ist und was als Nächstes kommt.',
  robots: { index: false, follow: false },
}

type Visual =
  | 'editor' | 'phone' | 'publish' | 'legal' | 'shield' | 'chat' | 'flags' | 'colors'
  | 'duo' | 'qr' | 'domain' | 'chart' | 'mail' | 'card' | 'mic' | 'templates' | 'app' | 'stats'

type Entry = { date: string; title: string; text: string; visual?: Visual; tag?: string }
type Month = { label: string; entries: Entry[] }
type Planned = { title: string; text: string; status: 'Im Test' | 'In Arbeit' | 'Geplant'; visual: Visual }

const PLANNED: Planned[] = [
  { title: 'Chat auf deiner Webseite', status: 'Im Test', visual: 'chat',
    text: 'Besucher schreiben dir direkt auf deiner Seite. Du antwortest aus der App oder vom Computer, wie bei WhatsApp.' },
  { title: 'Die FinestSites-App', status: 'In Arbeit', visual: 'app',
    text: 'Deine Seiten bearbeiten, Anfragen sehen und Nachrichten beantworten. Zuerst für iPhone und iPad, danach für Android.' },
  { title: 'Statistiken für deine Seite', status: 'Geplant', visual: 'stats',
    text: 'Wie viele Menschen deine Seite besuchen, wie lange sie bleiben und wie viele dir schreiben. Auf einen Blick.' },
  { title: 'Erfahrungsbericht per Sprachnachricht', status: 'Geplant', visual: 'mic',
    text: 'Deine Kunden erzählen einfach ins Handy. Daraus entsteht ein fertiger, geprüfter Erfahrungsbericht für deine Seite.' },
  { title: 'Visitenkarten-Generator', status: 'Geplant', visual: 'card',
    text: 'Deine Visitenkarte im Stil deiner Webseite, mit QR-Code. Als Druckdatei zum Herunterladen.' },
  { title: 'Alle Landessprachen', status: 'Geplant', visual: 'flags',
    text: 'Heute sind es bis zu acht Sprachen. Als Nächstes jede Sprache, die deine Besucher sprechen.' },
  { title: 'Weitere Vorlagen', status: 'In Arbeit', visual: 'templates',
    text: 'Neue Seiten für weitere Produkte, Anlässe und Geschäftsideen. Laufend, ohne Aufpreis.' },
]

const HISTORY: Month[] = [
  { label: 'Oktober 2026', entries: [
    { date: '21. Okt', title: 'Kontakt mit einem Tipp', visual: 'chat',
      text: 'Neue Leiste in den Vorlagen: „Kontakt“ öffnet ein kleines Fenster mit WhatsApp, Anfrage und deinen Kanälen.' },
    { date: '16. Okt', title: 'Neues Partnerprogramm', tag: 'Partner',
      text: 'Wer über deine Empfehlung startet, spart im ersten Monat 20 %. Deine Provision bekommst du als Guthaben mit Gutschrift.' },
    { date: '15. Okt', title: 'Du entscheidest, welche Mails du bekommst', visual: 'mail',
      text: 'Neuigkeiten, Tipps und Angebote lassen sich in den Einstellungen einzeln abbestellen.' },
    { date: '14. Okt', title: 'ClaimGuard', visual: 'shield', tag: 'KI',
      text: 'Die KI prüft deine eigenen Texte auf unzulässige Heil- und Wirkaussagen, bevor sie online gehen.' },
    { date: '14. Okt', title: 'Deine eigene Farbe', visual: 'colors',
      text: 'Wähl deine Markenfarbe einmal aus. Alle Vorlagen passen sich an und bleiben trotzdem gut lesbar.' },
    { date: '13. Okt', title: 'Business-Seite in 8 Sprachen',
      text: 'Inklusive Vorstellungsvideo auf Italienisch, Russisch, Ukrainisch, Polnisch, Bulgarisch und Hindi.' },
    { date: '12. Okt', title: 'Eigene Domain noch einfacher', visual: 'domain',
      text: 'Ein einziger DNS-Eintrag reicht. Funktioniert jetzt auch bei Strato, IONOS und all-inkl ohne Umwege.' },
    { date: '10. Okt', title: '8 Sprachen, automatisch übersetzt', visual: 'flags',
      text: 'Deine Texte werden beim Veröffentlichen übersetzt. Besucher sehen die Seite in ihrer Sprache.' },
    { date: '10. Okt', title: 'Entwurf und Live getrennt',
      text: 'Du kannst in Ruhe ändern. Online geht es erst, wenn du auf „Änderungen veröffentlichen“ tippst.' },
    { date: '9. Okt', title: 'Werbe-Tracking', visual: 'chart',
      text: 'Meta, Google Ads und TikTok mit wenigen Klicks verbinden und sehen, was deine Werbung bringt.' },
    { date: '8. Okt', title: 'Partner-Modus mit eigenen Kontakten', visual: 'duo',
      text: 'Zu zweit auf einer Seite: Jede Person mit eigenem Foto, eigenen Social-Links und eigener Nummer.' },
    { date: '7. Okt', title: 'Neue Vorlage: Vitalprofil', visual: 'templates', tag: 'Vorlage',
      text: 'Ein kurzer Selbst-Check für deine Besucher, mit persönlicher Auswertung und Einladung zum Gespräch.' },
    { date: '7. Okt', title: 'Schonfrist bei Zahlungsproblemen',
      text: 'Klappt eine Abbuchung nicht, bleibt deine Seite erst einmal online. Du hast genug Zeit, es zu klären.' },
    { date: '5. Okt', title: 'Übersicht neu gestaltet',
      text: 'Deine Webseiten als klare Karten, getrennt nach Online und Entwürfen, mit beschrifteten Knöpfen.' },
  ]},
  { label: 'September 2026', entries: [
    { date: '24. Sep', title: 'QR-Code für deine Seite', visual: 'qr',
      text: 'Herunterladen und auf Flyer oder Visitenkarte drucken. Er führt direkt zu deiner Webseite.' },
    { date: '24. Sep', title: 'Speichern mit einem Tipp',
      text: 'Im Editor am Handy sicherst du Änderungen jetzt mit einem einzigen Tipp.' },
  ]},
  { label: 'August 2026', entries: [
    { date: '26. Aug', title: 'Erfahrungsberichte sammeln', visual: 'mic',
      text: 'Ein Assistent führt deine Kunden mit Fragen durch ihren Bericht, auf Wunsch mit Video.' },
    { date: '6. Aug', title: 'Neue Preise ab 17 €',
      text: 'Starter, Pro und Unlimited wurden günstiger. Monatlich oder jährlich, jederzeit kündbar.' },
    { date: '5. Aug', title: 'Neue Vorlage mit sechs Farbthemen', visual: 'templates', tag: 'Vorlage',
      text: 'Eine Seite für deine Stoffwechselkur, mit Beispiel-Woche, Duo-Modus und deutsch/englisch.' },
  ]},
  { label: 'Juli 2026', entries: [
    { date: '31. Jul', title: 'Zweisprachige Seiten', visual: 'flags',
      text: 'Deutsch und Englisch auf einer Seite, mit Sprachschalter für deine Besucher.' },
    { date: '28. Jul', title: 'Duo-Modus', visual: 'duo',
      text: 'Du trittst mit deinem Partner auf? Dann steht ihr beide auf der Seite.' },
    { date: '27. Jul', title: 'Farbthemen zum Antippen', visual: 'colors',
      text: 'Jede Vorlage bringt mehrere fertige Farbwelten mit. Ein Tipp, und die ganze Seite wechselt.' },
    { date: '24. Jul', title: 'Jederzeit upgraden',
      text: 'Wechsel in einen größeren Tarif, der Rest des Monats wird genau verrechnet.' },
    { date: '13. Jul', title: 'KI-Textprüfung', visual: 'shield', tag: 'KI',
      text: 'Deine Texte werden vor dem Veröffentlichen geprüft, mit konkreten Vorschlägen zum Umformulieren.' },
    { date: '8. Jul', title: 'Erst gestalten, dann bezahlen', visual: 'publish',
      text: 'Du baust deine Seite kostenlos. Bezahlt wird erst, wenn du sie veröffentlichst.' },
    { date: '8. Jul', title: 'Rechtstexte inklusive', visual: 'legal',
      text: 'Impressum und Datenschutzerklärung sind auf jeder Seite schon drauf.' },
    { date: '1. Jul', title: 'Support-Chat in der App', visual: 'chat',
      text: 'Fragen stellst du direkt im Dashboard, mit Bildern und Verlauf.' },
  ]},
  { label: 'Juni 2026', entries: [
    { date: '27. Jun', title: 'Vorlagen live ausprobieren', visual: 'editor',
      text: 'Auf finestsites.io kannst du jede Vorlage vorab anpassen und siehst sofort das Ergebnis.' },
    { date: '24. Jun', title: 'finestsites.io ist online',
      text: 'Die neue Startseite mit allen Vorlagen und Preisen auf einen Blick.' },
    { date: '23. Jun', title: 'Bezahlen per Lastschrift',
      text: 'Neben Karte jetzt auch SEPA-Lastschrift. Dazu startet das Partnerprogramm.' },
    { date: '9. Jun', title: 'Automatisches Speichern', visual: 'editor',
      text: 'Der Editor sichert jede Änderung von selbst. Dazu kommt die Event-Seite als neue Vorlage.' },
  ]},
  { label: 'Mai 2026', entries: [
    { date: '4. Mai', title: 'Gemacht fürs Handy', visual: 'phone',
      text: 'Dashboard und Editor funktionieren auf Smartphone und Tablet genauso gut wie am Computer.' },
  ]},
  { label: 'April 2026', entries: [
    { date: '12. Apr', title: 'Der Start', visual: 'editor', tag: 'Start',
      text: 'Vorlage wählen, Texte und Bilder eintragen, online. Mit eigener Domain und SSL von Anfang an.' },
  ]},
]

const FLAGS = ['🇩🇪', '🇬🇧', '🇮🇹', '🇵🇱', '🇺🇦', '🇧🇬', '🇷🇺', '🇮🇳']

/** Kleine UI-Grafiken, rein aus CSS, je ca. 132×88 px */
function Viz({ kind }: { kind: Visual }) {
  switch (kind) {
    case 'editor':
      return (
        <div className="v v-editor" aria-hidden>
          <div className="v-ed-side"><i /><i /><i className="on" /><i /></div>
          <div className="v-ed-main"><b /><span /><span className="short" /><em /></div>
        </div>
      )
    case 'phone':
      return (
        <div className="v v-center" aria-hidden>
          <div className="v-phone"><b /><span /><span className="short" /><em /></div>
          <div className="v-tablet"><b /><span /><span className="short" /></div>
        </div>
      )
    case 'app':
      return (
        <div className="v v-center" aria-hidden>
          <div className="v-phone v-phone-app"><div className="v-appicon">f</div><span /><span className="short" /></div>
        </div>
      )
    case 'publish':
      return (
        <div className="v v-center" aria-hidden>
          <div className="v-pill">Veröffentlichen</div>
          <i className="v-conf c1" /><i className="v-conf c2" /><i className="v-conf c3" /><i className="v-conf c4" /><i className="v-conf c5" />
        </div>
      )
    case 'legal':
      return (
        <div className="v v-center v-gap" aria-hidden>
          <div className="v-doc"><b /><span /><span /><span className="short" /><small>Impressum</small></div>
          <div className="v-doc"><b /><span /><span className="short" /><span /><small>Datenschutz</small></div>
        </div>
      )
    case 'shield':
      return (
        <div className="v v-center v-shield" aria-hidden>
          <div className="v-line ok"><i>✓</i><span /></div>
          <div className="v-line bad"><i>!</i><span className="short" /></div>
          <div className="v-line ok"><i>✓</i><span /></div>
        </div>
      )
    case 'chat':
      return (
        <div className="v v-chat" aria-hidden>
          <div className="v-bub in">Hallo! Ist das auch vegan?</div>
          <div className="v-bub out">Ja, komplett 🌱</div>
        </div>
      )
    case 'flags':
      return (
        <div className="v v-center v-flags" aria-hidden>
          {FLAGS.map(f => <span key={f}>{f}</span>)}
        </div>
      )
    case 'colors':
      return (
        <div className="v v-center v-colors" aria-hidden>
          {['#6B4FD8', '#E8618C', '#F59E0B', '#10B981', '#0EA5E9'].map((c, i) => (
            <span key={c} className={i === 1 ? 'on' : ''} style={{ background: c }} />
          ))}
        </div>
      )
    case 'duo':
      return (
        <div className="v v-center v-duo" aria-hidden>
          <span style={{ background: 'linear-gradient(135deg,#FBCFE8,#F9A8D4)' }}>A</span>
          <span style={{ background: 'linear-gradient(135deg,#C7D2FE,#A5B4FC)' }}>M</span>
        </div>
      )
    case 'qr':
      return (
        <div className="v v-center" aria-hidden>
          <div className="v-qr">
            {Array.from({ length: 49 }, (_, i) => {
              const r = Math.floor(i / 7), c = i % 7
              const finder = (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2)
              const on = finder || [3, 9, 17, 19, 23, 25, 31, 33, 38, 40, 44, 46, 48].includes(i)
              return <i key={i} className={on ? 'on' : ''} />
            })}
          </div>
        </div>
      )
    case 'domain':
      return (
        <div className="v v-center" aria-hidden>
          <div className="v-url"><i>🔒</i>www.deine-domain.de</div>
        </div>
      )
    case 'chart':
      return (
        <div className="v v-chart" aria-hidden>
          {[34, 52, 40, 66, 58, 80, 92].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
        </div>
      )
    case 'stats':
      return (
        <div className="v v-stats" aria-hidden>
          <div><small>Besucher</small><b>1.284</b></div>
          <div><small>Anfragen</small><b>37</b></div>
          <svg viewBox="0 0 120 30" preserveAspectRatio="none"><path d="M0 26 L20 20 L40 22 L60 14 L80 16 L100 7 L120 4" /></svg>
        </div>
      )
    case 'mail':
      return (
        <div className="v v-center v-toggles" aria-hidden>
          <div><span>Neuigkeiten</span><i className="on" /></div>
          <div><span>Tipps</span><i className="on" /></div>
          <div><span>Angebote</span><i /></div>
        </div>
      )
    case 'card':
      return (
        <div className="v v-center" aria-hidden>
          <div className="v-bizcard"><div><b /><span /><span className="short" /></div><div className="v-miniqr" /></div>
        </div>
      )
    case 'mic':
      return (
        <div className="v v-center v-mic" aria-hidden>
          <div className="v-micbtn">●</div>
          <div className="v-wave">{[30, 70, 45, 90, 55, 80, 35, 60, 25].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
        </div>
      )
    case 'templates':
      return (
        <div className="v v-center v-tpls" aria-hidden>
          <div style={{ background: 'linear-gradient(160deg,#EDE9FE,#DDD6FE)' }}><b /><span /></div>
          <div style={{ background: 'linear-gradient(160deg,#DCFCE7,#BBF7D0)' }}><b /><span /></div>
          <div style={{ background: 'linear-gradient(160deg,#FFE4E6,#FECDD3)' }}><b /><span /></div>
        </div>
      )
  }
}

export default function ChangelogPage() {
  const total = HISTORY.reduce((n, m) => n + m.entries.length, 0)

  return (
    <main className="cl">
      <style>{`
        @font-face { font-family: 'Plus Jakarta Sans'; src: url('/fonts/PlusJakartaSans-latin.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
        @font-face { font-family: 'Plein'; src: url('/fonts/Plein-Regular.otf') format('opentype'); font-weight: 400; font-display: swap; }

        .cl {
          --ink: #14121F; --muted: #6B6880; --soft: #9C99AE; --line: #E9E6F2; --bg: #FAFAF8; --card: #FFFFFF;
          --accent: #6B4FD8; --accent-soft: #EFE9FF;
          min-height: 100vh; background: var(--bg); color: var(--ink);
          font-family: 'Plus Jakarta Sans', var(--font-geist-sans), system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .cl-wrap { max-width: 860px; margin: 0 auto; padding: 0 24px; }
        .cl-top { display: flex; align-items: center; justify-content: space-between; padding: 28px 0; }
        .cl-top a { display: block; }
        .cl-top span { font-size: 13px; color: var(--soft); }

        .cl-hero { padding: 56px 0 40px; }
        .cl-eyebrow { font-size: 14px; font-weight: 700; color: var(--accent); margin: 0 0 14px; }
        .cl-h1 { font-family: 'Plein', sans-serif; font-weight: 400; font-size: clamp(38px, 6vw, 64px); line-height: 1.04; letter-spacing: -0.03em; margin: 0; }
        .cl-lead { font-size: 17px; line-height: 1.6; color: var(--muted); max-width: 520px; margin: 18px 0 0; }
        .cl-facts { display: flex; gap: 28px; margin-top: 32px; flex-wrap: wrap; }
        .cl-facts div { font-size: 13px; color: var(--soft); }
        .cl-facts b { display: block; font-size: 22px; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }

        /* ── Zeitleiste ── */
        .tl { position: relative; padding: 24px 0 96px; }
        .tl-sec { position: relative; display: grid; grid-template-columns: 110px 1fr; }
        .tl-sec::before { content: ''; position: absolute; left: 110px; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: var(--line); }
        .tl-sec.future::before { background: repeating-linear-gradient(to bottom, #CFC6F5 0 6px, transparent 6px 12px); }
        .tl-head { grid-column: 1 / -1; position: sticky; top: 0; z-index: 3; padding: 14px 0 10px; background: linear-gradient(var(--bg) 70%, transparent); }
        .tl-head h2 { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--soft); }

        .tl-item { display: contents; }
        .tl-date { padding: 22px 26px 0 0; text-align: right; font-size: 13px; font-weight: 600; color: var(--soft); white-space: nowrap; }
        .tl-body { position: relative; padding: 12px 0 12px 34px; }
        .tl-body::before { content: ''; position: absolute; left: -6px; top: 26px; width: 12px; height: 12px; border-radius: 50%;
          background: var(--card); border: 2px solid var(--accent); box-sizing: border-box; }
        .future .tl-body::before { border-style: dashed; border-color: #B7A9F0; }

        .card { display: flex; gap: 20px; align-items: center; justify-content: space-between; padding: 18px 20px; border-radius: 18px;
          background: var(--card); border: 1px solid var(--line); box-shadow: 0 1px 2px rgba(20,18,31,0.03); }
        .card-text { min-width: 0; }
        .card h3 { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.3; }
        .card p { margin: 6px 0 0; font-size: 14.5px; line-height: 1.55; color: var(--muted); }
        .tag { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700;
          vertical-align: 2px; background: var(--accent-soft); color: var(--accent); }
        .st { display: inline-block; margin-bottom: 8px; padding: 3px 9px; border-radius: 99px; font-size: 11.5px; font-weight: 700; }
        .st-test { background: #DCFCE7; color: #15803D; }
        .st-work { background: #FEF3C7; color: #B45309; }
        .st-plan { background: #F1F0F5; color: #6B6880; }

        .now { grid-column: 1 / -1; display: grid; grid-template-columns: 110px 1fr; align-items: center; padding: 18px 0; }
        .now-label { text-align: right; padding-right: 26px; font-size: 13px; font-weight: 700; color: var(--accent); }
        .now-bar { position: relative; padding-left: 34px; font-size: 14px; color: var(--muted); }
        .now-bar::before { content: ''; position: absolute; left: -9px; top: 50%; width: 18px; height: 18px; margin-top: -9px; border-radius: 50%;
          background: var(--accent); box-shadow: 0 0 0 6px rgba(107,79,216,0.15); }

        /* ── Grafiken ── */
        .v { position: relative; flex: none; width: 132px; height: 88px; border-radius: 12px; background: #F6F4FB; overflow: hidden; }
        .v-center { display: flex; align-items: center; justify-content: center; }
        .v-gap { gap: 8px; }
        .v b, .v span, .v em { display: block; border-radius: 3px; }
        .v-editor { display: flex; gap: 6px; padding: 10px; box-sizing: border-box; }
        .v-ed-side { display: flex; flex-direction: column; gap: 5px; width: 30px; }
        .v-ed-side i { display: block; height: 10px; border-radius: 3px; background: #E4E0F0; }
        .v-ed-side i.on { background: var(--accent); }
        .v-ed-main { flex: 1; background: #fff; border-radius: 6px; padding: 8px; display: flex; flex-direction: column; gap: 5px; }
        .v-ed-main b { height: 8px; width: 70%; background: #D9D3EE; }
        .v-ed-main span, .v-phone span, .v-tablet span, .v-doc span, .v-bizcard span { height: 4px; background: #ECE9F4; }
        .v .short { width: 60%; }
        .v-ed-main em { margin-top: auto; height: 10px; width: 46%; border-radius: 99px; background: var(--accent); }
        .v-phone { width: 36px; height: 66px; border-radius: 9px; border: 2px solid #2A2738; background: #fff; padding: 8px 5px; box-sizing: border-box; display: flex; flex-direction: column; gap: 4px; }
        .v-phone b, .v-tablet b { height: 12px; border-radius: 3px; background: #D9D3EE; }
        .v-phone em { margin-top: auto; height: 6px; border-radius: 99px; background: var(--accent); }
        .v-tablet { width: 62px; height: 48px; margin-left: 8px; border-radius: 7px; border: 2px solid #2A2738; background: #fff; padding: 6px; box-sizing: border-box; display: flex; flex-direction: column; gap: 4px; }
        .v-phone-app { width: 42px; height: 72px; align-items: center; justify-content: center; }
        .v-phone-app span { width: 100%; }
        .v-appicon { width: 22px; height: 22px; border-radius: 6px; background: var(--ink); color: #fff; font: 700 14px/22px 'Plein', sans-serif; text-align: center; margin-bottom: 6px; }
        .v-pill { position: relative; z-index: 1; padding: 8px 14px; border-radius: 99px; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; }
        .v-conf { position: absolute; width: 6px; height: 9px; border-radius: 2px; }
        .c1 { left: 18px; top: 14px; background: #F59E0B; transform: rotate(20deg); }
        .c2 { right: 20px; top: 12px; background: #E8618C; transform: rotate(-30deg); }
        .c3 { left: 28px; bottom: 12px; background: #10B981; transform: rotate(-15deg); }
        .c4 { right: 26px; bottom: 16px; background: #0EA5E9; transform: rotate(40deg); }
        .c5 { left: 62px; top: 8px; background: #A78BFA; transform: rotate(70deg); }
        .v-doc { width: 46px; height: 62px; border-radius: 5px; background: #fff; border: 1px solid #E4E0F0; padding: 7px 6px; box-sizing: border-box; display: flex; flex-direction: column; gap: 4px; position: relative; }
        .v-doc b { height: 5px; width: 70%; background: #CFC6F5; }
        .v-doc small { position: absolute; left: 0; right: 0; bottom: 4px; text-align: center; font-size: 6.5px; font-weight: 700; color: var(--soft); }
        .v-shield { flex-direction: column; gap: 6px; }
        .v-line { display: flex; align-items: center; gap: 6px; width: 96px; }
        .v-line i { flex: none; width: 14px; height: 14px; border-radius: 50%; font: 700 9px/14px sans-serif; font-style: normal; text-align: center; color: #fff; }
        .v-line span { flex: 1; height: 5px; background: #E4E0F0; }
        .v-line.ok i { background: #10B981; }
        .v-line.bad i { background: #F59E0B; }
        .v-line.bad span { background: #FDE68A; }
        .v-chat { display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 0 10px; }
        .v-bub { max-width: 82%; padding: 6px 9px; border-radius: 12px; font-size: 9.5px; line-height: 1.3; }
        .v-bub.in { align-self: flex-start; background: #fff; border-bottom-left-radius: 4px; color: var(--ink); }
        .v-bub.out { align-self: flex-end; background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
        .v-flags { flex-wrap: wrap; gap: 5px; padding: 0 14px; }
        .v-flags span { font-size: 17px; line-height: 1; }
        .v-colors { gap: 7px; }
        .v-colors span { width: 18px; height: 18px; border-radius: 50%; }
        .v-colors span.on { box-shadow: 0 0 0 2px #F6F4FB, 0 0 0 4px currentColor; color: #E8618C; transform: scale(1.12); }
        .v-duo span { width: 38px; height: 38px; border-radius: 50%; border: 3px solid #F6F4FB; font: 700 14px/32px 'Plus Jakarta Sans', sans-serif; text-align: center; color: rgba(20,18,31,0.55); }
        .v-duo span + span { margin-left: -10px; }
        .v-qr { display: grid; grid-template-columns: repeat(7, 7px); gap: 1.5px; padding: 6px; background: #fff; border-radius: 6px; }
        .v-qr i { width: 7px; height: 7px; border-radius: 1.5px; background: transparent; }
        .v-qr i.on { background: var(--ink); }
        .v-url { display: flex; align-items: center; gap: 5px; padding: 7px 10px; border-radius: 99px; background: #fff; border: 1px solid #E4E0F0; font-size: 9.5px; font-weight: 600; color: var(--ink); white-space: nowrap; }
        .v-url i { font-style: normal; font-size: 9px; }
        .v-chart { display: flex; align-items: flex-end; gap: 6px; padding: 14px 14px 12px; box-sizing: border-box; }
        .v-chart i { flex: 1; border-radius: 3px 3px 1px 1px; background: linear-gradient(180deg, #A78BFA, var(--accent)); }
        .v-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; padding: 10px 12px; box-sizing: border-box; }
        .v-stats small { display: block; font-size: 7.5px; color: var(--soft); font-weight: 600; }
        .v-stats b { font-size: 14px; font-weight: 700; letter-spacing: -0.02em; background: none; }
        .v-stats svg { grid-column: 1 / -1; width: 100%; height: 30px; }
        .v-stats path { fill: none; stroke: var(--accent); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
        .v-toggles { flex-direction: column; gap: 6px; }
        .v-toggles div { display: flex; align-items: center; justify-content: space-between; width: 100px; }
        .v-toggles span { font-size: 9px; font-weight: 600; color: var(--muted); background: none; }
        .v-toggles i { width: 20px; height: 11px; border-radius: 99px; background: #DCD8E6; position: relative; }
        .v-toggles i::after { content: ''; position: absolute; top: 1.5px; left: 1.5px; width: 8px; height: 8px; border-radius: 50%; background: #fff; }
        .v-toggles i.on { background: #10B981; }
        .v-toggles i.on::after { left: 10.5px; }
        .v-bizcard { display: flex; align-items: center; gap: 8px; width: 104px; height: 60px; padding: 9px; box-sizing: border-box; border-radius: 6px; background: #fff;
          box-shadow: 0 6px 16px rgba(20,18,31,0.10); transform: rotate(-4deg); }
        .v-bizcard > div:first-child { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .v-bizcard b { height: 6px; width: 80%; background: var(--accent); }
        .v-miniqr { flex: none; width: 24px; height: 24px; border-radius: 3px;
          background: conic-gradient(var(--ink) 25%, #fff 0 50%, var(--ink) 0 75%, #fff 0) 0 0 / 8px 8px; }
        .v-mic { gap: 10px; }
        .v-micbtn { width: 30px; height: 30px; border-radius: 50%; background: #EF4444; color: #fff; font-size: 10px; line-height: 30px; text-align: center; box-shadow: 0 0 0 5px rgba(239,68,68,0.15); }
        .v-wave { display: flex; align-items: center; gap: 3px; height: 34px; }
        .v-wave i { width: 3px; border-radius: 99px; background: #CFC6F5; }
        .v-tpls { gap: 6px; }
        .v-tpls div { width: 30px; height: 52px; border-radius: 5px; padding: 6px 4px; box-sizing: border-box; display: flex; flex-direction: column; gap: 4px; }
        .v-tpls b { height: 14px; background: rgba(255,255,255,0.75); }
        .v-tpls span { height: 3px; background: rgba(20,18,31,0.12); }

        /* Sanftes Einblenden beim Scrollen, nur wo der Browser es nativ kann */
        @supports (animation-timeline: view()) {
          @media (prefers-reduced-motion: no-preference) {
            .card { animation: cl-in linear both; animation-timeline: view(); animation-range: entry 0% entry 40%; }
            @keyframes cl-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
          }
        }

        .cl-foot { padding: 0 0 56px; font-size: 13px; color: var(--soft); text-align: center; }
        .cl-foot a { color: var(--muted); }

        @media (max-width: 640px) {
          .cl-wrap { padding: 0 16px; }
          .cl-hero { padding: 32px 0 24px; }
          .tl-sec, .now { grid-template-columns: 1fr; }
          .tl-sec::before { left: 6px; }
          .tl-head { padding-left: 28px; }
          .tl-date { padding: 14px 0 0 28px; text-align: left; }
          .tl-body { padding: 6px 0 8px 28px; }
          .tl-body::before { left: 0; top: -12px; }
          .now-label { text-align: left; padding: 0 0 0 28px; }
          .now-bar { padding-left: 28px; margin-top: 4px; }
          .now-bar::before { left: -3px; top: -11px; margin-top: 0; }
          .card { flex-direction: column-reverse; align-items: stretch; padding: 16px; gap: 14px; }
          .v { width: 100%; height: 96px; }
        }
      `}</style>

      <div className="cl-wrap">
        <header className="cl-top">
          <Link href="/"><img src="/logos/logo-black.svg" alt="FinestSites" style={{ height: 22 }} /></Link>
          <span>Changelog</span>
        </header>

        <section className="cl-hero">
          <p className="cl-eyebrow">Was ist neu</p>
          <h1 className="cl-h1">Jede Woche ein<br />bisschen besser.</h1>
          <p className="cl-lead">Alles, was seit dem Start dazugekommen ist, und was wir als Nächstes bauen. Neueste Änderungen zuerst.</p>
          <div className="cl-facts">
            <div><b>April 2026</b>Start</div>
            <div><b>{total}</b>große Neuerungen</div>
            <div><b>{PLANNED.length}</b>Projekte in Planung</div>
          </div>
        </section>

        <div className="tl">
          <section className="tl-sec future">
            <div className="tl-head"><h2>Als Nächstes</h2></div>
            {PLANNED.map(p => (
              <div className="tl-item" key={p.title}>
                <div className="tl-date" />
                <div className="tl-body">
                  <article className="card">
                    <div className="card-text">
                      <span className={`st ${p.status === 'Im Test' ? 'st-test' : p.status === 'In Arbeit' ? 'st-work' : 'st-plan'}`}>{p.status}</span>
                      <h3>{p.title}</h3>
                      <p>{p.text}</p>
                    </div>
                    <Viz kind={p.visual} />
                  </article>
                </div>
              </div>
            ))}
          </section>

          <div className="now">
            <div className="now-label">Heute</div>
            <div className="now-bar">Stand: 22. Oktober 2026</div>
          </div>

          {HISTORY.map(m => (
            <section className="tl-sec" key={m.label}>
              <div className="tl-head"><h2>{m.label}</h2></div>
              {m.entries.map(e => (
                <div className="tl-item" key={e.date + e.title}>
                  <div className="tl-date">{e.date}</div>
                  <div className="tl-body">
                    <article className="card">
                      <div className="card-text">
                        <h3>{e.title}{e.tag && <span className="tag">{e.tag}</span>}</h3>
                        <p>{e.text}</p>
                      </div>
                      {e.visual && <Viz kind={e.visual} />}
                    </article>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>

        <footer className="cl-foot">
          <Link href="/">finestsites.io</Link> · <Link href="/impressum">Impressum</Link> · <Link href="/datenschutz">Datenschutz</Link>
        </footer>
      </div>
    </main>
  )
}
