/**
 * Ergänzung zur Auftragsverarbeitung (Art. 28 DSGVO) für den Besucher-Chat.
 *
 * Der Nutzer stimmt beim ersten Einschalten des Chats im Editor zu (elektronische Form, Art. 28 Abs. 9 DSGVO).
 * Gespeichert wird in `chat_avv_consents`: Zeitpunkt, Version, SHA-256 des exakten Textes, IP, User-Agent.
 * Öffentlich lesbar unter finestsites.io/agb/avv-besucher-chat.
 *
 * WICHTIG: Den Text einer Version NIE nachträglich ändern. Neue Fassung → neue Version anhängen und
 * CHAT_AVV_CURRENT_VERSION umstellen (bestehende Zustimmungen gelten für ihre Version weiter).
 */
import { createHash } from 'node:crypto'

export type AvvSection = { title: string; paragraphs: string[] }

export const CHAT_AVV_CURRENT_VERSION = 'chat-v1'
export const CHAT_AVV_STAND = 'Oktober 2026'

export const CHAT_AVV_SECTIONS: Record<string, AvvSection[]> = {
  'chat-v1': [
    {
      title: '§ 1 Parteien und Verhältnis zu den AGB',
      paragraphs: [
        'Diese Ergänzung gilt zwischen dem Nutzer als Verantwortlichem und FinestSites Daniel Kurzeja, Herrleinstr. 39, 97437 Haßfurt (nachfolgend „Anbieter“), als Auftragsverarbeiter. Sie ergänzt § 14 der AGB und regelt die Verarbeitung personenbezogener Daten über den Besucher-Chat. Soweit diese Ergänzung etwas Abweichendes regelt, geht sie für den Besucher-Chat den AGB vor.',
        'Die Ergänzung wird elektronisch abgeschlossen (Art. 28 Abs. 9 DSGVO), indem der Nutzer den Besucher-Chat im Editor einschaltet und ihr dabei ausdrücklich zustimmt.',
      ],
    },
    {
      title: '§ 2 Gegenstand, Art und Zweck der Verarbeitung',
      paragraphs: [
        'Der Anbieter stellt auf den Webseiten des Nutzers ein Chat-Fenster bereit, über das Besucher dem Nutzer Nachrichten schreiben können. Der Anbieter nimmt die Nachrichten entgegen, speichert sie, zeigt sie dem Nutzer in der App und im Web-Dashboard an, übermittelt die Antworten des Nutzers an den Besucher und benachrichtigt den Nutzer per Push-Mitteilung sowie den Besucher – nur auf dessen Wunsch – per E-Mail über neue Antworten.',
        'Zum Schutz vor Missbrauch prüft der Anbieter Nachrichten automatisch (Länge, Links, grobe Beleidigungen, Wiederholungen), begrenzt die Zahl der Nachrichten und sperrt auffällige Besucher automatisch oder auf Wunsch des Nutzers.',
      ],
    },
    {
      title: '§ 3 Art der Daten und Kreis der Betroffenen',
      paragraphs: [
        'Betroffene sind die Besucher der Webseiten des Nutzers, die den Chat nutzen.',
        'Verarbeitet werden: Inhalt der Nachrichten, Zeitpunkte, die aufgerufene Seite, freiwillig angegebener Name, E-Mail-Adresse und Telefonnummer, die Einstellung „Antworten per E-Mail erhalten“, eine zufällige Chat-Kennung des Browsers (nur als Hash gespeichert), der Gesprächs-Code sowie die IP-Adresse ausschließlich als nicht rückrechenbarer Hash.',
      ],
    },
    {
      title: '§ 4 Dauer und Löschung',
      paragraphs: [
        'Die Verarbeitung dauert, solange der Nutzer den Besucher-Chat nutzt und der Vertrag mit dem Anbieter besteht.',
        'Gespräche werden 180 Tage nach der letzten Nachricht automatisch gelöscht. Der Nutzer kann Gespräche jederzeit selbst löschen. Schaltet der Nutzer den Chat aus, bleiben bestehende Gespräche bis zu ihrer Löschung für ihn sichtbar. Endet der Vertrag, löscht der Anbieter die Chat-Daten, soweit keine gesetzliche Pflicht zur Aufbewahrung besteht; verschlüsselte Sicherungskopien werden im regulären Ablauf überschrieben.',
      ],
    },
    {
      title: '§ 5 Weisungen',
      paragraphs: [
        'Der Anbieter verarbeitet die Daten nur auf dokumentierte Weisung des Nutzers, es sei denn, er ist gesetzlich zur Verarbeitung verpflichtet. Weisungen sind diese Ergänzung, die AGB sowie die Einstellungen und Handlungen des Nutzers in Editor, App und Web-Dashboard (z. B. Chat ein- und ausschalten, Gespräche löschen, Besucher sperren). Weitere Weisungen erteilt der Nutzer per E-Mail an info@finestsites.io.',
        'Hält der Anbieter eine Weisung für rechtswidrig, weist er den Nutzer unverzüglich darauf hin.',
      ],
    },
    {
      title: '§ 6 Vertraulichkeit und Sicherheit',
      paragraphs: [
        'Der Anbieter setzt nur Personen ein, die zur Vertraulichkeit verpflichtet sind oder einer gesetzlichen Verschwiegenheitspflicht unterliegen.',
        'Der Anbieter trifft geeignete technische und organisatorische Maßnahmen nach Art. 32 DSGVO, insbesondere: verschlüsselte Übertragung (TLS), Speicherung auf Servern in Deutschland, Zugriff nur für den Nutzer über sein Konto, Speicherung von Browser-Kennungen und IP-Adressen nur als Hash, regelmäßige verschlüsselte Sicherungen, automatische Löschfristen sowie Schutz vor Missbrauch durch Filter, Mengenbegrenzungen und Sperren.',
      ],
    },
    {
      title: '§ 7 Unterauftragsverarbeiter',
      paragraphs: [
        'Der Nutzer genehmigt den Einsatz folgender Unterauftragsverarbeiter: Hetzner Online GmbH, Gunzenhausen, Deutschland (Server und Datenbank); Cloudflare, Inc., San Francisco, USA (Auslieferung der Webseite und Weiterleitung der Chat-Anfragen); 650 Industries, Inc. (Expo), San Francisco, USA, mit Apple Inc. bzw. Google (Push-Mitteilungen an den Nutzer, mit Name des Besuchers und Nachrichtenvorschau); Resend, Inc., San Francisco, USA (E-Mail-Benachrichtigungen an Besucher, nur auf deren Wunsch).',
        'Übermittlungen in die USA erfolgen auf Grundlage des EU-U.S. Data Privacy Framework, soweit der Empfänger zertifiziert ist, und ergänzend der Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO). Der Anbieter verpflichtet seine Unterauftragsverarbeiter vertraglich auf ein gleichwertiges Datenschutzniveau.',
        'Über beabsichtigte Änderungen bei den Unterauftragsverarbeitern informiert der Anbieter den Nutzer vorab. Der Nutzer kann widersprechen; in diesem Fall kann er den Chat ausschalten.',
      ],
    },
    {
      title: '§ 8 Unterstützung des Nutzers',
      paragraphs: [
        'Der Anbieter unterstützt den Nutzer bei der Erfüllung der Rechte der Betroffenen (z. B. Auskunft, Berichtigung, Löschung) und bei seinen Pflichten nach Art. 32 bis 36 DSGVO. Gespräche kann der Nutzer selbst einsehen und löschen; weitergehende Anfragen bearbeitet der Anbieter auf Anforderung per E-Mail.',
        'Wendet sich ein Besucher mit einem Anliegen zu seinen Daten direkt an den Anbieter, leitet der Anbieter es an den Nutzer weiter.',
        'Der Anbieter ergänzt die Datenschutzerklärung der Webseite des Nutzers automatisch um einen Abschnitt zum Chat, solange der Chat eingeschaltet ist.',
      ],
    },
    {
      title: '§ 9 Meldung von Verletzungen',
      paragraphs: [
        'Der Anbieter informiert den Nutzer unverzüglich, wenn ihm eine Verletzung des Schutzes personenbezogener Daten aus dem Besucher-Chat bekannt wird, und unterstützt ihn bei Meldungen an die Aufsichtsbehörde und an Betroffene.',
      ],
    },
    {
      title: '§ 10 Nachweise und Kontrollen',
      paragraphs: [
        'Der Anbieter stellt dem Nutzer auf Anfrage die Informationen zur Verfügung, die zum Nachweis der Einhaltung dieser Pflichten erforderlich sind, und ermöglicht Überprüfungen durch den Nutzer oder einen von ihm beauftragten Prüfer nach rechtzeitiger Absprache, zu üblichen Geschäftszeiten und ohne Störung des Betriebs.',
      ],
    },
  ],
}

/** Kurztext neben dem Schalter im Editor (Teil der Zustimmung, daher mit im Hash). */
export const CHAT_AVV_CONSENT_LINE: Record<string, string> = {
  'chat-v1': 'Ich schalte den Besucher-Chat ein und stimme der Ergänzung zur Auftragsverarbeitung (Besucher-Chat) zu.',
}

export function chatAvvFullText(version = CHAT_AVV_CURRENT_VERSION): string {
  const sections = CHAT_AVV_SECTIONS[version] ?? []
  return [
    CHAT_AVV_CONSENT_LINE[version] ?? '',
    ...sections.map(s => `${s.title}\n${s.paragraphs.join('\n')}`),
  ].join('\n\n')
}

export function chatAvvTextHash(version = CHAT_AVV_CURRENT_VERSION): string {
  return createHash('sha256').update(chatAvvFullText(version)).digest('hex')
}
