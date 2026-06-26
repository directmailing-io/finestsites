import type { Metadata } from 'next'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'

export const metadata: Metadata = {
  title: 'Impressum – FinestSites',
  description: 'Impressum und Anbieterkennzeichnung gemäß § 5 TMG für FinestSites.',
  robots: { index: false },
}

export default function ImpressumPage() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
      <NavBar />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '120px 24px 96px' }}>
        <h1 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', marginBottom: 48 }}>
          Impressum
        </h1>

        <Section title="Angaben gemäß § 5 TMG">
          <p>
            FinestSites Daniel Kurzeja<br />
            Herrleinstr. 39<br />
            97437 Haßfurt<br />
            Deutschland
          </p>
        </Section>

        <Section title="Kontakt">
          <p>
            Telefon: <a href="tel:+4915151005561" style={{ color: '#8060b0' }}>+49 151 51005561</a><br />
            E-Mail: <a href="mailto:hello@finestsites.io" style={{ color: '#8060b0' }}>hello@finestsites.io</a>
          </p>
        </Section>

        <Section title="Umsatzsteuer-Identifikationsnummer">
          <p>
            Gemäß § 27a Umsatzsteuergesetz:<br />
            <strong>DE369220308</strong>
          </p>
        </Section>

        <Section title="Inhaltlich verantwortlich gemäß § 18 Abs. 2 MStV">
          <p>
            Daniel Kurzeja<br />
            Herrleinstr. 39<br />
            97437 Haßfurt
          </p>
        </Section>

        <Section title="EU-Streitschlichtung">
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" style={{ color: '#8060b0' }}>
              https://ec.europa.eu/consumers/odr/
            </a>
          </p>
          <p style={{ marginTop: 12 }}>
            Unsere E-Mail-Adresse finden Sie oben im Impressum.
          </p>
          <p style={{ marginTop: 12 }}>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </Section>

        <Section title="Haftung für Inhalte">
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten
            nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
            Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
            Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
            Tätigkeit hinweisen.
          </p>
          <p style={{ marginTop: 12 }}>
            Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den
            allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch
            erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei
            Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend
            entfernen.
          </p>
        </Section>

        <Section title="Haftung für Links">
          <p>
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
            Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
            Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
            Seiten verantwortlich.
          </p>
          <p style={{ marginTop: 12 }}>
            Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße
            überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine
            permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete
            Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von
            Rechtsverletzungen werden wir derartige Links umgehend entfernen.
          </p>
        </Section>

        <Section title="Urheberrecht">
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen
            dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
            Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung
            des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den
            privaten, nicht kommerziellen Gebrauch gestattet.
          </p>
          <p style={{ marginTop: 12 }}>
            Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die
            Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche
            gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden,
            bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen
            werden wir derartige Inhalte umgehend entfernen.
          </p>
        </Section>

        <p style={{ fontSize: 12, color: '#bbb', marginTop: 48 }}>
          Stand: Juni 2026
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
      <div style={{ fontSize: 15, color: '#444', lineHeight: 1.8 }}>
        {children}
      </div>
      <hr style={{ marginTop: 40, border: 'none', borderTop: '1px solid #F1F1F1' }} />
    </div>
  )
}
