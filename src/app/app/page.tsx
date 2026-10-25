import type { Metadata } from 'next'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'

export const metadata: Metadata = {
  title: 'FinestSites-App – Deine Webseiten in der Tasche',
  description: 'Die FinestSites-App für iPhone und iPad: Anfragen sofort sehen, Webseiten bearbeiten und veröffentlichen, Besucher-Chat, Partnerprogramm und Hilfe direkt in der App.',
  alternates: { canonical: 'https://finestsites.io/app' },
}

const link = { color: '#8060b0' }

const FEATURES: { title: string; text: string }[] = [
  {
    title: 'Anfragen sofort sehen',
    text: 'Jede Kontaktanfrage von deiner Webseite kommt als Mitteilung aufs Handy. Anrufen, auf WhatsApp schreiben oder per E-Mail antworten – mit einem Tipp.',
  },
  {
    title: 'Webseiten bearbeiten und veröffentlichen',
    text: 'Texte, Bilder, Farben und Kontaktdaten ändern, Vorschau ansehen und live stellen. Alles, was du vom Dashboard kennst.',
  },
  {
    title: 'Besucher-Chat',
    text: 'Besucher deiner Webseite können dir direkt schreiben. Du antwortest in der App, auch unterwegs.',
  },
  {
    title: 'Partnerprogramm im Blick',
    text: 'Empfehlungslink teilen, Stand deiner Empfehlungen und Gutschriften einsehen.',
  },
  {
    title: 'Hilfe direkt in der App',
    text: 'Unser Team antwortet dir im Support-Chat – ohne E-Mail, ohne Warteschleife.',
  },
]

export default function AppPage() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
      <NavBar />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '120px 24px 96px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8060b0', marginBottom: 14 }}>
          FinestSites-App
        </p>
        <h1 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', marginBottom: 16, lineHeight: 1.1 }}>
          Deine Webseiten in der Tasche.
        </h1>
        <p style={{ fontSize: 17, color: '#555', lineHeight: 1.7, marginBottom: 16 }}>
          Mit der FinestSites-App behältst du deine Webseiten, Anfragen und Besucher-Nachrichten immer im
          Blick – auf iPhone und iPad. Die Android-Version folgt.
        </p>
        <p style={{ fontSize: 15, color: '#777', lineHeight: 1.7, marginBottom: 56 }}>
          Die App ergänzt dein FinestSites-Konto. Du meldest dich mit deinen bestehenden Zugangsdaten an;
          ein Konto erstellst du auf finestsites.io. Bald im App Store.
        </p>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 20 }}>Was die App kann</h2>
        <div style={{ display: 'grid', gap: 12, marginBottom: 56 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ border: '1px solid #ECECEC', borderRadius: 16, padding: '18px 20px', background: '#FAFAFA' }}>
              <p style={{ fontWeight: 700, color: '#111', margin: '0 0 4px', fontSize: 16 }}>{f.title}</p>
              <p style={{ margin: 0, fontSize: 15, color: '#444', lineHeight: 1.7 }}>{f.text}</p>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 12 }}>Hilfe &amp; Kontakt</h2>
        <div style={{ fontSize: 15, color: '#444', lineHeight: 1.8, marginBottom: 56 }}>
          <p>
            Schnellste Hilfe: der <strong>Support-Chat</strong> in der App unter <em>Hilfe</em> und im Dashboard.
            Unser Team antwortet so schnell wie möglich, meist innerhalb eines Werktags.
          </p>
          <p style={{ marginTop: 10 }}>
            E-Mail: <a href="mailto:info@finestsites.io" style={link}>info@finestsites.io</a><br />
            Telefon: <a href="tel:+4915151005561" style={link}>+49 151 51005561</a>
          </p>
          <p style={{ marginTop: 10 }}>
            FinestSites Daniel Kurzeja · Herrleinstr. 39 · 97437 Haßfurt · Deutschland
          </p>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 12 }}>Konto und Daten</h2>
        <div style={{ fontSize: 15, color: '#444', lineHeight: 1.8 }}>
          <p>
            Die App enthält keine Werbung und kein Tracking. Push-Mitteilungen kannst du jederzeit in der
            App unter <em>Konto → Mitteilungen</em> oder in den Einstellungen deines Geräts abschalten.
            Dein Konto löschst du direkt in der App unter <em>Konto → Konto löschen</em>.
          </p>
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li><a href="/datenschutz" style={link}>Datenschutzerklärung</a> (Abschnitt 13: FinestSites-App)</li>
            <li style={{ marginTop: 4 }}><a href="/konto-loeschen" style={link}>Konto löschen</a></li>
            <li style={{ marginTop: 4 }}><a href="/agb" style={link}>Allgemeine Geschäftsbedingungen</a></li>
            <li style={{ marginTop: 4 }}><a href="/impressum" style={link}>Impressum</a></li>
          </ul>
        </div>
      </main>

      <Footer />
    </div>
  )
}
