# Entwurf: Rechtstexte zur Kontolöschung (Stand 22.10.2026)

> **Entwurf zur Freigabe durch Daniel / Steuerberater / ggf. Anwalt. Nicht veröffentlicht.**
> Beschreibt nur, was der Code (Branch `app-v1-deletion`, `src/lib/account-deletion/`) tatsächlich tut.
> Einbau später an allen Fundorten gemeinsam (`src/app/datenschutz/page.tsx`, `src/app/agb/page.tsx`).
> Offene Fragen stehen am Ende – bitte vor Veröffentlichung klären.

---

## A) Datenschutzerklärung – neuer Abschnitt „Löschung deines Kontos“

### Konto löschen

Du kannst dein FinestSites-Konto jederzeit selbst löschen: im Dashboard unter *Einstellungen → Konto & FAQ → Konto löschen* oder in der App unter *Konto → Konto löschen*. Dafür musst du dein Passwort eingeben. Eine Nachricht an den Support ist nicht nötig.

**Sofort nach deiner Anfrage**

- gehen alle deine Webseiten offline,
- endet dein Abonnement bei uns (über unseren Zahlungsdienstleister Stripe),
- wirst du auf allen Geräten abgemeldet; Geräte-Kennungen für Mitteilungen (Push) werden gelöscht,
- bekommst du eine Bestätigung per E-Mail.

**Bedenkzeit:** Die endgültige Löschung erfolgt 14 Tage nach deiner Anfrage. Bis dahin kannst du dich anmelden und die Löschung abbrechen. Deine Webseiten bleiben nach einem Abbruch offline, bis du sie wieder veröffentlichst; ein beendetes Abonnement wird nicht automatisch fortgesetzt. In der Bedenkzeit senden wir dir keine Newsletter oder Angebots-Mails.

**Was wir nach Ablauf der 14 Tage löschen** (Art. 17 Abs. 1 DSGVO):

- deine Profildaten (Name, Firma, Telefon, Profilbild, Social-Media-Angaben, Teampartner-Nummer, Markenfarbe),
- deine Webseiten mit allen Inhalten, Bildern und Einstellungen,
- die Anfragen, die über deine Webseiten an dich gesendet wurden,
- deine Support-Unterhaltungen inklusive gesendeter Bilder,
- deine Einstellungen für Werbung und Tracking (z. B. Pixel-IDs, Zugangsschlüssel),
- Mitteilungen, Mitteilungs-Einstellungen, Anmeldedaten und Sitzungen,
- das Protokoll der an dich gesendeten E-Mails,
- die Verbindung eigener Domains mit FinestSites (die DNS-Einträge bei deinem Domain-Anbieter musst du selbst entfernen).

Statistiken über Seitenaufrufe deiner Webseiten bleiben nur ohne Bezug zu dir erhalten (Adresse der Seite, Besucherkennung und Herkunftsangaben werden entfernt).

**Was bestehen bleibt**

- **Benutzername:** Dein Benutzername wird nicht neu vergeben. Wir speichern ihn zusammen mit einer internen Kennnummer weiter, damit Links und Empfehlungslinks, die du verbreitet hast, nie auf eine andere Person zeigen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse, Verwechslungen und Missbrauch zu verhindern). Deine E-Mail-Adresse wird gelöscht; du kannst dich mit ihr später neu registrieren.
- **Zahlungsdaten bei Stripe:** Rechnungen für dein Abonnement erstellt und speichert unser Zahlungsdienstleister Stripe. Wir bewahren dazu nur die Stripe-Kundennummer auf, damit spätere Erstattungen oder Rückbuchungen den aufbewahrten Buchungen zugeordnet werden können.
- **Partnerprogramm:** Gutschriften (Provisionsabrechnungen) und die zugehörigen Provisions- und Auszahlungsbuchungen müssen wir aufbewahren (siehe Aufbewahrungsfristen). Die Gutschriften enthalten die Abrechnungsangaben, die zum Zeitpunkt der Auszahlung galten (Name bzw. Firma, Anschrift, steuerlicher Status, Steuernummer bzw. USt-IdNr.).

### Aufbewahrungsfristen

Soweit gesetzliche Aufbewahrungspflichten bestehen, löschen wir die betroffenen Daten nicht sofort, sondern sperren sie für jede andere Verwendung und löschen sie nach Ablauf der Frist (Art. 17 Abs. 3 lit. b i. V. m. Art. 6 Abs. 1 lit. c DSGVO):

| Unterlage | Frist | Grundlage |
|---|---|---|
| Gutschriften an Partner (Provisionsabrechnungen) | 8 Jahre | § 147 Abs. 1 Nr. 4, Abs. 3 AO; § 14b Abs. 1 UStG |
| Provisions- und Auszahlungsbuchungen | 10 Jahre | § 147 Abs. 1 Nr. 1, Abs. 3 AO |
| Rechnungen für dein Abonnement | gespeichert bei Stripe | § 147 AO, § 14b UStG |

Die Fristen beginnen mit dem Ende des Kalenderjahres, in dem die Unterlage entstanden ist (§ 147 Abs. 4 AO). Beispiel: Eine Gutschrift vom Oktober 2026 bewahren wir bis zum 31.12.2034 auf, die zugehörige Buchung bis zum 31.12.2036.

Hast du bei der Löschung noch ein Guthaben aus dem Partnerprogramm, das wir nicht automatisch auszahlen können, bewahren wir zusätzlich deine E-Mail-Adresse und deine Abrechnungsangaben auf, bis das Guthaben ausgezahlt ist, längstens bis zur Verjährung des Anspruchs (3 Jahre ab Ende des Jahres, in dem dein Konto gelöscht wurde, §§ 195, 199 Abs. 1 BGB). Rechtsgrundlage: Art. 6 Abs. 1 lit. b und c DSGVO.

Außerdem speichern wir zu jeder Lösch-Anfrage, wann sie gestellt, abgebrochen oder ausgeführt wurde und – falls du auf ein Guthaben verzichtet hast – den Wortlaut und Zeitpunkt deiner Verzichtserklärung. Das dient dem Nachweis, dass wir deine Anfrage korrekt bearbeitet haben (Art. 5 Abs. 2, Art. 6 Abs. 1 lit. c und f DSGVO).

---

## B) AGB – Ergänzungen

### § 10 Laufzeit und Kündigung – neuer Absatz (6)

> (6) **Kündigung durch Kontolöschung.** Der Nutzer kann sein Nutzerkonto jederzeit in den Einstellungen bzw. in der App löschen. Die Lösch-Anfrage gilt als Kündigung des Abonnements mit sofortiger Wirkung; abweichend von Abs. 2 endet das Abonnement nicht erst zum Ende des laufenden Abrechnungszeitraums. Für den bereits bezahlten, nicht mehr genutzten Zeitraum erfolgt keine Erstattung. Mit der Anfrage werden die Websites des Nutzers deaktiviert. Das Nutzerkonto wird 14 Tage nach der Anfrage endgültig gelöscht; bis dahin kann der Nutzer die Löschung nach Anmeldung abbrechen. Ein Abbruch stellt das beendete Abonnement nicht wieder her; die Websites bleiben deaktiviert, bis der Nutzer sie erneut veröffentlicht.

### § 11 Folgen der Vertragsbeendigung und Datenlöschung – Abs. 2 Satz 4 ersetzen

Bisher: „Das Nutzerkonto selbst (E-Mail-Adresse, Zugangsdaten) bleibt davon unberührt und kann jederzeit über info@finestsites.io zur Löschung beantragt werden.“

Neu:
> Das Nutzerkonto selbst bleibt davon unberührt. Der Nutzer kann es jederzeit selbst löschen (§ 10 Abs. 6). Gesetzlich aufzubewahrende Unterlagen (insbesondere Gutschriften und Buchungen aus dem Partnerprogramm) werden bis zum Ablauf der Aufbewahrungsfristen aufbewahrt. Der Benutzername eines gelöschten Kontos wird nicht neu vergeben.

### § 16 Partnerprogramm – neuer Absatz „Guthaben bei Kontolöschung“

> (x) **Guthaben bei Kontolöschung.** Löscht der Partner sein Nutzerkonto, endet seine Teilnahme am Partnerprogramm mit der endgültigen Löschung; für Zahlungen geworbener Nutzer danach entstehen keine Provisionen mehr. Hat der Partner zum Zeitpunkt der Lösch-Anfrage ein Guthaben (fällige und noch nicht fällige Provisionen sowie ein nach Abs. 3 gutgeschriebenes, noch nicht verrechnetes Guthaben), muss er bei der Anfrage ausdrücklich wählen:
> 1. **Schlussauszahlung:** Fällige Provisionen werden nach der Löschung abweichend von Abs. 3 ohne Mindestbetrag und unabhängig vom monatlichen Abrechnungsrhythmus auf das eingerichtete Auszahlungskonto überwiesen; noch nicht fällige Provisionen, sobald sie fällig werden. Es gelten im Übrigen die Voraussetzungen und das Gutschriftverfahren nach Abs. 3 und 4. Fehlt ein Auszahlungskonto oder fehlen die Abrechnungsangaben, oder handelt es sich um ein bereits gutgeschriebenes Guthaben, wird das Guthaben auf Anfrage des Partners an info@finestsites.io ausgezahlt; der Anspruch verjährt nach den gesetzlichen Vorschriften (§§ 195, 199 BGB).
> 2. **Verzicht:** Der Partner verzichtet ausdrücklich auf das gesamte Guthaben. Der Verzicht wird mit der endgültigen Löschung wirksam; bricht der Partner die Löschung ab, gilt er nicht.
>
> Ein Guthaben verfällt nicht ohne ausdrückliche Erklärung des Partners. Entsteht ein Guthaben erst nach der Lösch-Anfrage, wird es wie bei Nr. 1 behandelt.

---

## C) Offene rechtliche / steuerliche Fragen (vor Veröffentlichung klären)

1. **Fristen bestätigen (Steuerberater):** 8 Jahre für Gutschriften (§ 147 Abs. 3 AO in der Fassung des BEG IV, § 14b Abs. 1 UStG) und 10 Jahre für Provisions-/Auszahlungsbuchungen (§ 147 Abs. 1 Nr. 1 AO). Der Code setzt `retention_until` derzeit für Provisionen UND Gutschrift-Zeilen auf 10 Jahre (die Gutschrift-Zeile ist zugleich Auszahlungsbuchung). Ist für die Gutschrift-PDF in R2 eine eigene 8-Jahres-Löschung gewünscht?
2. **Keine Erstattung bei Sofort-Kündigung durch Löschung**, auch nicht beim Jahresabo: mit B2B-AGB (§ 307 BGB) vereinbar? Alternativ anteilige Erstattung.
3. **Übermittlung der Schluss-Gutschrift:** Eine Gutschrift muss dem Partner übermittelt werden (§ 14 Abs. 2 Satz 2 UStG). Nach der Löschung kann er sich nicht mehr anmelden; der Code informiert nur den Admin („Gutschrift an Kontaktadresse übermitteln“). Automatischer Versand per E-Mail mit PDF?
4. **Weitere Speicherung von Daten mit Bezug zu Nutzern:** Stripe-Kundennummer im Grabstein; Einwilligungsnachweis Inhalte (Zeitpunkt, Version, Text-Hash ohne IP/Browser) bleibt im Grabstein – ausreichend begründet (Art. 17 Abs. 3 lit. e DSGVO, Verjährung möglicher Ansprüche Dritter)? Oder ebenfalls nach 3 Jahren löschen?
5. **Neukunden-Prüfung nach Löschung:** E-Mail, Teampartner-Nummer und Zahlungsmittel-Fingerabdrücke werden gelöscht. Ein gelöschter Kunde kann sich daher erneut als „Neukunde“ mit Empfehlungsrabatt registrieren. Soll ein Hash (berechtigtes Interesse, Missbrauchsschutz) aufbewahrt werden?
6. **Empfehlungslink eines gelöschten Partners:** Der Benutzername bleibt reserviert, neue Provisionen entstehen nicht. Ob Neukunden über diesen Link weiterhin den Empfehlungsrabatt bekommen, ist noch nicht geregelt (derzeit unverändert).
7. **Bestandskunden über AGB-Änderung informieren** (§ 15 AGB: 6 Wochen) – nur mit ausdrücklicher Freigabe von Daniel.
