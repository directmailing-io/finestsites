import type { Metadata } from 'next'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'

export const metadata: Metadata = {
  title: 'Konto löschen – FinestSites',
  description: 'So löschst du dein FinestSites-Konto: in der App, im Dashboard oder per E-Mail. Was dabei passiert, was gelöscht wird und wie du es abbrechen kannst.',
  alternates: { canonical: 'https://finestsites.io/konto-loeschen' },
}

const link = { color: '#8060b0' }

export default function KontoLoeschenPage() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
      <NavBar />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '120px 24px 96px' }}>
        <h1 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', marginBottom: 16 }}>
          Konto löschen
        </h1>
        <p style={{ fontSize: 17, color: '#555', lineHeight: 1.7, marginBottom: 48 }}>
          Du kannst dein FinestSites-Konto jederzeit selbst löschen. Hier steht, wie das geht, was dabei
          passiert und wie du es dir innerhalb der Bedenkzeit anders überlegen kannst.
        </p>

        <Section title="Drei Wege">
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            <li>
              <strong>In der App:</strong> <em>Konto → Konto löschen</em>. Passwort eingeben, Variante wählen, bestätigen.
            </li>
            <li style={{ marginTop: 10 }}>
              <strong>Im Dashboard:</strong> <a href="https://app.finestsites.io/settings" style={link}>app.finestsites.io</a> →{' '}
              <em>Einstellungen → Konto &amp; FAQ → Konto löschen</em>.
            </li>
            <li style={{ marginTop: 10 }}>
              <strong>Per E-Mail:</strong>{' '}
              <a href="mailto:info@finestsites.io?subject=Konto%20l%C3%B6schen" style={link}>info@finestsites.io</a>{' '}
              mit dem Betreff „Konto löschen“ von der E-Mail-Adresse deines Kontos. Wir bestätigen die
              Anfrage und stoßen denselben Ablauf an.
            </li>
          </ol>
        </Section>

        <Section title="Wann dein Konto gelöscht wird">
          <p>Hast du ein laufendes, bezahltes Abonnement, wählst du beim Löschen eine von zwei Varianten:</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <Box title="Zum Laufzeitende">
              Dein Abo wird zum Ende der bereits bezahlten Zeit gekündigt, es wird nichts mehr abgebucht.
              Deine Webseiten bleiben bis dahin online. Danach gehen sie offline, und dein Konto wird
              gelöscht – 14 Tage nach deiner Anfrage, frühestens aber zum Laufzeitende.
            </Box>
            <Box title="Sofort">
              Deine Webseiten gehen sofort offline, dein Abo endet sofort. Bereits bezahlte Zeit wird
              nicht erstattet. Dein Konto wird 14 Tage nach deiner Anfrage gelöscht.
            </Box>
          </div>
          <p style={{ marginTop: 14 }}>
            Ohne bezahltes Abo oder bei einer offenen Zahlungsstörung gibt es nur die Variante „sofort“.
          </p>
        </Section>

        <Section title="Bedenkzeit und Abbruch">
          <p>
            Bis zur endgültigen Löschung kannst du dich weiter anmelden. Dashboard und App zeigen dann nur
            noch den Hinweis „Konto wird gelöscht am …“ mit dem Knopf <strong>Löschung abbrechen</strong>.
          </p>
          <ul style={{ marginTop: 10, paddingLeft: 20 }}>
            <li>Variante „zum Laufzeitende“: Nach dem Abbruch läuft dein Abo normal weiter, deine Webseiten bleiben online.</li>
            <li style={{ marginTop: 6 }}>Variante „sofort“: Das beendete Abo lebt nicht wieder auf. Deine Webseiten bleiben offline, bis du sie neu veröffentlichst.</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            Sofort nach der Anfrage wirst du auf allen Geräten abgemeldet, Push-Mitteilungen enden, und du
            bekommst eine Bestätigung per E-Mail. In der Bedenkzeit sind Veröffentlichen, neue Webseiten und
            Abo-Änderungen gesperrt.
          </p>
        </Section>

        <Section title="Was gelöscht wird – und was bleibt">
          <p><strong>Gelöscht werden</strong> dein Profil, alle Webseiten mit Inhalten und Bildern, die Anfragen und
            Besucher-Nachrichten von deinen Webseiten, deine Support-Unterhaltungen, Tracking-Einstellungen,
            Mitteilungen, Anmeldedaten und die Verbindung eigener Domains.</p>
          <p style={{ marginTop: 10 }}><strong>Bestehen bleiben</strong> nur, was das Gesetz verlangt oder andere schützt:
            dein Benutzername (wird nicht neu vergeben, damit alte Links nie auf eine andere Person zeigen),
            Rechnungen bei unserem Zahlungsdienstleister Stripe sowie Gutschriften und Provisionsbuchungen
            aus dem Partnerprogramm für 8 bzw. 10 Jahre. Offenes Partner-Guthaben verfällt nicht ohne deine
            ausdrückliche Erklärung.</p>
          <p style={{ marginTop: 10 }}>
            Alle Einzelheiten und Rechtsgrundlagen stehen in der{' '}
            <a href="/datenschutz" style={link}>Datenschutzerklärung, Ziffer 14</a>.
          </p>
        </Section>

        <Section title="Fragen?">
          <p>
            Schreib uns an <a href="mailto:info@finestsites.io" style={link}>info@finestsites.io</a> oder
            im Support-Chat in App und Dashboard. Wir antworten so schnell wie möglich, meist innerhalb eines Werktags.
          </p>
        </Section>
      </main>

      <Footer />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 12, lineHeight: 1.3 }}>{title}</h2>
      <div style={{ fontSize: 15, color: '#444', lineHeight: 1.8 }}>{children}</div>
      <hr style={{ marginTop: 40, border: 'none', borderTop: '1px solid #F1F1F1' }} />
    </div>
  )
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #ECECEC', borderRadius: 16, padding: '16px 18px', background: '#FAFAFA' }}>
      <p style={{ fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{title}</p>
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  )
}
