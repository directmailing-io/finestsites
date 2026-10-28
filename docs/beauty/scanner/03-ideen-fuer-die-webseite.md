# Ideen: den AI Scanner auf einer Partner-Beauty-Webseite einbinden

Stand: 28.10.2026. **Alles in diesem Dokument sind Ideen und Vorschläge (eigene Einordnung), keine Vorgaben von PM.** Vor der Umsetzung rechtlich und mit PM (Markenrichtlinie) abstimmen. Fakten und Zitate stehen in `01-ai-scanner-ueberblick.md` und `02-ablauf-in-der-app.md`.

---

## 1. Grundidee

Der Scanner läuft **nur in der FitLine-App**, und freigeschaltet wird er vom **Teampartner**. Die Webseite kann also selbst nicht scannen. Sie kann aber:

1. erklären, was bei einer Hautanalyse passiert (kurz und ehrlich),
2. Vertrauen schaffen, wer die Analyse macht und was mit den Daten passiert,
3. in einen **Termin bzw. eine Kontaktanfrage „Hautanalyse mit mir“** führen.

Das passt zur Kernbotschaft „Schönheit von innen & außen“, denn auch PM beschreibt die Empfehlungen als Pflege von außen plus ausgewählte Nahrungsergänzung von innen.

**Bewusst nicht:** Upload eines Gesichtsfotos auf der Webseite, eigener „Mini-Scanner“, Hautwerte im Formular abfragen. Das wären Gesundheits- bzw. Art.-9-Daten auf unserer Plattform, mit Haftung und Aufwand, und es würde PMs Werkzeug nachbauen.

---

## 2. Bausteine für das Template

### A. Sektion „Deine Hautanalyse mit mir“ (Hauptbaustein)

Ein Vorschlag, um ein- und ausschaltbar im Editor:

- **Überschrift (Idee):** „Lass uns gemeinsam auf Deine Haut schauen.“ / „Deine Hautanalyse – in ein paar Minuten.“
- **Drei Schritte** als ruhige Liste, nicht als Kachel-Gitter (siehe Design-Feedback „kein KI-Look“):
  1. **Kurz kennenlernen**: ein paar Fragen zu Deinen Wünschen an Deine Pflege.
  2. **Selfie bei Tageslicht**: Ich mache mit Dir ein Foto in der FitLine-App. Brille ab, Haare zurück.
  3. **Ergebnis ansehen**: Wir schauen uns gemeinsam an, was die App zu Feuchtigkeit, Poren, Hautbild und Co. sagt, und welche Pflegeroutine dazu passt.
- **Button:** „Hautanalyse anfragen“ (öffnet das Formular aus Baustein C)
- **Kleiner Hinweis darunter (Pflicht):** „Die Hautanalyse ist eine kosmetische Einschätzung per App und keine medizinische Untersuchung. Bei Hautproblemen wende Dich bitte an eine Hautärztin oder einen Hautarzt.“

### B. „Was die App auswertet“ (optional, aufklappbar)

- Nüchterne Liste mit den Begriffen aus der App, auf Deutsch: Feuchtigkeit, Falten, Rötungen, Pigmentflecken, Augenpartie, Unreinheiten, Poren, Hautbild, Straffheit, Ausstrahlung, Fettglanz. Dazu kommen ein Gesamtwert und ein geschätztes Hautalter.
- Formulierung: „Die App schätzt …“, „zeigt eine Einschätzung zu …“. Nie „misst exakt“ oder „diagnostiziert“.
- Optional ein Satz: „Laut Hersteller wertet die App über 100 Punkte im Gesicht aus.“ So bleibt klar, dass es eine Herstellerangabe ist.

### C. Anfrage- bzw. Terminformular „Hautanalyse anfragen“

Über das bestehende FinestSites-Formularsystem (`/api/worker/submit`).

- **Felder (minimal):** Vorname · E-Mail oder Telefon/WhatsApp · Wunsch: „Vor Ort“ / „Per Videocall“ / „Ruf mich an“ · Wunschzeitraum (Freitext oder Auswahl: vormittags/nachmittags/abends) · optional „Was ist Dir bei Deiner Pflege wichtig?“
- **Nicht abfragen:** Hautkrankheiten, Medikamente, Allergien, Fotos, Alter oder Geschlecht. Das alles fragt die App später selbst und mit eigener Einwilligung.
- **Auswahl „Was ist Dir wichtig?“** kosmetisch und wunschorientiert, angelehnt an die App-Ziele: „Mehr Feuchtigkeit & Glow“ · „Vorbeugen (Anti-Aging)“ · „Ebenmäßiger Teint“ · „Klareres Hautbild“ · „Pflege von innen kennenlernen“. **Nicht:** „Akne loswerden“, „Rosazea“, „Neurodermitis“ (siehe PM-Hinweis vom 08.10.2026: keine Beschwerden in Funnels).
- **Einwilligungstext am Formular (Entwurf):** „Ich bin einverstanden, dass [Name] mich zur Vereinbarung einer Hautanalyse kontaktiert. Die Analyse selbst findet später in der FitLine-App statt. Dort wirst Du vor dem Foto gesondert um Deine Einwilligung gebeten.“
- Nach dem Absenden kommt eine freundliche Bestätigung und optional der WhatsApp-Knopf (wie in den Kontakt-Fenstern der anderen Templates).

### D. „Was passiert mit meinem Foto?“ (FAQ-Eintrag)

Wichtig für das Vertrauen und nah an PMs eigener Datenschutzerklärung:

> „Das Foto wird in der FitLine-App aufgenommen, nicht auf dieser Webseite. Laut PM-International wird es nur vorübergehend in der EU gespeichert, von einem KI-Dienst ausgewertet und danach gelöscht. Vorher wirst Du in der App ausdrücklich um Deine Einwilligung gebeten. Die Ergebnisse kann ich Dir als PDF geben. Ich teile sie mit niemandem sonst.“

Dazu ein Link auf PMs App-Datenschutzerklärung. [Idee] Den Satz „Ich teile sie mit niemandem sonst“ nur verwenden, wenn die Partnerin das auch so handhabt.

### E. Brücke „von innen & außen“

- Ein Satz, der Scanner und Kernbotschaft verbindet: „Die App schlägt eine Routine aus Pflege für außen und, wenn es passt, Nährstoffen für innen vor. Was davon Du ausprobieren möchtest, entscheidest Du.“
- Darunter (nur wenn der Partner das Produkt-Modul nutzt) die Produkte der Beauty-Seite. **Keine** Aussage wie „Die App hat festgestellt, dass Du X brauchst“.

### F. Weitere FAQ-Einträge (Vorschläge)

- „Kostet die Hautanalyse etwas?“ Die Partnerin legt die Antwort im Editor fest (Feld), z. B. „Nein, die Analyse ist für Dich kostenlos und unverbindlich.“
- „Muss ich danach etwas kaufen?“ „Nein. Du bekommst Dein Ergebnis und eine Empfehlung. Ob Du etwas ausprobierst, entscheidest Du in Ruhe.“ (Ein bewusster Gegenpol zum internen PM-Ton „Abschluss sofort“.)
- „Brauche ich die App?“ „Nein, ich mache die Analyse mit meinem Handy.“
- „Soll ich ungeschminkt kommen?“ „Am besten ja. Die App fragt aber auch, ob Du Make-up trägst.“
- „Wie lange dauert es?“ „Ein paar Minuten.“
- „Geht das auch online?“ Hängt davon ab, ob die Partnerin per Videocall anbietet. [Unbestätigt, ob „Upload Existing Picture“ live ist. Falls ja, könnte die Kundin ein Foto schicken. Das bringt aber Datenschutzaufwand und ist nicht empfohlen, bevor PM es freigibt.]

---

## 3. Editor-Felder (Vorschlag für das Schema)

| Feld | Typ | Standard |
|---|---|---|
| `scanner_enabled` | Schalter | aus (nur für Partner mit Scanner-Freischaltung) |
| `scanner_headline` | Text | „Deine Hautanalyse – mit mir.“ |
| `scanner_intro` | Text, kurz | „In ein paar Minuten schauen wir gemeinsam auf Deine Haut, ganz ohne Termindruck.“ |
| `scanner_modes` | Mehrfachauswahl | Vor Ort · Videocall · Telefon |
| `scanner_price_note` | Auswahl/Text | „kostenlos & unverbindlich“ |
| `scanner_region` | Text, optional | z. B. „in und um Köln“ |
| `scanner_photo` | Bild, optional | eigenes Foto der Partnerin (kein Kundengesicht ohne Einwilligung) |

Den Medizin-Hinweis und den Datenschutz-Text fest im Template verankern, damit sie nicht entfernt werden können.

---

## 4. Rechtssicherheit: Leitplanken

**Werbeaussagen (Kosmetik-Claims, VO (EU) 655/2013; Health Claims bei Nahrungsergänzung, VO (EG) 1924/2006):**

- Keine Heil- oder Krankheitsbezüge: kein „Akne“, „Rosazea“, „Ekzem“, „Hautkrankheit“, „Therapie“, „heilen“, „Diagnose“, „dermatologisch geprüfte Analyse“.
- Keine Versprechen zum Ergebnis: kein „Dein Hautalter sinkt“, „sichtbar jünger in X Tagen“, „100 % passende Pflege“, „wissenschaftlich exakt“.
- Keine Übernahme von PMs Superlativen ohne Quelle: „Weltneuheit“, „einziges Unternehmen weltweit“, „zum Patent angemeldet“ besser weglassen oder ausdrücklich als Herstellerangabe kennzeichnen.
- Zum Kollagen-Drink (Beauty) nur zugelassene Angaben verwenden (die Datenblätter liegen in `docs/beauty/quellen/datenblaetter/`). Vom Scan-Ergebnis nicht auf einen Nährstoffbedarf schließen.
- Die interne Verkaufssprache von PM („Abschluss sofort tätigen“, „Hör auf zu empfehlen, fang an zu zeigen“) gehört nicht auf die Kundenseite.

**Marke (PM-Hinweis vom 08.10.2026, Richtlinie „Logos/Brands/Names“):**

- [Offene Frage] Ob „FitLine AI Scanner“ als Name und App-Screenshots auf Partnerseiten erlaubt sind, ist ungeklärt. **Sicherer Standard:** neutral „Hautanalyse per App“ und keine Screenshots aus dem PM-Video (Urheberrecht). Nur wenn PM es freigibt, ein Schalter für den Markennamen.
- Keine Gesichter aus PM-Materialien ohne Lizenz.

**Datenschutz:**

- Auf der Webseite nur Kontaktdaten erheben, keine Gesundheits- oder Bilddaten.
- FAQ-Eintrag D und Link auf PMs Datenschutzerklärung. Zusätzlich die FinestSites-Datenschutzerklärung der Partnerseite um den Zweck „Terminanfrage Hautanalyse“ ergänzen (prüfen, ob der vorhandene Formular-Abschnitt das schon abdeckt).
- [Hinweis für Partner, z. B. als Editor-Tooltip] PM schreibt selbst, der Scanner sei für das eigene Gesicht gedacht. Für Fremde braucht es eine Einwilligung. Vor dem Scan also die Kundin fragen. Das PDF nur mit ihrem Okay teilen und es nicht dauerhaft auf dem Handy behalten.
- Kein Tracking-Ereignis mit Hautbezug (z. B. kein Meta-Event „Akne-Interesse“), höchstens neutral „Lead“.

**Barrierefreiheit und Ton:**

- Laientaugliche Sprache, Du-Form wie in den anderen Templates, keine Fachbegriffe ohne Erklärung.
- Ruhiges Design ohne Blobs oder Kachel-Gitter (Design-Feedback). Der Aufruf zur Analyse soll above the fold oder als zweite Sektion sichtbar sein.

---

## 5. Varianten zum Ausprobieren

1. **Leise Variante:** nur ein Satz im „Über mich“-Bereich („Ich biete Dir eine kostenlose Hautanalyse per App an.“) plus Button.
2. **Standard:** Sektion A mit Formular C und FAQ D.
3. **Event-Variante:** „Beauty-Abend mit Hautanalyse“ (Datum, Ort, begrenzte Plätze) als Termin-Karte, für Partnerinnen, die Gruppentermine machen.
4. **Follow-up-Variante:** Eine Seite oder ein Anker „Dein Ergebnis besprechen“ für Kundinnen, die schon gescannt wurden, mit Rückruf-Wunsch. Ohne Ergebnis-Upload.

---

## 6. Offene Punkte vor der Umsetzung

- Freigabe von PM zum Markennamen und zu Bildern (siehe oben)
- Klären, ob Online- bzw. Foto-Upload-Analysen offiziell erlaubt sind
- Juristische Prüfung der Hinweis- und Einwilligungstexte
- Ob der Editor die Freischaltung des Scanners prüfen kann, ist unklar (es gibt keine API). Daher Selbstauskunft per Schalter.
- Abgleich mit `docs/new-template-checklist.md` beim Rollout
