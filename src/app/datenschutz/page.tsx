import type { Metadata } from 'next'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung – FinestSites',
  description: 'Datenschutzerklärung von FinestSites gemäß DSGVO.',
  robots: { index: false },
}

export default function DatenschutzPage() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
      <NavBar />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '120px 24px 96px' }}>
        <h1 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', marginBottom: 16 }}>
          Datenschutzerklärung
        </h1>
        <p style={{ fontSize: 14, color: '#bbb', marginBottom: 56 }}>Stand: Juni 2026</p>

        {/* 1 */}
        <Section title="1. Verantwortlicher">
          <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
          <p style={{ marginTop: 12 }}>
            <strong>Daniel Kurzeja</strong><br />
            FinestSites<br />
            Herrleinstr. 39<br />
            97437 Haßfurt<br />
            Deutschland<br /><br />
            Telefon: +49 151 51005561<br />
            E-Mail: <a href="mailto:hello@finestsites.io" style={{ color: '#8060b0' }}>hello@finestsites.io</a>
          </p>
          <p style={{ marginTop: 12 }}>
            Ein Datenschutzbeauftragter ist gemäß Art. 37 DSGVO nicht benannt, da die gesetzlichen
            Voraussetzungen für eine Benennungspflicht nicht vorliegen.
          </p>
        </Section>

        {/* 2 */}
        <Section title="2. Allgemeines zur Datenverarbeitung">
          <p>
            Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies
            zur Bereitstellung einer funktionsfähigen Website sowie unserer Inhalte und Leistungen
            erforderlich ist. Eine regelmäßige Verarbeitung personenbezogener Daten unserer Nutzer
            erfolgt nur, soweit dies gesetzlich gestattet ist oder eine Einwilligung des Nutzers
            vorliegt.
          </p>
          <p style={{ marginTop: 12 }}>
            Soweit wir für Verarbeitungsvorgänge personenbezogener Daten eine Einwilligung der
            betroffenen Person einholen, dient Art. 6 Abs. 1 lit. a DSGVO als Rechtsgrundlage.
            Bei der Verarbeitung von Daten zur Erfüllung eines Vertrags dient Art. 6 Abs. 1 lit. b DSGVO
            als Rechtsgrundlage. Für Verarbeitungen zur Erfüllung rechtlicher Verpflichtungen dient
            Art. 6 Abs. 1 lit. c DSGVO; für Verarbeitungen, die zur Wahrung berechtigter Interessen
            erforderlich sind, Art. 6 Abs. 1 lit. f DSGVO.
          </p>
        </Section>

        {/* 3 */}
        <Section title="3. Hosting – Hetzner Online GmbH">
          <p>
            Unsere Website und Anwendung wird auf Servern der{' '}
            <strong>Hetzner Online GmbH</strong> (Industriestr. 25, 91710 Gunzenhausen, Deutschland)
            gehostet. Die Server befinden sich in den Rechenzentren Nürnberg und Falkenstein
            (Deutschland). Alle verarbeiteten Daten verbleiben damit innerhalb der Europäischen Union.
          </p>
          <p style={{ marginTop: 12 }}>
            Bei jedem Aufruf unserer Website werden durch den Webserver automatisch folgende
            Informationen in Server-Logfiles erfasst:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>IP-Adresse des anfragenden Rechners</li>
            <li>Datum und Uhrzeit des Zugriffs</li>
            <li>Aufgerufene URL</li>
            <li>Übertragene Datenmenge</li>
            <li>HTTP-Statuscode</li>
            <li>Referrer-URL (zuvor besuchte Seite)</li>
            <li>Browser und Betriebssystem</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Diese Daten werden nicht mit anderen Datenquellen zusammengeführt. Rechtsgrundlage
            ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der sicheren und störungsfreien
            Bereitstellung des Dienstes). Die Logfiles werden nach spätestens 30 Tagen gelöscht.
          </p>
          <p style={{ marginTop: 12 }}>
            Mit Hetzner besteht ein Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO.
          </p>
        </Section>

        {/* 4 */}
        <Section title="4. Cookies und Sitzungsdaten">
          <p>
            Unsere Website und Plattform nutzen ausschließlich technisch notwendige Cookies.
            Es werden keine Tracking-, Werbe- oder Analyse-Cookies gesetzt.
          </p>

          <SubHeading>Sitzungscookie (Session-Cookie)</SubHeading>
          <p>
            Nach der Anmeldung auf der Plattform (app.finestsites.io) setzen wir ein
            Session-Cookie, das Ihre Sitzung authentifiziert. Dieses Cookie ist HttpOnly,
            Secure und nach 30 Tagen inaktiver Nutzung ungültig. Es enthält ausschließlich
            eine Sitzungskennung; keine personenbezogenen Daten werden im Cookie selbst
            gespeichert.
          </p>
          <p style={{ marginTop: 8 }}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie § 25 Abs. 2
            Nr. 2 TTDSG (technisch unbedingt erforderlich).
          </p>

          <SubHeading>Template-Auswahl-Cookie (fs_template_intent)</SubHeading>
          <p>
            Wenn Sie auf der Marketingwebsite ein Template auswählen und dann zur Registrierung
            wechseln, setzen wir ein temporäres Cookie (<code>fs_template_intent</code>), das
            Ihre Template-Auswahl für 7 Tage zwischenspeichert. Dieses Cookie enthält
            ausschließlich die Template-ID und dient der Verbesserung Ihrer Nutzererfahrung.
            Es wird nach erfolgreicher Einrichtung Ihres Accounts sofort gelöscht.
          </p>
          <p style={{ marginTop: 8 }}>
            Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TTDSG (technisch unbedingt erforderlich für
            den angeforderten Dienst).
          </p>
        </Section>

        {/* 5 */}
        <Section title="5. Registrierung und Nutzerkonto">
          <p>
            Zur Nutzung unserer Plattform ist die Erstellung eines Nutzerkontos erforderlich.
            Bei der Registrierung erheben wir folgende Daten:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>E-Mail-Adresse</li>
            <li>Passwort (verschlüsselt gespeichert, niemals im Klartext)</li>
            <li>Benutzername</li>
            <li>Optionale Profilangaben: Name, Telefonnummer, Profilbild, Network-Marketing-Unternehmen</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Diese Daten werden in unserer PostgreSQL-Datenbank auf den Hetzner-Servern in
            Deutschland gespeichert. Sie werden ausschließlich zur Bereitstellung der Plattform
            und der damit verbundenen Dienste verwendet.
          </p>
          <p style={{ marginTop: 12 }}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          </p>
          <p style={{ marginTop: 12 }}>
            Daten des Nutzerkontos werden nach Kündigung und Ablauf etwaiger gesetzlicher
            Aufbewahrungsfristen gelöscht. Buchungsrelevante Daten werden gemäß § 257 HGB
            und § 147 AO für 10 Jahre aufbewahrt.
          </p>
        </Section>

        {/* 6 */}
        <Section title="6. Von Nutzern erstellte Websites und Formular-Einreichungen">
          <p>
            Unsere Plattform ermöglicht es Nutzern, eigene Websites zu erstellen und zu
            betreiben. Besucher dieser Websites können über Kontaktformulare Anfragen stellen.
            Diese Formular-Einreichungen (Name, E-Mail, Nachricht o. ä.) werden in unserer
            Datenbank gespeichert und dem jeweiligen Website-Betreiber (unserem Nutzer)
            zugänglich gemacht.
          </p>
          <p style={{ marginTop: 12 }}>
            Bezüglich der von Website-Besuchern übermittelten Daten ist{' '}
            <strong>der jeweilige FinestSites-Nutzer als Verantwortlicher</strong> im Sinne der
            DSGVO zu betrachten. FinestSites ist insoweit Auftragsverarbeiter und handelt auf
            Weisung des Nutzers. Der Nutzer ist verpflichtet, auf seiner Website eine eigene
            Datenschutzerklärung vorzuhalten und die gesetzlichen Anforderungen der DSGVO
            einzuhalten.
          </p>
          <p style={{ marginTop: 12 }}>
            Rechtsgrundlage (FinestSites): Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung
            gegenüber dem Nutzer).
          </p>
        </Section>

        {/* 7 */}
        <Section title="7. Zahlungsabwicklung – Stripe">
          <p>
            Für die Abwicklung von Zahlungen (Abonnements) nutzen wir den Dienst{' '}
            <strong>Stripe</strong> (Stripe, Inc., 354 Oyster Point Blvd, South San Francisco,
            CA 94080, USA; für europäische Kunden: Stripe Payments Europe, Ltd., 1 Grand Canal
            Street Lower, Grand Canal Dock, Dublin, D02 H210, Irland).
          </p>
          <p style={{ marginTop: 12 }}>
            Stripe verarbeitet Zahlungsdaten (Kreditkarten- oder SEPA-Lastschriftdaten,
            Rechnungsadresse) direkt und sicher. FinestSites speichert keine vollständigen
            Zahlungsdaten auf eigenen Servern. Stripe stellt uns lediglich eine anonymisierte
            Zahlungskennung zur Verfügung.
          </p>
          <p style={{ marginTop: 12 }}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          </p>
          <p style={{ marginTop: 12 }}>
            Stripe kann Daten in die USA übermitteln. Die Übermittlung erfolgt auf Basis der
            Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO) sowie des
            EU-U.S. Data Privacy Frameworks. Nähere Informationen finden Sie in der{' '}
            <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#8060b0' }}>Datenschutzerklärung von Stripe</a>.
          </p>
        </Section>

        {/* 8 */}
        <Section title="8. E-Mail-Versand – Resend">
          <p>
            Für den Versand transaktionaler E-Mails (Passwort-Reset, Kontobestätigung,
            Systemnachrichten) nutzen wir den Dienst{' '}
            <strong>Resend</strong> (Resend, Inc., 2261 Market Street STE 5944, San Francisco,
            CA 94114, USA).
          </p>
          <p style={{ marginTop: 12 }}>
            Dabei werden die E-Mail-Adresse des Empfängers sowie der Inhalt der jeweiligen
            E-Mail an Resend übermittelt. Resend speichert Versandprotokolle für einen
            begrenzten Zeitraum.
          </p>
          <p style={{ marginTop: 12 }}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          </p>
          <p style={{ marginTop: 12 }}>
            Resend kann Daten in die USA übermitteln. Die Übermittlung erfolgt auf Basis der
            Standardvertragsklauseln der EU-Kommission. Nähere Informationen finden Sie in der{' '}
            <a href="https://resend.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#8060b0' }}>Datenschutzerklärung von Resend</a>.
          </p>
          <p style={{ marginTop: 12 }}>
            Mit Resend besteht ein Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO.
          </p>
        </Section>

        {/* 9 */}
        <Section title="9. Cloudflare (CDN, Worker, Dateispeicherung, DNS)">
          <p>
            Wir nutzen Dienste der{' '}
            <strong>Cloudflare, Inc.</strong> (101 Townsend St, San Francisco, CA 94107, USA;
            europäischer Vertreter: Cloudflare Ltd., 101 Townsend St, San Francisco, CA 94107, USA).
            Cloudflare ist gemäß EU-U.S. Data Privacy Framework zertifiziert.
          </p>
          <p style={{ marginTop: 12 }}>Im Einzelnen nutzen wir:</p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>
              <strong>Cloudflare Workers:</strong> Serverlose Funktionen zur Weiterleitung von
              Anfragen und zur Auslieferung nutzerseitig erstellter Websites.
            </li>
            <li style={{ marginTop: 6 }}>
              <strong>Cloudflare R2:</strong> Objektspeicher für Template-Dateien und von Nutzern
              hochgeladene Medien (Bilder).
            </li>
            <li style={{ marginTop: 6 }}>
              <strong>Cloudflare KV:</strong> Key-Value-Speicher für das Caching von
              Website-Konfigurationen zur schnelleren Auslieferung.
            </li>
            <li style={{ marginTop: 6 }}>
              <strong>Cloudflare DNS und Custom Hostnames:</strong> DNS-Verwaltung und Bereitstellung
              benutzerdefinierter Domains für Nutzer-Websites.
            </li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Beim Aufruf unserer Dienste verarbeitet Cloudflare unter anderem die IP-Adresse
            des anfragenden Geräts sowie Request-Metadaten. Cloudflare verwendet diese Daten
            zum Schutz vor Missbrauch (DDoS-Schutz) und zur Leistungsoptimierung.
          </p>
          <p style={{ marginTop: 12 }}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherem
            und schnellem Betrieb unserer Dienste).
          </p>
          <p style={{ marginTop: 12 }}>
            Daten können in die USA oder andere Drittländer übermittelt werden. Die Übermittlung
            erfolgt auf Basis der Standardvertragsklauseln sowie des EU-U.S. Data Privacy
            Frameworks. Mit Cloudflare besteht ein Auftragsverarbeitungsvertrag. Nähere
            Informationen finden Sie in der{' '}
            <a href="https://www.cloudflare.com/de-de/privacypolicy/" target="_blank" rel="noopener noreferrer" style={{ color: '#8060b0' }}>Datenschutzerklärung von Cloudflare</a>.
          </p>
        </Section>

        {/* 10 */}
        <Section title="10. Affiliate-Programm">
          <p>
            Wir betreiben ein eigenes Affiliate-Programm für Nutzer unserer Plattform. Teilnehmer
            am Affiliate-Programm erklären sich damit einverstanden, dass folgende zusätzliche
            Daten verarbeitet werden:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>Individueller Referral-Link und Referral-Code</li>
            <li>Anzahl geworbener Nutzer und daraus resultierende Vergütungsansprüche</li>
            <li>Bankverbindung oder Stripe-Connect-Daten für Auszahlungen</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Für Auszahlungen nutzen wir Stripe Connect. Es gelten die Datenschutzhinweise
            unter Ziffer 7. Rechtsgrundlage für die Verarbeitung der Affiliate-Daten ist
            Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. c DSGVO
            (steuerliche Aufzeichnungspflichten).
          </p>
        </Section>

        {/* 11 */}
        <Section title="11. Warteliste und E-Mail-Benachrichtigungen">
          <p>
            Vor dem offiziellen Launch von FinestSites bieten wir Interessenten die Möglichkeit,
            sich in eine Warteliste einzutragen, um bevorzugt Informationen und Zugang zur
            Plattform zu erhalten.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Erhobene Daten:</strong> E-Mail-Adresse (Pflichtfeld), Name (optional),
            Herkunft der Anmeldung (technisches Merkmal). Es wird ein eindeutiges Token
            gespeichert, das zur Bestätigung der E-Mail-Adresse und zur späteren Abmeldung
            verwendet wird.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Double-Opt-in-Verfahren:</strong> Nach der Anmeldung erhalten Sie eine
            Bestätigungs-E-Mail. Erst nach Klick auf den Bestätigungslink gilt die Anmeldung
            als wirksam. Dies dient der Sicherstellung, dass die E-Mail-Adresse tatsächlich
            Ihnen gehört (§ 7 Abs. 2 Nr. 3 UWG).
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Zweck:</strong> Information über den Launch von FinestSites sowie
            gelegentliche Vorab-Informationen zum Angebot.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Die
            Einwilligung kann jederzeit widerrufen werden, indem Sie auf den Abmeldelink in
            jeder E-Mail klicken oder uns eine formlose E-Mail senden. Der Widerruf berührt
            nicht die Rechtmäßigkeit der vor dem Widerruf erfolgten Verarbeitung.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Versanddienstleister:</strong> E-Mails werden über Resend, Inc. versendet
            (siehe Ziffer 8). Die E-Mail-Adresse wird an Resend übermittelt. Es besteht ein
            Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Speicherdauer:</strong> Die Daten werden gespeichert, bis Sie sich abmelden
            oder uns zur Löschung auffordern, spätestens jedoch 6 Monate nach dem offiziellen
            Launch der Plattform.
          </p>
        </Section>

        {/* 12 */}
        <Section title="12. Kontaktaufnahme per E-Mail oder Telefon">
          <p>
            Wenn Sie uns per E-Mail oder telefonisch kontaktieren, werden Ihre übermittelten
            Daten (Name, E-Mail-Adresse, Telefonnummer, Nachrichteninhalt) von uns gespeichert
            und verarbeitet, um Ihr Anliegen zu bearbeiten. Eine Weitergabe an Dritte erfolgt
            nicht.
          </p>
          <p style={{ marginTop: 12 }}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
            Bearbeitung von Anfragen) bzw. Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen).
            Die Daten werden gelöscht, sobald die Anfrage abschließend bearbeitet ist, spätestens
            jedoch nach 3 Jahren.
          </p>
        </Section>

        {/* 13 */}
        <Section title="13. Datenübermittlung in Drittländer">
          <p>
            Im Rahmen unserer Leistungserbringung nutzen wir Dienstleister, die ihren Sitz
            außerhalb der Europäischen Union haben (insbesondere Stripe und Resend in den USA
            sowie Cloudflare). Die Übermittlung personenbezogener Daten in diese Drittländer
            erfolgt ausschließlich:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>
              auf Basis von Standardvertragsklauseln der EU-Kommission gemäß Art. 46 Abs. 2
              lit. c DSGVO, und/oder
            </li>
            <li style={{ marginTop: 6 }}>
              im Rahmen des EU-U.S. Data Privacy Frameworks für zertifizierte Anbieter.
            </li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Alle Server, auf denen Ihre Kontodaten und Website-Inhalte gespeichert werden
            (Hetzner), befinden sich in Deutschland.
          </p>
        </Section>

        {/* 14 */}
        <Section title="14. Ihre Rechte als betroffene Person">
          <p>Als betroffene Person stehen Ihnen folgende Rechte zu:</p>

          <SubHeading>Auskunftsrecht (Art. 15 DSGVO)</SubHeading>
          <p>
            Sie haben das Recht, jederzeit Auskunft darüber zu verlangen, ob und welche
            personenbezogenen Daten wir über Sie verarbeiten.
          </p>

          <SubHeading>Recht auf Berichtigung (Art. 16 DSGVO)</SubHeading>
          <p>
            Sie haben das Recht, die Berichtigung unrichtiger oder die Vervollständigung
            unvollständiger personenbezogener Daten zu verlangen.
          </p>

          <SubHeading>Recht auf Löschung (Art. 17 DSGVO)</SubHeading>
          <p>
            Sie können die Löschung Ihrer personenbezogenen Daten verlangen, sofern keine
            gesetzlichen Aufbewahrungspflichten oder andere Gründe entgegenstehen.
          </p>

          <SubHeading>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</SubHeading>
          <p>
            Sie können die Einschränkung der Verarbeitung Ihrer Daten verlangen, z. B. wenn
            Sie die Richtigkeit der Daten bestreiten.
          </p>

          <SubHeading>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</SubHeading>
          <p>
            Sie haben das Recht, Ihre personenbezogenen Daten in einem strukturierten,
            maschinenlesbaren Format zu erhalten.
          </p>

          <SubHeading>Widerspruchsrecht (Art. 21 DSGVO)</SubHeading>
          <p>
            Sofern die Verarbeitung Ihrer Daten auf Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
            Interesse) beruht, haben Sie das Recht, der Verarbeitung zu widersprechen. Wir
            verarbeiten die Daten dann nicht mehr, es sei denn, es bestehen zwingende
            schutzwürdige Gründe.
          </p>

          <SubHeading>Widerruf einer erteilten Einwilligung (Art. 7 Abs. 3 DSGVO)</SubHeading>
          <p>
            Sofern eine Verarbeitung auf Ihrer Einwilligung beruht, können Sie diese jederzeit
            mit Wirkung für die Zukunft widerrufen.
          </p>

          <p style={{ marginTop: 16 }}>
            Um Ihre Rechte auszuüben, wenden Sie sich bitte an:{' '}
            <a href="mailto:hello@finestsites.io" style={{ color: '#8060b0' }}>hello@finestsites.io</a>.
            Wir bearbeiten Anfragen innerhalb von 30 Tagen.
          </p>
        </Section>

        {/* 15 */}
        <Section title="15. Beschwerderecht bei der Aufsichtsbehörde">
          <p>
            Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren
            (Art. 77 DSGVO). Die für uns zuständige Behörde ist:
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)</strong><br />
            Promenade 18<br />
            91522 Ansbach<br />
            Telefon: +49 981 180093-0<br />
            E-Mail: poststelle@lda.bayern.de<br />
            <a href="https://www.lda.bayern.de" target="_blank" rel="noopener noreferrer" style={{ color: '#8060b0' }}>www.lda.bayern.de</a>
          </p>
        </Section>

        {/* 16 */}
        <Section title="16. Datensicherheit">
          <p>
            Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten
            gegen zufällige oder vorsätzliche Manipulationen, Verlust, Zerstörung oder den
            Zugriff unberechtigter Personen zu schützen. Unsere Sicherheitsmaßnahmen werden
            entsprechend der technologischen Entwicklung fortlaufend verbessert. Die Übertragung
            von Daten zwischen Ihrem Browser und unseren Servern erfolgt ausschließlich
            verschlüsselt über HTTPS (TLS).
          </p>
          <p style={{ marginTop: 12 }}>
            Passwörter werden ausschließlich in gehashter Form (bcrypt) gespeichert.
          </p>
        </Section>

        {/* 17 */}
        <Section title="17. Änderungen dieser Datenschutzerklärung">
          <p>
            Wir behalten uns vor, diese Datenschutzerklärung gelegentlich anzupassen, damit sie
            stets den aktuellen rechtlichen Anforderungen entspricht oder um Änderungen unserer
            Leistungen in der Datenschutzerklärung umzusetzen, z. B. bei der Einführung neuer
            Dienste. Für Ihren erneuten Besuch gilt dann die neue Datenschutzerklärung.
          </p>
          <p style={{ marginTop: 12 }}>
            Bei wesentlichen Änderungen, die Ihre Rechte als Nutzer betreffen, werden wir Sie
            per E-Mail informieren.
          </p>
        </Section>

      </main>

      <Footer />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 16, lineHeight: 1.3 }}>{title}</h2>
      <div style={{ fontSize: 15, color: '#444', lineHeight: 1.85 }}>
        {children}
      </div>
      <hr style={{ marginTop: 48, border: 'none', borderTop: '1px solid #F1F1F1' }} />
    </div>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontWeight: 700, color: '#222', marginTop: 20, marginBottom: 6 }}>{children}</p>
  )
}
