import type { Metadata } from 'next'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'

export const metadata: Metadata = {
  title: 'Widerrufsbelehrung – FinestSites',
  description: 'Widerrufsbelehrung und Muster-Widerrufsformular für Abonnements auf FinestSites.',
  robots: { index: true },
}

export default function WiderrufsbelehrungPage() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
      <NavBar />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '120px 24px 96px' }}>
        <h1 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', marginBottom: 12 }}>
          Widerrufsbelehrung
        </h1>
        <p style={{ fontSize: 14, color: '#aaa', marginBottom: 56 }}>Stand: Juli 2026</p>

        <Section title="Widerrufsrecht">
          <p>
            Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
          </p>
          <p style={{ marginTop: 12 }}>
            Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
          </p>
          <p style={{ marginTop: 12 }}>
            Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
          </p>
          <p style={{ marginTop: 12, padding: '16px 20px', background: '#f9f9f9', borderRadius: 8, lineHeight: 1.9 }}>
            FinestSites Daniel Kurzeja<br />
            Herrleinstr. 39<br />
            97437 Haßfurt<br />
            Deutschland<br />
            E-Mail: <a href="mailto:hello@finestsites.io" style={{ color: '#8060b0' }}>hello@finestsites.io</a>
          </p>
          <p style={{ marginTop: 12 }}>
            mittels einer eindeutigen Erklärung (z. B. eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen,
            informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht
            vorgeschrieben ist.
          </p>
          <p style={{ marginTop: 12 }}>
            Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts
            vor Ablauf der Widerrufsfrist absenden.
          </p>
        </Section>

        <Section title="Folgen des Widerrufs">
          <p>
            Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben,
            unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über
            Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe
            Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde
            ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte
            berechnet.
          </p>
        </Section>

        <Section title="Vorzeitiges Erlöschen des Widerrufsrechts">
          <p>
            <strong>Hinweis zum vorzeitigen Erlöschen des Widerrufsrechts bei digitalen Dienstleistungen:</strong>
          </p>
          <p style={{ marginTop: 12 }}>
            Wenn Sie ausdrücklich zustimmen, dass wir vor Ende der Widerrufsfrist mit der Ausführung der
            Dienstleistung beginnen, und Sie bestätigen, dass Sie mit Beginn der Ausführung Ihr Widerrufsrecht
            verlieren, erlischt Ihr Widerrufsrecht gemäß § 356 Abs. 5 BGB mit Beginn der Dienstleistungserbringung.
          </p>
          <p style={{ marginTop: 12 }}>
            Bei Abschluss eines Abonnements auf app.finestsites.io erklären Sie durch Aktivierung der
            entsprechenden Checkbox ausdrücklich, dass Sie mit dem sofortigen Beginn der Dienstleistung
            einverstanden sind und zur Kenntnis nehmen, dass Ihr Widerrufsrecht damit erlischt.
          </p>
          <p style={{ marginTop: 12 }}>
            Nach vollständiger Erfüllung des Vertrags durch uns beginnt Ihr Widerrufsrecht ebenfalls nicht
            erneut, auch wenn Sie das Abonnement verlängert haben.
          </p>
        </Section>

        <Section title="Muster-Widerrufsformular">
          <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>
            (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)
          </p>
          <div style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: '24px 28px', lineHeight: 2, fontSize: 14 }}>
            <p>An:</p>
            <p style={{ marginTop: 4, marginLeft: 16, color: '#444' }}>
              FinestSites Daniel Kurzeja<br />
              Herrleinstr. 39<br />
              97437 Haßfurt<br />
              E-Mail: hello@finestsites.io
            </p>
            <p style={{ marginTop: 16 }}>
              Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung
              der folgenden Dienstleistung:
            </p>
            <p style={{ marginTop: 8, marginLeft: 16, color: '#888' }}>
              _________________________________________________________________
            </p>
            <p style={{ marginTop: 12 }}>Bestellt am (*) / erhalten am (*):</p>
            <p style={{ marginLeft: 16, color: '#888' }}>
              _________________________________________________________________
            </p>
            <p style={{ marginTop: 12 }}>Name des/der Verbraucher(s):</p>
            <p style={{ marginLeft: 16, color: '#888' }}>
              _________________________________________________________________
            </p>
            <p style={{ marginTop: 12 }}>Anschrift des/der Verbraucher(s):</p>
            <p style={{ marginLeft: 16, color: '#888' }}>
              _________________________________________________________________
            </p>
            <p style={{ marginTop: 12 }}>Datum:</p>
            <p style={{ marginLeft: 16, color: '#888' }}>
              _________________________________________________________________
            </p>
            <p style={{ marginTop: 16, fontSize: 12, color: '#aaa' }}>(*) Unzutreffendes streichen.</p>
          </div>
        </Section>

        <p style={{ fontSize: 12, color: '#bbb', marginTop: 48 }}>
          FinestSites Daniel Kurzeja · Herrleinstr. 39 · 97437 Haßfurt · Stand: Juli 2026
        </p>
      </main>

      <Footer />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 12 }}>{title}</h2>
      <div style={{ fontSize: 15, color: '#444', lineHeight: 1.85 }}>
        {children}
      </div>
      <hr style={{ marginTop: 40, border: 'none', borderTop: '1px solid #F1F1F1' }} />
    </div>
  )
}
