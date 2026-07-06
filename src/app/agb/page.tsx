import type { Metadata } from 'next'
import NavBar from '@/app/_components/NavBar'
import Footer from '@/app/_components/Footer'

export const metadata: Metadata = {
  title: 'Allgemeine Geschäftsbedingungen – FinestSites',
  description: 'AGB der FinestSites-Plattform für die Erstellung und den Betrieb von Network-Marketing-Websites.',
  robots: { index: true },
}

export default function AgbPage() {
  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', minHeight: '100vh' }}>
      <NavBar />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '120px 24px 96px' }}>
        <h1 style={{ fontFamily: '"Plein", sans-serif', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 400, color: '#111', letterSpacing: '-0.025em', marginBottom: 12 }}>
          Allgemeine Geschäftsbedingungen
        </h1>
        <p style={{ fontSize: 14, color: '#aaa', marginBottom: 56 }}>Stand: Juli 2026</p>

        <Section title="§ 1 Geltungsbereich und Vertragsparteien">
          <p>
            (1) Diese Allgemeinen Geschäftsbedingungen (nachfolgend &bdquo;AGB&ldquo;) gelten für alle Verträge zwischen
            FinestSites Daniel Kurzeja, Herrleinstr. 39, 97437 Haßfurt, Deutschland (nachfolgend &bdquo;Anbieter&ldquo;
            oder &bdquo;wir&ldquo;) und natürlichen oder juristischen Personen, die die Plattform finestsites.io sowie die
            zugehörige App-Instanz app.finestsites.io nutzen (nachfolgend &bdquo;Nutzer&ldquo;).
          </p>
          <p style={{ marginTop: 12 }}>
            (2) Entgegenstehende oder abweichende Bedingungen des Nutzers werden nicht anerkannt, es sei denn, der Anbieter
            stimmt ihrer Geltung ausdrücklich und schriftlich zu.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) Diese AGB gelten sowohl gegenüber Unternehmern im Sinne von § 14 BGB als auch gegenüber Verbrauchern im
            Sinne von § 13 BGB. Soweit einzelne Regelungen ausschließlich für eine dieser Gruppen gelten, ist dies
            ausdrücklich vermerkt. Als Unternehmer gilt, wer die Plattform im Rahmen seiner gewerblichen oder
            selbständigen beruflichen Tätigkeit nutzt.
          </p>
        </Section>

        <Section title="§ 2 Leistungsgegenstand">
          <p>
            (1) Der Anbieter betreibt eine webbasierte SaaS-Plattform (Software as a Service), die Nutzern ermöglicht,
            professionelle Websites auf Basis vorgefertigter Templates zu erstellen, zu verwalten und unter einer
            zugewiesenen Subdomain oder einer selbst eingebundenen Domain zu betreiben
            (nachfolgend &bdquo;Plattform&ldquo; oder &bdquo;Dienst&ldquo;).
          </p>
          <p style={{ marginTop: 12 }}>
            (2) Die Plattform stellt insbesondere folgende Funktionen bereit:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Auswahl und Anpassung vorgefertigter Website-Templates</li>
            <li>Verwaltung eigener Inhalte (Texte, Bilder, Kontaktangaben)</li>
            <li>Betrieb der Website unter einer Subdomain (z. B. nutzername.womenplus.io) oder einer
              vom Nutzer bereitgestellten eigenen Domain</li>
            <li>Empfang von Kontaktanfragen über integrierte Formulare</li>
            <li>Verwaltung von Abonnements über den Zahlungsanbieter Stripe</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            (3) Der Anbieter schuldet die Bereitstellung der Plattform als Dienst, jedoch keine konkrete
            Conversion-Rate, keine spezifischen Geschäftsergebnisse des Nutzers und keinen Erfolg der über die
            Plattform betriebenen Website im Sinne eines Werkvertragserfolgs.
          </p>
          <p style={{ marginTop: 12 }}>
            (4) Einzelheiten zum Leistungsumfang der verschiedenen Abonnement-Stufen (Pläne) ergeben sich aus der
            aktuellen Preisseite unter finestsites.io/#preise. Der Anbieter behält sich vor, den Leistungsumfang
            einzelner Pläne anzupassen, soweit dies dem Nutzer rechtzeitig mitgeteilt wird (vgl. § 9).
          </p>
          <p style={{ marginTop: 12 }}>
            (5) Der Anbieter ist berechtigt, Drittanbieter zur Leistungserbringung einzusetzen (u. a. Cloudflare für
            Hosting und Content Delivery, Stripe für Zahlungsabwicklung, Amazon Web Services / Backblaze R2 für
            Datenspeicherung). Der Anbieter haftet für diese Drittanbieter nur im Rahmen der gesetzlichen Vorschriften.
          </p>
        </Section>

        <Section title="§ 3 Vertragsschluss und Registrierung">
          <p>
            (1) Die Darstellung der Plattform und ihrer Pläne auf der Website stellt kein bindendes Angebot dar,
            sondern eine Aufforderung zur Abgabe eines Angebots (invitatio ad offerendum).
          </p>
          <p style={{ marginTop: 12 }}>
            (2) Der Nutzer gibt durch Abschluss des Registrierungsprozesses und Auswahl eines kostenpflichtigen Plans
            einschließlich Bestätigung des Zahlungsvorgangs über Stripe ein verbindliches Angebot ab. Der Vertrag kommt
            mit der Freischaltung des Zugangs durch den Anbieter zustande.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) Der Nutzer ist verpflichtet, bei der Registrierung wahrheitsgemäße und vollständige Angaben zu machen.
            Änderungen der Kontaktdaten sind unverzüglich im Nutzerprofil zu aktualisieren.
          </p>
          <p style={{ marginTop: 12 }}>
            (4) <strong>Widerrufsrecht für Verbraucher:</strong> Verbraucher haben grundsätzlich das Recht, innerhalb
            von 14 Tagen ohne Angabe von Gründen zu widerrufen. Stimmt der Verbraucher ausdrücklich zu, dass die
            Vertragserfüllung vor Ablauf der Widerrufsfrist beginnt, und bestätigt er seine Kenntnis davon, dass er
            mit Beginn der Vertragserfüllung sein Widerrufsrecht verliert, erlischt das Widerrufsrecht gemäß
            § 356 Abs. 5 BGB mit Beginn der Dienstleistungserbringung. Der Nutzer erklärt durch Abschluss des
            Abonnements, dass er der sofortigen Leistungserbringung zustimmt und sein Widerrufsrecht damit erlischt.
          </p>
        </Section>

        <Section title="§ 4 Nutzungsrechte und geistiges Eigentum">
          <p>
            (1) <strong>Nutzungsrecht des Nutzers:</strong> Der Anbieter räumt dem Nutzer für die Dauer des
            Abonnements ein einfaches, nicht übertragbares, nicht unterlizenzierbares Recht ein, die Plattform und
            die bereitgestellten Templates im Rahmen der vertraglich vereinbarten Funktionen zu nutzen.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) <strong>Eigentum des Anbieters:</strong> Alle Templates, Designs, Layouts, Grafiken, Codebestandteile
            (HTML, CSS, JavaScript), Textentwürfe und sonstige von FinestSites erstellten Werke sind urheberrechtlich
            geschützt und verbleiben im Eigentum des Anbieters. Sie dürfen ohne ausdrückliche schriftliche Zustimmung
            des Anbieters nicht außerhalb der Plattform kopiert, vervielfältigt, verändert, weitergegeben,
            unterlizenziert oder anderweitig verwertet werden. Insbesondere ist es untersagt:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Template-HTML/CSS außerhalb der Plattform zu verwenden oder an Dritte weiterzugeben</li>
            <li>Die Plattform per Reverse Engineering zu analysieren oder nachzubauen</li>
            <li>Designs oder Layouts für eigene Produkte oder für Dritte zu verwerten</li>
            <li>Schutzvermerke, Copyright-Hinweise oder Markenzeichen zu entfernen</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            (3) <strong>Inhalte des Nutzers:</strong> Inhalte, die der Nutzer selbst auf der Plattform hochlädt
            oder eingibt (eigene Texte, Fotos, Logos, Kontaktdaten; nachfolgend &bdquo;Nutzerdaten&ldquo;),
            verbleiben im Eigentum des Nutzers. Der Nutzer räumt dem Anbieter hieran eine kostenlose, weltweite,
            nicht ausschließliche Lizenz ein, diese Inhalte im Rahmen der Vertragserfüllung zu speichern,
            zu verarbeiten und bereitzustellen. Diese Lizenz endet mit Löschung der Inhalte oder Beendigung
            des Vertrags.
          </p>
          <p style={{ marginTop: 12 }}>
            (4) Der Nutzer sichert zu, dass er über alle erforderlichen Rechte an den von ihm hochgeladenen
            Inhalten verfügt und diese nicht Rechte Dritter verletzen.
          </p>
        </Section>

        <Section title="§ 5 Pflichten und Obliegenheiten des Nutzers">
          <p>
            (1) Der Nutzer ist verpflichtet, seine Zugangsdaten geheim zu halten und vor unbefugtem Zugriff
            Dritter zu schützen. Bei Verdacht auf Missbrauch ist der Anbieter unverzüglich zu informieren.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) Der Nutzer darf die Plattform ausschließlich für legale Zwecke nutzen. Verboten ist insbesondere:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Das Veröffentlichen rechtswidriger, anstößiger oder diskriminierender Inhalte</li>
            <li>Das Versenden von Spam oder nicht autorisierter Massenkommunikation über integrierte Formulare</li>
            <li>Das Einbinden von Schadcode (Malware, Phishing, etc.)</li>
            <li>Die missbräuchliche Beanspruchung von Serverressourcen (z. B. automatisierte Massenanfragen)</li>
            <li>Die Umgehung technischer Schutzmaßnahmen der Plattform</li>
            <li>Das Anlegen gefälschter Nutzerkonten</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            (3) Der Nutzer ist selbst dafür verantwortlich, dass die auf seiner Website veröffentlichten Inhalte
            allen anwendbaren gesetzlichen Vorschriften entsprechen, insbesondere den Anforderungen des
            Telemediengesetzes (TMG), des Digitale-Dienste-Gesetzes (DDG), des Wettbewerbsrechts (UWG),
            des Markenrechts sowie der DSGVO. Hierzu gehört insbesondere die Pflicht, ein ordnungsgemäßes
            Impressum und eine Datenschutzerklärung auf der eigenen Website vorzuhalten.
          </p>
          <p style={{ marginTop: 12 }}>
            (4) Bei schwerwiegenden oder wiederholten Verstößen gegen diese Pflichten ist der Anbieter berechtigt,
            den Zugang des Nutzers vorübergehend zu sperren oder den Vertrag außerordentlich zu kündigen.
          </p>
        </Section>

        <Section title="§ 6 Marken und Inhalte von Network-Marketing-Unternehmen">
          <p>
            (1) <strong>Kein offizielles Partnerverhältnis:</strong> FinestSites ist ein unabhängiger
            Technologieanbieter und steht in keiner offiziellen Geschäftsbeziehung, Partnerschaft oder
            Lizenzvereinbarung mit den in Templates erwähnten oder dargestellten Network-Marketing-Unternehmen
            (z. B. PM International, Vorwerk, LR Health &amp; Beauty, Herbalife, Nu Skin, AMWAY, Young Living,
            Juice Plus+, Forever Living, doTERRA oder anderen). Die Marken und Kennzeichen dieser Unternehmen
            gehören den jeweiligen Rechteinhabern.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) <strong>Eigenverantwortung des Nutzers:</strong> Jeder Nutzer ist selbst und allein dafür
            verantwortlich zu prüfen, ob die Nutzung von Templates, die auf ein bestimmtes Network-Marketing-Unternehmen
            ausgerichtet sind, mit den Richtlinien, Compliance-Vorgaben, Markennutzungsvereinbarungen und
            sonstigen Regeln seines jeweiligen Network-Marketing-Unternehmens vereinbar ist.
            Der Anbieter übernimmt hierfür keinerlei Gewähr.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) <strong>Abmahn- und Klagerisiko:</strong> Sollte der Nutzer durch die Nutzung der Plattform
            oder der darin enthaltenen Templates marken-, urheber- oder wettbewerbsrechtliche Ansprüche
            Dritter auslösen (insbesondere Abmahnungen durch Network-Marketing-Unternehmen oder deren
            Rechtsabteilungen), haftet hierfür ausschließlich der Nutzer. Der Anbieter haftet nicht
            für solche Ansprüche Dritter, die aus dem Verhalten oder den Inhalten des Nutzers resultieren.
          </p>
          <p style={{ marginTop: 12 }}>
            (4) Der Anbieter ist berechtigt, auf Anforderung berechtigter Rechteinhaber die betreffende
            Website des Nutzers zu deaktivieren, wenn ein hinreichend begründeter Verstoß gegen
            Marken- oder Urheberrechte glaubhaft gemacht wird. In einem solchen Fall schuldet der Anbieter
            dem Nutzer keine Erstattung anteiliger Abonnementgebühren.
          </p>
        </Section>

        <Section title="§ 7 Verfügbarkeit der Plattform">
          <p>
            (1) Der Anbieter ist bestrebt, die Plattform mit einer hohen Verfügbarkeit zu betreiben.
            Eine bestimmte Verfügbarkeitsquote (SLA) wird jedoch nicht garantiert. Insbesondere
            schließt der Anbieter jede Haftung für Ausfälle aus, die auf folgende Ursachen zurückzuführen
            sind:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Geplante Wartungsarbeiten (werden nach Möglichkeit vorab angekündigt)</li>
            <li>Ausfälle oder Störungen bei Drittanbietern (Cloudflare, Stripe, DNS-Provider, Rechenzentren)</li>
            <li>Höhere Gewalt (u. a. Naturkatastrophen, Cyberangriffe, Ausfälle der Netzinfrastruktur)</li>
            <li>Fehlerhafte Konfigurationen oder Handlungen des Nutzers (z. B. fehlerhafte DNS-Einstellungen
              bei eigener Domain)</li>
            <li>Ausfälle der Internetverbindung des Nutzers</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            (2) Vorübergehende Ausfälle oder Einschränkungen des Dienstes begründen keinen Anspruch des
            Nutzers auf Minderung, Schadensersatz oder außerordentliche Kündigung, sofern diese Ausfälle
            nicht auf grober Fahrlässigkeit oder Vorsatz des Anbieters beruhen.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) Der Anbieter behält sich vor, den Dienst oder einzelne Funktionen dauerhaft einzustellen,
            sofern dies dem Nutzer mit einer Vorlaufzeit von mindestens 8 Wochen per E-Mail mitgeteilt wird.
            In diesem Fall hat der Nutzer Anspruch auf anteilige Rückerstattung vorausgezahlter Abonnementgebühren.
          </p>
        </Section>

        <Section title="§ 8 Preise und Zahlungsbedingungen">
          <p>
            (1) Die aktuellen Preise für die verschiedenen Abonnement-Pläne ergeben sich aus der Preisseite
            auf finestsites.io. Alle Preise verstehen sich als Bruttopreise inklusive der gesetzlichen
            Mehrwertsteuer.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) Die Abrechnung erfolgt wahlweise monatlich oder jährlich im Voraus. Die Zahlung wird über
            den Zahlungsdienstleister Stripe eingezogen. Akzeptierte Zahlungsmittel sind Kreditkarte (Visa,
            Mastercard, American Express) sowie SEPA-Lastschrift.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) Das Abonnement verlängert sich automatisch um den jeweils gewählten Abrechnungszeitraum
            (Monat oder Jahr), sofern es nicht fristgerecht gekündigt wird (vgl. § 10).
          </p>
          <p style={{ marginTop: 12 }}>
            (4) Bei Zahlungsverzug oder fehlgeschlagenem Zahlungseinzug ist der Anbieter berechtigt, den
            Zugang des Nutzers nach angemessener Frist vorübergehend zu sperren, bis der ausstehende
            Betrag ausgeglichen wurde. Entstehende Mahnkosten sowie gesetzliche Verzugszinsen
            (§ 288 BGB) gehen zu Lasten des Nutzers.
          </p>
          <p style={{ marginTop: 12 }}>
            (5) Rückerstattungen für bereits abgerechnete und erbrachte Leistungszeiträume erfolgen
            grundsätzlich nicht, es sei denn, es liegt ein ausschließlich vom Anbieter zu vertretender,
            gravierender und dauerhafter Dienstausfall vor oder der Anbieter hat die Einstellung des
            Dienstes gemäß § 7 Abs. 3 mitgeteilt.
          </p>
        </Section>

        <Section title="§ 9 Preisänderungen">
          <p>
            (1) Der Anbieter behält sich vor, die Preise für Abonnements anzupassen. Preiserhöhungen werden
            dem Nutzer mindestens <strong>6 Wochen vor Inkrafttreten</strong> per E-Mail an die hinterlegte
            Adresse angekündigt.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) Stimmt der Nutzer der Preiserhöhung nicht zu, kann er den Vertrag bis zum Zeitpunkt des
            Inkrafttretens der Preiserhöhung außerordentlich kündigen. Kündigt der Nutzer nicht, gilt die
            Preiserhöhung als akzeptiert.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) Der Anbieter ist berechtigt, den Leistungsumfang bestehender Pläne zu erweitern oder zu
            verändern. Eine Reduzierung des vertraglich vereinbarten Leistungsumfangs gilt als wesentliche
            Änderung und wird ebenfalls mit einer Frist von 6 Wochen angekündigt, verbunden mit dem
            außerordentlichen Kündigungsrecht des Nutzers.
          </p>
        </Section>

        <Section title="§ 10 Laufzeit und Kündigung">
          <p>
            (1) <strong>Mindestlaufzeit:</strong> Das Abonnement beginnt mit der Freischaltung des Zugangs
            und läuft für den jeweils gewählten Abrechnungszeitraum (1 Monat oder 1 Jahr). Es gibt keine
            Mindestvertragslaufzeit über den gewählten Abrechnungszeitraum hinaus.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) <strong>Ordentliche Kündigung:</strong> Der Nutzer kann das Abonnement jederzeit
            selbständig über die Einstellungen im Nutzerkonto kündigen. Die Kündigung wird zum Ende des
            laufenden Abrechnungszeitraums wirksam. Bis dahin bleibt der Zugang vollständig erhalten.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) <strong>Kündigung durch den Anbieter:</strong> Der Anbieter kann den Vertrag mit einer
            Frist von 30 Tagen zum Monatsende ordentlich kündigen, soweit keine wichtigen Gründe vorliegen.
          </p>
          <p style={{ marginTop: 12 }}>
            (4) <strong>Außerordentliche Kündigung:</strong> Beide Parteien behalten sich das Recht zur
            fristlosen Kündigung aus wichtigem Grund vor. Ein wichtiger Grund für den Anbieter liegt
            insbesondere vor bei:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Erheblichem und/oder wiederholtem Verstoß des Nutzers gegen diese AGB</li>
            <li>Dauerhaftem Zahlungsverzug trotz Mahnung</li>
            <li>Nutzung der Plattform für illegale Zwecke</li>
            <li>Begründeten Abmahnungen oder Klageandrohungen Dritter aufgrund von Inhalten des Nutzers</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            (5) Kündigungen können per E-Mail an hello@finestsites.io oder über die Plattform selbst
            erklärt werden. Die Kündigung ist wirksam, sobald sie dem Anbieter zugegangen ist.
          </p>
        </Section>

        <Section title="§ 11 Folgen der Vertragsbeendigung und Datenlöschung">
          <p>
            (1) Mit Beendigung des Abonnements wird die vom Nutzer betriebene Website <strong>deaktiviert</strong>.
            Die zugewiesene Subdomain ist nicht mehr erreichbar. Sofern der Nutzer eine eigene Domain
            eingebunden hatte, liegt die Verantwortung für die Anpassung der DNS-Einstellungen beim Nutzer.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) Der Anbieter bewahrt die Nutzerdaten (Inhalte, hochgeladene Dateien, Einstellungen) nach
            Vertragsbeendigung für einen Zeitraum von <strong>30 Tagen</strong> auf. In diesem Zeitraum kann
            der Nutzer seine Daten exportieren oder das Abonnement reaktivieren. Nach Ablauf dieser Frist
            werden sämtliche Nutzerdaten unwiderruflich gelöscht.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) Der Anbieter übernimmt keine Pflicht zur Datensicherung nach Vertragsbeendigung. Der Nutzer
            ist selbst dafür verantwortlich, rechtzeitig Sicherungskopien seiner Inhalte anzufertigen.
          </p>
          <p style={{ marginTop: 12 }}>
            (4) Bereits geleistete Zahlungen werden nach Vertragsbeendigung nicht erstattet, sofern der
            Dienst bis zum Ende des Abrechnungszeitraums ordnungsgemäß erbracht wurde.
          </p>
        </Section>

        <Section title="§ 12 Haftung">
          <p>
            (1) Der Anbieter haftet unbeschränkt für Schäden, die durch Vorsatz oder grobe Fahrlässigkeit
            des Anbieters, seiner gesetzlichen Vertreter oder Erfüllungsgehilfen verursacht werden, sowie
            für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) Bei leichter Fahrlässigkeit haftet der Anbieter nur, wenn eine wesentliche Vertragspflicht
            (Kardinalpflicht) verletzt wurde. In diesem Fall ist die Haftung auf den vorhersehbaren,
            vertragstypischen Schaden begrenzt.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) Im Übrigen ist die Haftung des Anbieters für leichte Fahrlässigkeit ausgeschlossen.
            Insbesondere haftet der Anbieter nicht für:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Entgangene Gewinne, ausgebliebene Leads oder sonstige mittelbare Schäden des Nutzers</li>
            <li>Datenverluste, die nicht auf grobe Fahrlässigkeit des Anbieters zurückzuführen sind</li>
            <li>Schäden durch Ausfälle oder Fehler von Drittanbieter-Diensten (Cloudflare, Stripe etc.)</li>
            <li>Schäden, die durch fehlerhafte oder unvollständige Angaben des Nutzers entstehen</li>
            <li>Schäden durch Abmahnungen, Klagen oder sonstige Ansprüche Dritter gegenüber dem Nutzer</li>
            <li>Schäden aus der Nutzung der Plattform in Verletzung dieser AGB</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            (4) Die vorstehenden Haftungsbeschränkungen gelten nicht, soweit eine Haftung nach dem
            Produkthaftungsgesetz oder sonstigen zwingenden gesetzlichen Regelungen besteht.
          </p>
          <p style={{ marginTop: 12 }}>
            (5) Gegenüber Unternehmern gilt eine Verjährungsfrist für Schadensersatzansprüche von einem Jahr
            ab Kenntnis des Schadens, sofern nicht gesetzliche Vorschriften kürzere oder längere Fristen
            zwingend vorschreiben.
          </p>
        </Section>

        <Section title="§ 13 Freistellung">
          <p>
            (1) Der Nutzer stellt den Anbieter von sämtlichen Ansprüchen Dritter frei, die aufgrund der
            Inhalte, die der Nutzer über die Plattform veröffentlicht, oder aufgrund der Art und Weise
            der Nutzung der Plattform durch den Nutzer gegen den Anbieter geltend gemacht werden. Dies
            umfasst insbesondere:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 2 }}>
            <li>Abmahnungen, Unterlassungsklagen oder Schadensersatzforderungen von Network-Marketing-Unternehmen
              oder sonstigen Markeninhabern aufgrund der Verwendung von Marken, Logos, Produktbezeichnungen
              oder sonstigen geschützten Kennzeichen durch den Nutzer auf seiner Website</li>
            <li>Ansprüche wegen Verletzung von Urheberrechten durch vom Nutzer hochgeladene Inhalte</li>
            <li>Ansprüche wegen irreführender oder unzulässiger Werbung auf der Nutzer-Website</li>
            <li>Ansprüche wegen Verstößen gegen die DSGVO oder sonstige datenschutzrechtliche Vorschriften
              im Zusammenhang mit dem Betrieb der Nutzer-Website</li>
            <li>Ansprüche wegen fehlenden oder fehlerhaftem Impressum oder fehlender
              Datenschutzerklärung auf der Nutzer-Website</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            (2) Die Freistellungspflicht umfasst auch die Erstattung angemessener Rechtsverteidigungskosten,
            die dem Anbieter durch die Geltendmachung solcher Ansprüche entstehen. Der Anbieter ist
            berechtigt, bei Geltendmachung von Drittansprüchen die Wahl der Rechtsverteidigung selbst
            zu bestimmen.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) Der Anbieter informiert den Nutzer unverzüglich über etwaige Drittansprüche und gibt dem
            Nutzer Gelegenheit, sich dazu zu äußern, soweit dies rechtlich möglich und zumutbar ist.
          </p>
        </Section>

        <Section title="§ 14 Datenschutz und Auftragsverarbeitung">
          <p>
            (1) Der Anbieter verarbeitet personenbezogene Daten des Nutzers zur Vertragserfüllung gemäß der
            geltenden Datenschutzerklärung, abrufbar unter finestsites.io/datenschutz.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) <strong>Verantwortlichkeit für Endkundendaten:</strong> Soweit der Nutzer über seine auf
            der Plattform betriebene Website personenbezogene Daten Dritter verarbeitet (z. B. über
            Kontaktformulare eingehende Anfragen), ist der Nutzer selbst datenschutzrechtlich Verantwortlicher
            im Sinne der DSGVO. Der Anbieter fungiert in dieser Konstellation als Auftragsverarbeiter gemäß
            Art. 28 DSGVO. Der Nutzer verpflichtet sich, die gesetzlichen Anforderungen an die
            Auftragsverarbeitung einzuhalten, insbesondere eine entsprechende Datenschutzerklärung auf
            seiner Website zu veröffentlichen.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) Auf Anfrage schließt der Anbieter mit dem Nutzer einen gesonderten Auftragsverarbeitungsvertrag
            (AVV) gemäß Art. 28 DSGVO ab. Der Nutzer kann einen AVV per E-Mail an hello@finestsites.io
            anfordern.
          </p>
        </Section>

        <Section title="§ 15 Änderung der AGB">
          <p>
            (1) Der Anbieter behält sich vor, diese AGB mit Wirkung für die Zukunft zu ändern. Änderungen
            werden dem Nutzer per E-Mail an die hinterlegte Adresse mitgeteilt, und zwar mindestens
            <strong>6 Wochen vor dem geplanten Inkrafttreten</strong>.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) Widerspricht der Nutzer den geänderten AGB nicht innerhalb von 6 Wochen nach Zugang der
            Änderungsmitteilung, gelten die geänderten AGB als angenommen. Auf dieses Recht zur
            Ablehnung und die Folgen des Schweigens wird in der Änderungsmitteilung ausdrücklich
            hingewiesen.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) Widerspricht der Nutzer form- und fristgerecht den geänderten AGB, hat der Anbieter das
            Recht, den Vertrag zum Zeitpunkt des Inkrafttretens der geänderten AGB ordentlich zu kündigen.
          </p>
        </Section>

        <Section title="§ 16 Schlussbestimmungen">
          <p>
            (1) <strong>Anwendbares Recht:</strong> Es gilt ausschließlich das Recht der Bundesrepublik
            Deutschland unter Ausschluss des UN-Kaufrechts (CISG). Bei Verbrauchern gilt diese
            Rechtswahl nur, soweit der durch zwingende Bestimmungen des Staates, in dem der Verbraucher
            seinen gewöhnlichen Aufenthalt hat, gewährte Schutz nicht entzogen wird.
          </p>
          <p style={{ marginTop: 12 }}>
            (2) <strong>Gerichtsstand:</strong> Für Streitigkeiten mit Unternehmern ist ausschließlicher
            Gerichtsstand der Sitz des Anbieters (Haßfurt, Bayern). Für Streitigkeiten mit Verbrauchern
            gilt der gesetzliche Gerichtsstand.
          </p>
          <p style={{ marginTop: 12 }}>
            (3) <strong>Salvatorische Klausel:</strong> Sollten einzelne Bestimmungen dieser AGB ganz
            oder teilweise unwirksam oder undurchführbar sein oder werden, berührt dies die Wirksamkeit
            der übrigen Bestimmungen nicht. Die unwirksame Bestimmung gilt als durch eine wirksame
            ersetzt, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am nächsten kommt.
          </p>
          <p style={{ marginTop: 12 }}>
            (4) <strong>Keine Abtretung:</strong> Der Nutzer ist nicht berechtigt, Rechte und Pflichten
            aus diesem Vertrag ohne vorherige schriftliche Zustimmung des Anbieters an Dritte abzutreten.
          </p>
          <p style={{ marginTop: 12 }}>
            (5) <strong>Streitbeilegung:</strong> Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung bereit:{' '}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" style={{ color: '#8060b0' }}>
              ec.europa.eu/consumers/odr
            </a>. Der Anbieter ist nicht bereit und nicht verpflichtet, an einem Streitbeilegungsverfahren
            vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
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
