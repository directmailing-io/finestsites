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
        <p style={{ fontSize: 14, color: '#bbb', marginBottom: 56 }}>Stand: 26. Oktober 2026</p>

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
            E-Mail: <a href="mailto:info@finestsites.io" style={{ color: '#8060b0' }}>info@finestsites.io</a>
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
            Nr. 2 TDDDG (technisch unbedingt erforderlich).
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
            Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG (technisch unbedingt erforderlich für
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
            und § 147 AO für 10 Jahre aufbewahrt. Wie Sie Ihr Konto selbst löschen und was dabei
            geschieht, beschreibt Ziffer 14.
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
            <li>Abrechnungsangaben für Gutschriften: Name bzw. Firma, Anschrift, steuerlicher Status,
              Steuernummer bzw. Umsatzsteuer-Identifikationsnummer sowie Zeitpunkt der Zustimmung zum
              Gutschriftverfahren</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Gutschriften und die zugehörigen Buchungsdaten bewahren wir aufgrund handels- und
            steuerrechtlicher Pflichten (§ 147 AO, § 14b UStG) bis zu zehn Jahre auf, auch über
            die Löschung des Nutzerkontos hinaus. Partner sehen von den von ihnen geworbenen Nutzern nur
            Vorname, Tarif und Abo-Status, keine vollständigen E-Mail-Adressen.
          </p>
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
        <Section title="13. FinestSites-App (iOS und Android)">
          <p>
            Die FinestSites-App für iPhone, iPad und Android wird von dem unter Ziffer 1 genannten
            Verantwortlichen angeboten. Sie ergänzt die Plattform app.finestsites.io: Sie melden sich mit
            Ihrem bestehenden FinestSites-Konto an und verwalten darin Ihre Webseiten, Anfragen,
            Besucher-Nachrichten und Ihr Konto. Für die in der App verarbeiteten Kontodaten, Webseiten-Inhalte,
            Formular-Einreichungen und Daten des Affiliate-Programms gelten die Ziffern 5, 6 und 10
            entsprechend. Ergänzend gilt:
          </p>

          <SubHeading>Bezug über die App-Stores</SubHeading>
          <p>
            Die App erhalten Sie über den Apple App Store (Apple Distribution International Ltd.,
            Hollyhill Industrial Estate, Hollyhill, Cork, Irland) oder über Google Play (Google Ireland Ltd.,
            Gordon House, Barrow Street, Dublin 4, Irland). Beim Herunterladen und Aktualisieren verarbeitet
            der jeweilige Store-Betreiber Daten Ihres Store-Kontos und Ihres Geräts in eigener Verantwortung;
            es gelten dessen Datenschutzhinweise. Wir erhalten aus den Stores keine personenbezogenen Daten
            über Sie.
          </p>

          <SubHeading>Anmeldung und Sitzung</SubHeading>
          <p>
            Bei der Anmeldung stellt unser Server ein Zugangstoken aus, mit dem die App Ihre Anfragen
            authentifiziert. Das Token wird ausschließlich im geschützten Schlüsselspeicher Ihres Geräts
            (iOS-Schlüsselbund bzw. Android-Keystore) verschlüsselt abgelegt und bei der Abmeldung gelöscht.
            Die App setzt keine Cookies. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          </p>

          <SubHeading>Push-Mitteilungen</SubHeading>
          <p>
            Auf Wunsch informiert die App Sie per Push-Mitteilung über neue Anfragen, Besucher-Nachrichten,
            Antworten unseres Supports sowie Hinweise zu Ihrem Konto und zum Affiliate-Programm. Beim
            ersten Start fragt die App über den Systemdialog Ihres Geräts, ob Sie Mitteilungen erlauben.
            Stimmen Sie zu, speichern wir zu Ihrem Gerät: die vom Expo-Push-Dienst vergebene Gerätekennung
            (Push-Token), die Plattform (iOS/Android), App-Version, Betriebssystem-Version, Gerätemodell,
            Spracheinstellung sowie den Zeitpunkt der letzten Nutzung. Zu jeder Mitteilung protokollieren
            wir Kategorie, Titel, Text, Versandzeitpunkt und Zustellstatus, um Fehler zu erkennen und
            Mehrfachzustellungen zu vermeiden.
          </p>
          <p style={{ marginTop: 8 }}>
            Für den Versand nutzen wir den Push-Dienst von <strong>Expo</strong> (650 Industries, Inc.,
            San Francisco, Kalifornien, USA), der die Mitteilung an den Apple Push Notification service
            (Apple Inc., One Apple Park Way, Cupertino, CA 95014, USA) bzw. an Firebase Cloud Messaging
            (Google Ireland Ltd.) weiterreicht. Dabei werden Push-Token und Mitteilungsinhalt an diese
            Dienste übermittelt. Expo gibt an, nach dem EU-U.S. Data Privacy Framework zertifiziert zu sein;
            Apple Inc. und Google LLC sind nach dem EU-U.S. Data Privacy Framework zertifiziert. Ergänzend
            stützen wir die Übermittlung auf die Standardvertragsklauseln der EU-Kommission
            (Art. 46 Abs. 2 lit. c DSGVO). Expo verarbeitet die Daten in unserem Auftrag nach seinen
            Nutzungsbedingungen und Datenschutzbestimmungen. Nähere Informationen:{' '}
            <a href="https://expo.dev/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#8060b0' }}>Datenschutzerklärung von Expo</a>.
          </p>
          <p style={{ marginTop: 8 }}>
            Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Ihre Einwilligung im Systemdialog) sowie
            Art. 6 Abs. 1 lit. b DSGVO für die technische Zustellung. Sie können Ihre Einwilligung jederzeit
            mit Wirkung für die Zukunft widerrufen: in den Einstellungen Ihres Geräts oder in der App unter
            <em> Konto → Mitteilungen</em>, dort auch getrennt nach Kategorie. Nach dem Widerruf, bei der
            Abmeldung und spätestens dann, wenn der Store-Betreiber das Gerät als nicht mehr erreichbar
            meldet, deaktivieren bzw. löschen wir die Gerätekennung.
          </p>

          <SubHeading>App-Sperre mit Face ID, Touch ID oder Fingerabdruck</SubHeading>
          <p>
            Optional können Sie die App mit der biometrischen Prüfung Ihres Geräts sperren. Die Prüfung
            führt ausschließlich das Betriebssystem auf Ihrem Gerät durch; die App erhält nur das Ergebnis
            (erfolgreich oder nicht). Biometrische Daten werden weder an uns noch an Dritte übermittelt
            und von uns nicht gespeichert. Die Einstellung liegt nur auf Ihrem Gerät.
          </p>

          <SubHeading>Kamera und Fotos</SubHeading>
          <p>
            Die App greift nur auf Ihre Veranlassung auf Kamera oder Fotomediathek zu, etwa um ein
            Profilbild aufzunehmen oder ein Bild an unseren Support zu senden. Das Betriebssystem fragt
            dafür Ihre Berechtigung ab. Ausgewählte Bilder werden in unseren Objektspeicher bei Cloudflare
            übertragen (Ziffer 9) und wie im Web verarbeitet. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
          </p>

          <SubHeading>Besucher-Chat</SubHeading>
          <p>
            Betreiben Sie auf Ihrer Webseite das Chat-Fenster für Besucher, werden Ihnen deren Nachrichten
            und freiwillige Angaben (Name, E-Mail-Adresse, Telefonnummer) in der App und im Dashboard
            angezeigt. Wie bei Formular-Einreichungen (Ziffer 6) sind insoweit Sie Verantwortlicher; wir
            verarbeiten diese Daten als Auftragsverarbeiter auf Ihre Weisung.
          </p>

          <SubHeading>Keine Werbung, kein Tracking</SubHeading>
          <p>
            Die App enthält keine Werbung und keine Analyse- oder Werbe-Software von Drittanbietern. Es
            findet kein geräteübergreifendes Tracking statt. Die oben genannten Geräteinformationen nutzen
            wir allein, um Mitteilungen zuzustellen und Fehler zu beheben (Art. 6 Abs. 1 lit. f DSGVO,
            berechtigtes Interesse an einem störungsfreien Betrieb).
          </p>
          <p style={{ marginTop: 8 }}>
            Ihre Rechte als betroffene Person beschreibt Ziffer 16; die Löschung Ihres Kontos Ziffer 14.
          </p>
        </Section>

        {/* 14 */}
        <Section title="14. Löschung Ihres Kontos">
          <p>
            Sie können Ihr FinestSites-Konto jederzeit selbst löschen: im Dashboard unter
            <em> Einstellungen → Konto &amp; FAQ → Konto löschen</em>, in der App unter
            <em> Konto → Konto löschen</em> oder weiterhin per E-Mail an{' '}
            <a href="mailto:info@finestsites.io" style={{ color: '#8060b0' }}>info@finestsites.io</a>.
            Eine Kurzanleitung finden Sie unter{' '}
            <a href="https://finestsites.io/konto-loeschen" style={{ color: '#8060b0' }}>finestsites.io/konto-loeschen</a>.
            Für die Löschung in Dashboard oder App müssen Sie Ihr Passwort eingeben. Konten mit
            Administratorrechten können nicht auf diesem Weg gelöscht werden.
          </p>

          <SubHeading>Zeitpunkt: zum Laufzeitende oder sofort</SubHeading>
          <p>
            Haben Sie ein laufendes, bezahltes Abonnement, wählen Sie bei der Anfrage zwischen zwei
            Varianten:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>
              <strong>Zum Laufzeitende:</strong> Ihr Abonnement wird zum Ende des bereits bezahlten
              Abrechnungszeitraums gekündigt; es wird nichts mehr abgebucht. Ihre Webseiten bleiben bis
              dahin online und werden danach deaktiviert. Das Konto wird 14 Tage nach Ihrer Anfrage,
              frühestens jedoch zum Laufzeitende, endgültig gelöscht.
            </li>
            <li style={{ marginTop: 6 }}>
              <strong>Sofort:</strong> Ihre Webseiten gehen sofort offline und Ihr Abonnement endet
              sofort. Für den bereits bezahlten, nicht mehr genutzten Zeitraum erfolgt keine Erstattung.
              Das Konto wird 14 Tage nach Ihrer Anfrage endgültig gelöscht.
            </li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Haben Sie kein bezahltes Abonnement oder besteht eine laufende Zahlungsstörung, steht nur die
            sofortige Variante zur Verfügung.
          </p>

          <SubHeading>Sofort nach Ihrer Anfrage</SubHeading>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>erhalten Sie eine Bestätigung per E-Mail,</li>
            <li>senden wir Ihnen keine Newsletter, Tipps oder Angebote mehr,</li>
            <li>sind Änderungen am Abonnement (neuer Tarif, Tarifwechsel, Fortsetzen) gesperrt.</li>
          </ul>
          <p style={{ marginTop: 8 }}>
            Bei der <strong>sofortigen Variante</strong> werden Sie außerdem auf allen Geräten abgemeldet, Gerätekennungen
            für Push-Mitteilungen werden gelöscht, und das Veröffentlichen sowie das Anlegen neuer Webseiten ist bis zur
            Löschung gesperrt. Bei der Variante <strong>„zum Laufzeitende“</strong> bleiben Sie angemeldet und können Ihr
            Konto bis zum Laufzeitende wie gewohnt nutzen.
          </p>

          <SubHeading>Bedenkzeit und Abbruch</SubHeading>
          <p>
            Bis zur endgültigen Löschung können Sie sich anmelden und die Löschung abbrechen. Bei der
            Variante „zum Laufzeitende“ läuft Ihr Abonnement nach dem Abbruch unverändert weiter und Ihre
            Webseiten bleiben online. Bei der sofortigen Variante bleibt ein beendetes Abonnement beendet;
            Ihre Webseiten bleiben offline, bis Sie sie erneut veröffentlichen.
          </p>

          <SubHeading>Was wir bei der endgültigen Löschung löschen (Art. 17 Abs. 1 DSGVO)</SubHeading>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>Ihre Profildaten (Name, Firma, Telefonnummer, Profilbild, Social-Media-Angaben, Teampartner-Nummer, Markenfarbe),</li>
            <li>Ihre Webseiten mit allen Inhalten, Bildern und Einstellungen,</li>
            <li>die Anfragen und Besucher-Nachrichten, die über Ihre Webseiten an Sie gesendet wurden,</li>
            <li>Ihre Support-Unterhaltungen einschließlich gesendeter Bilder,</li>
            <li>Ihre Einstellungen für Werbung und Tracking (z. B. Pixel-IDs, Zugangsschlüssel),</li>
            <li>Mitteilungen, Mitteilungs-Einstellungen, Anmeldedaten und Sitzungen,</li>
            <li>das Protokoll der an Sie gesendeten E-Mails,</li>
            <li>die Verbindung eigener Domains mit FinestSites (die DNS-Einträge bei Ihrem Domain-Anbieter entfernen Sie selbst).</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Statistiken über Seitenaufrufe Ihrer Webseiten bleiben nur ohne Bezug zu Ihnen erhalten
            (Adresse der Seite, Besucherkennung und Herkunftsangaben werden entfernt).
          </p>

          <SubHeading>Was bestehen bleibt</SubHeading>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>
              <strong>Benutzername:</strong> Ihr Benutzername wird nicht neu vergeben. Wir speichern ihn
              zusammen mit einer internen Kennnummer weiter, damit Links und Empfehlungslinks, die Sie
              verbreitet haben, nie auf eine andere Person zeigen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
              (berechtigtes Interesse, Verwechslungen und Missbrauch zu verhindern). Ihre E-Mail-Adresse
              wird gelöscht; Sie können sich mit ihr später neu registrieren.
            </li>
            <li style={{ marginTop: 6 }}>
              <strong>Zahlungsdaten bei Stripe:</strong> Rechnungen für Ihr Abonnement erstellt und speichert
              unser Zahlungsdienstleister Stripe (Ziffer 7). Wir bewahren dazu nur die Stripe-Kundennummer
              auf, damit spätere Erstattungen oder Rückbuchungen den aufbewahrten Buchungen zugeordnet
              werden können.
            </li>
            <li style={{ marginTop: 6 }}>
              <strong>Affiliate-Programm:</strong> Gutschriften (Provisionsabrechnungen) und die zugehörigen
              Provisions- und Auszahlungsbuchungen müssen wir aufbewahren (siehe Aufbewahrungsfristen). Die
              Gutschriften enthalten die Abrechnungsangaben, die zum Zeitpunkt der Auszahlung galten (Name
              bzw. Firma, Anschrift, steuerlicher Status, Steuernummer bzw. USt-IdNr.).
            </li>
          </ul>

          <SubHeading>Guthaben aus dem Affiliate-Programm</SubHeading>
          <p>
            Haben Sie bei der Anfrage ein Guthaben aus dem Affiliate-Programm, entscheiden Sie ausdrücklich,
            ob es nach der Löschung ausgezahlt wird (auch unterhalb des sonst geltenden Mindestbetrags) oder
            ob Sie darauf verzichten. Ein Guthaben verfällt nicht ohne Ihre Erklärung. Können wir ein
            Guthaben nicht automatisch auszahlen (z. B. fehlendes Auszahlungskonto), bewahren wir Ihre
            E-Mail-Adresse und Ihre Abrechnungsangaben auf, bis es ausgezahlt ist, längstens bis zur
            Verjährung des Anspruchs (3 Jahre ab Ende des Jahres der Löschung, §§ 195, 199 Abs. 1 BGB).
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b und c DSGVO.
          </p>

          <SubHeading>Aufbewahrungsfristen</SubHeading>
          <p>
            Soweit gesetzliche Aufbewahrungspflichten bestehen, löschen wir die betroffenen Daten nicht
            sofort, sondern sperren sie für jede andere Verwendung und löschen sie nach Ablauf der Frist
            (Art. 17 Abs. 3 lit. b i. V. m. Art. 6 Abs. 1 lit. c DSGVO):
          </p>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #E5E5E5', fontWeight: 700 }}>Unterlage</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #E5E5E5', fontWeight: 700 }}>Frist</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #E5E5E5', fontWeight: 700 }}>Grundlage</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid #F1F1F1' }}>Gutschriften an Partner (Provisionsabrechnungen)</td>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid #F1F1F1' }}>8 Jahre</td>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid #F1F1F1' }}>§ 147 Abs. 1 Nr. 4, Abs. 3 AO; § 14b Abs. 1 UStG</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid #F1F1F1' }}>Provisions- und Auszahlungsbuchungen</td>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid #F1F1F1' }}>10 Jahre</td>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid #F1F1F1' }}>§ 147 Abs. 1 Nr. 1, Abs. 3 AO</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 6px' }}>Rechnungen für Ihr Abonnement</td>
                  <td style={{ padding: '8px 6px' }}>gespeichert bei Stripe</td>
                  <td style={{ padding: '8px 6px' }}>§ 147 AO, § 14b UStG</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 12 }}>
            Die Fristen beginnen mit dem Ende des Kalenderjahres, in dem die Unterlage entstanden ist
            (§ 147 Abs. 4 AO). Beispiel: Eine Gutschrift vom Oktober 2026 bewahren wir bis zum 31.12.2034
            auf, die zugehörige Buchung bis zum 31.12.2036.
          </p>
          <p style={{ marginTop: 12 }}>
            Zu jeder Lösch-Anfrage speichern wir außerdem, wann sie gestellt, abgebrochen oder ausgeführt
            wurde, welche Variante Sie gewählt haben und – falls Sie auf ein Guthaben verzichtet haben –
            Wortlaut und Zeitpunkt Ihrer Verzichtserklärung. Das dient dem Nachweis, dass wir Ihre Anfrage
            korrekt bearbeitet haben (Art. 5 Abs. 2, Art. 6 Abs. 1 lit. c und f DSGVO).
          </p>
        </Section>

        {/* 15 */}
        <Section title="15. Datenübermittlung in Drittländer">
          <p>
            Im Rahmen unserer Leistungserbringung nutzen wir Dienstleister, die ihren Sitz
            außerhalb der Europäischen Union haben (insbesondere Stripe, Resend und Expo in den USA
            sowie Cloudflare; für Push-Mitteilungen der App zudem Apple und Google). Die Übermittlung
            personenbezogener Daten in diese Drittländer erfolgt ausschließlich:
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

        {/* 16 */}
        <Section title="16. Ihre Rechte als betroffene Person">
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
            <a href="mailto:info@finestsites.io" style={{ color: '#8060b0' }}>info@finestsites.io</a>.
            Wir bearbeiten Anfragen innerhalb von 30 Tagen.
          </p>
        </Section>

        {/* 17 */}
        <Section title="17. Beschwerderecht bei der Aufsichtsbehörde">
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

        {/* 18 */}
        <Section title="18. Datensicherheit">
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

        {/* 19 */}
        <Section title="19. Änderungen dieser Datenschutzerklärung">
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
