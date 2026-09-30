# Template: Der Vitalcheck – Variante B („Profil“)

Zweite, eigenständige Variante des Vitalchecks (gleiche 20 Verhaltens-Aussagen, gleiche Rechtsleitplanken wie `templates/vitalcheck/`, siehe dort und `docs/konzept-vitalcheck.html`), aber mit anderem UI und anderem Auswertungskonzept. Orientiert an Persönlichkeitsanalysen wie mindprofile.co.

## UI

- Warmes Off-White, kleine Marke (Avatar + Name) links oben, schlanke Fortschritts-Pille „Vitalcheck · 35 % abgeschlossen“ mit Ring, Flaggen rechts
- **Startseite nach mindprofile.co/de/personality**: Kopfzeile mit Avatar/Name, dunklem Pill-Button „Vitalcheck starten“ und Flaggen (keine Fortschritts-Pille). Weiße Hero-Karte: links grüner Kicker „Dauert 3 Minuten“, dreizeilige Headline mit grüner Mittelzeile, kurzer Absatz, dunkler Pill-Button, „*Keine Anmeldung erforderlich“; rechts eine Farbfläche mit Handy-Mockup, das den Check zeigt. Darunter drei nummerierte Schritt-Karten (Mach dich bereit, Mach den Check, Erhalte dein Vitalprofil). Footer als abgerundeter grauer Block. Der Wunsch-Schritt ist die erste Check-Seite.
- **Ein Bereich pro Seite**: Überschrift „Wie sehr trifft jede Aussage auf dich zu?“, darunter die vier Aussagen als weiße Karten mit **fünfstufiger Skala** aus farbigen, gestrichelten Kreisen (Trifft gar nicht zu → Trifft voll zu, Beschriftung nur unter der ersten Karte). Die fünf Kreise sind gleich groß und **Abstufungen der Akzentfarbe** (zart bis voll), keine Rot-Grün-Ampel wie beim Vorbild. Klick füllt den Kreis, die nächste offene Karte wird hervorgehoben und ins Bild gescrollt. „Weiter“ prüft, ob alles beantwortet ist.
- Bewertung 0–4 je Aussage, 16 Punkte je Bereich, 80 gesamt (Level-Schwellen entsprechend verdoppelt)

## Auswertung („Dein Vitalprofil“)

1. **Reveal**: fünf Bereiche leuchten nacheinander auf, Prozentwerte zählen hoch
2. **Typ-Karte als Held**: vollflächiger Farbverlauf in der Bereichsfarbe, Abzeichen, Typname, Beschreibung, drei Merkmal-Chips, Vitallevel und größter Hebel, Buttons „Beratung anfragen“ und „Als Story speichern“. Typen nach stärkstem Bereich: Genießer-Typ, Taktgeber-Typ, Nachtruhe-Typ, Beweger-Typ, Ausgleichs-Typ
2b. **Beratungs-Block direkt darunter** (und kompakt am Ende): Foto/Name/Rolle, „Dein nächster Schritt: Eine persönliche Beratung zu deinem Profil“, personalisierter Satz (Typ, Hebel, Wunsch), Prüfung, ob das Nährstoff-Konzept passt, 30-Tage-Zufriedenheitsgarantie, Button „Persönliche Beratung anfragen“. Zusätzlich eine **Sticky-Leiste** am unteren Rand, sobald kein Beratungs-Block im Bild ist
3. **Dein Tag auf einen Blick**: neun Tagesmomente (07:00 Morgenlicht … 22:30 Sieben Stunden Schlaf) aus konkreten Antworten, Status „läuft / teils / fehlt noch“
4. **Deine fünf Bereiche** mit Prozent, Balken, Feedback und „Gut zu wissen“-Einordnung bei mittleren/niedrigen Werten
5. **Drei Tipps** mit Bezug auf Bereich und niedrigste Antwort
6. CTA in Akzentfarbe: persönliche Beratung, Prüfung, ob das Nährstoff-Konzept passt, „FitLine-Konzept von PM-International … ob und wie es sich in deinen Alltag integrieren lässt“, Motiv-Rückbezug, 30-Tage-Zufriedenheitsgarantie; „Persönliche Beratung anfragen“
7. **Als Story speichern**: Canvas-PNG 1080×1920 (Instagram-/WhatsApp-Story) in der Typ-Farbe mit Abzeichen, Typname, Beschreibung, Level-Pille, fünf Balken, größtem Hebel und „Mach den Check auch: {Domain}“. Wird nach dem Rendern der Auswertung vorab erzeugt; auf dem Handy öffnet der Button das Teilen-Menü (Web Share API mit Datei, direkt in die Geste), am Desktop wird die Datei heruntergeladen

## Formular

Wie Variante A (`_recipient`, Honeypot, Einwilligung), zusätzlich Feld `vitaltyp`; Scores als „12/16“, Antworten als Skalenwörter.

## Schema

Identisch zu `templates/vitalcheck/placeholders-schema.json` (Kopie).

## Hinweis Zufriedenheitsgarantie

PM-International gewährt Kunden laut AGB eine 30-tägige Rückgabegarantie ab Rechnungsdatum (auch geöffnete Packungen, Rücksendekosten trägt der Kunde). Der CTA-Text muss zu den aktuellen PM-Bedingungen passen; bei Änderung anpassen.
