# Template: Der Vitalcheck – Variante B („Profil“)

Zweite, eigenständige Variante des Vitalchecks (gleiche 20 Verhaltens-Aussagen, gleiche Rechtsleitplanken wie `templates/vitalcheck/`, siehe dort und `docs/konzept-vitalcheck.html`), aber mit anderem UI und anderem Auswertungskonzept. Orientiert an Persönlichkeitsanalysen wie mindprofile.co.

## UI

- Warmes Off-White, kleine Marke (Avatar + Name) links oben, schlanke Fortschritts-Pille „Vitalcheck · 35 % abgeschlossen“ mit Ring, Flaggen rechts
- **Seite 1 als Landingpage**: Hero mit Headline, Einleitung, drei „Das bekommst du“-Punkten und Button; rechts eine Beispiel-Profilkarte (Typ-Abzeichen, fünf animierte Balken, Level). Darunter „1 · Los geht's mit dir“ mit der Wunsch-Karte, also der Check direkt eingebettet
- **Ein Bereich pro Seite**: Überschrift „Wie sehr trifft jede Aussage auf dich zu?“, darunter die vier Aussagen als weiße Karten mit **fünfstufiger Skala** aus farbigen, gestrichelten Kreisen (Trifft gar nicht zu → Trifft voll zu, Beschriftung nur unter der ersten Karte). Die fünf Kreise sind **Abstufungen der Akzentfarbe** (zart bis voll) und werden nach rechts größer, keine Rot-Grün-Ampel wie beim Vorbild. Klick füllt den Kreis, die nächste offene Karte wird hervorgehoben und ins Bild gescrollt. „Weiter“ prüft, ob alles beantwortet ist.
- Bewertung 0–4 je Aussage, 16 Punkte je Bereich, 80 gesamt (Level-Schwellen entsprechend verdoppelt)

## Auswertung („Dein Vitalprofil“)

1. **Reveal**: fünf Bereiche leuchten nacheinander auf, Prozentwerte zählen hoch
2. **Vital-Typ** nach stärkstem Bereich mit Abzeichen in Bereichsfarbe: Genießer-Typ, Taktgeber-Typ, Nachtruhe-Typ, Beweger-Typ, Ausgleichs-Typ, plus Vitallevel und Prozent
3. **Dein Tag auf einen Blick**: neun Tagesmomente (07:00 Morgenlicht … 22:30 Sieben Stunden Schlaf) aus konkreten Antworten, Status „läuft / teils / fehlt noch“
4. **Deine fünf Bereiche** mit Prozent, Balken, Feedback und „Gut zu wissen“-Einordnung bei mittleren/niedrigen Werten
5. **Drei Tipps** mit Bezug auf Bereich und niedrigste Antwort
6. CTA in Akzentfarbe: persönliche Beratung, Prüfung, ob das Nährstoff-Konzept passt, 30-Tage-Zufriedenheitsgarantie; „Profil senden und Beratung anfragen“
7. **Profil als Bild speichern** (Canvas-PNG 1080×1350 mit Typ, Level, fünf Balken) zum Teilen

## Formular

Wie Variante A (`_recipient`, Honeypot, Einwilligung), zusätzlich Feld `vitaltyp`; Scores als „12/16“, Antworten als Skalenwörter.

## Schema

Identisch zu `templates/vitalcheck/placeholders-schema.json` (Kopie).

## Hinweis Zufriedenheitsgarantie

PM-International gewährt Kunden laut AGB eine 30-tägige Rückgabegarantie ab Rechnungsdatum (auch geöffnete Packungen, Rücksendekosten trägt der Kunde). Der CTA-Text muss zu den aktuellen PM-Bedingungen passen; bei Änderung anpassen.
