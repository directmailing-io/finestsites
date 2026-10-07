# Template: Der Vitalcheck (Variante B, Profil-Layout)

Lead-Check für PM-International-Teampartner. Gleiche 20 Verhaltens-Aussagen und gleiche Rechtsleitplanken wie `templates/vitalcheck/` (siehe `docs/konzept-vitalcheck.html`), aber als **Profilseite mit eingebettetem Check**, aufgebaut wie die Linkseite (`templates/lnko-bio/`).

Stand 07.10.2026 (zweite Runde nach User-Feedback): Startseiten-Layouts, Hero-Foto, Kopfleiste, Fortschritts-Pille, „Zum Profil“-Zeile und Sticky-Leiste sind weg. Oben das Profil, direkt darunter der Check in einer Karte, die Auswertung als Kartenfolge.

## Aufbau

Alles einspaltig (600 px), ruhig, jede Einheit eine weiße Karte mit Rundung. Kein Ansichtswechsel: Das Profil bleibt immer oben stehen, der Check läuft darunter in einer Karte.

1. **Profil** (wie lnko): Profilbild 112 px mit Akzent-Ring, Name, Rolle („Unabhängige/r Vertriebspartner/in der PM-International“, aus `geschlecht`), Social-Icons (Instagram, TikTok, Facebook, YouTube, LinkedIn, WhatsApp, E-Mail; nur gesetzte), kurzer Text. Ist `intro` leer, greift ein eingebauter lockerer Standardtext in DE und EN. Rechts oben nur der Sprachschalter (nicht sticky).
2. **Check-Karte** (`.panel`): oben „Schritt n von 8“ mit dünnem Fortschrittsbalken, darunter der Schritt (Wünsche → fünf Bereiche → Motive → Budget → Reveal), unten „Weiter“ in voller Breite und „Zurück“ als Textlink. Die vier Aussagen eines Bereichs liegen als ruhige Abschnitte in der Karte (aktive Aussage leicht getönt), keine Karte in der Karte. Bei jedem Schritt scrollt die Seite an den Kartenanfang.
3. **Auswertung**, eine Folge gleich gebauter Karten:
   - Typ-Karte im Farbverlauf: Abzeichen, Typname, Beschreibung, Merkmal-Chips, Kacheln „Vitallevel“ und „Größter Hebel“, **fünf Bereichs-Ringe mit Prozent**, Buttons **Teilen** und **Als Story speichern**, Signatur „Vitalcheck von {Name}“ mit Profilbild. Ein Screenshot der Karte steht für sich.
   - Beratungs-Karte (einmal): Profilbild/Name/Rolle, „Lass uns über dein Profil sprechen.“, personalisierter Satz, Motiv-Satz, Konzept-Absatz (geprüfter Wortlaut), Garantie-Zeile, Button, Fineprint.
   - Karten „Dein Tag auf einen Blick“, „Deine fünf Bereiche“, „Drei Dinge, die du morgen starten kannst“ (mit Wunsch-Rückbezug in der Karte); Überschriften jeweils in der Karte.
   - **Meine Seiten** (`links`, optional) als eigene Karte: Profilbild, „Meine Seiten · Mehr von {Vorname}, unabhängig von deinem Ergebnis“, Link-Buttons, fester Hinweissatz „Diese Links gehören zu meinem Profil. Sie sind keine Empfehlung aus deinem Vitalprofil und haben mit deinem Ergebnis nichts zu tun.“
   - Werkzeug-Karte: „Persönliche Beratung anfragen“ (Akzent, volle Breite), „Profil als Story speichern“, „Nochmal starten“. Keine Sticky-Leiste mehr.
   - Teilen: Web Share API mit Story-PNG + Text + URL (Handy); ohne Share-API wird der Link kopiert (Toast). Story-PNG 1080×1920 wie bisher (Canvas, ohne Profilbild, damit das Canvas nicht durch Cross-Origin „tainted“ wird).
4. **Formular** und **Danke** als eigene Karten, darunter „Zurück zum Profil“.
5. **Footer** als graue Karte mit drei kurzen Zeilen mit Icon (Daten bleiben bei dir · Selbsteinschätzung, keine Diagnose · Betreiber/PM-Kennzeichnung), dann E-Mail, WhatsApp, Impressum, Datenschutz, Copyright.

## Rechtlicher Rahmen der Seiten-Links (Entscheidung 07.10.2026)

Problem: Ein Link aus einer Gewohnheits-Auswertung auf eine Produktseite (z. B. Optimalset) kann im Gesamteindruck als „das Produkt hilft bei den geprüften Bereichen“ gelesen werden → implizite gesundheitsbezogene Angabe (HCVO Art. 10, Gesamteindruck beim Durchschnittsverbraucher), Irreführung (UWG § 5), Linkhaftung für verlinkte Inhalte.

Lösung im Template:
- Die Auswertung selbst nennt nie ein Produkt; Typ, Bereiche, Tipps und Story-Bild sind produktfrei.
- Links sind ein **Profil-Element**, kein Ergebnis-Element: eigener Block mit Profilbild und „Meine Seiten“, Linkseiten-Optik (keine Akzentfarbe, keine Ergebnis-Bezüge), fester Hinweissatz, erst nach dem Beratungs-Block.
- Keine Logik, die Links nach Score/Typ ein- oder ausblendet. Keine Beschriftungen wie „passend zu deinem Ergebnis“ (Editor-Hinweis im Schema).
- Nur **veröffentlichte Seiten aus dem eigenen FinestSites-Konto** wählbar (`site_picker_only`), keine freien URLs. Damit zeigt jeder Link auf ein Template mit eigenem Rechts-Audit, nicht auf fremde Inhalte.
- Kommerzielle Absicht ist erkennbar: Rolle „Unabhängige/r Vertriebspartner/in der PM-International“ direkt unter dem Namen, Pflichtkennzeichnung im Footer.
- Restrisiko: niedrig bis mittel (Gesamteindruck bleibt Auslegungssache). Das größte Risiko liegt weiterhin im Beratungsgespräch, nicht auf der Seite.

## Check (unverändert)

- Wünsche (max. 3) → fünf Bereiche à vier Aussagen, fünfstufige Skala (Abstufungen der Akzentfarbe) → Motive (abschaltbar) → Tagesbudget (abschaltbar) → Reveal → Auswertung → Formular → Danke.
- Bewertung 0–4 je Aussage, 16 je Bereich, 80 gesamt. Typ nach stärkstem Bereich (Genießer, Taktgeber, Nachtruhe, Beweger, Ausgleich), Aufbruch-Typ unter 8 Punkten im besten Bereich.
- Formular: `/.finestsites/forms/kontakt`, `_recipient`, Honeypot, Einwilligung (Art. 9 DSGVO), alle Werte als Strings, zusätzlich `vitaltyp`.
- DE/EN per Flaggen, Fortschritt in `sessionStorage` (`vcb_state_v1`).

## Schema (`placeholders-schema.json`, Version 2)

Profil: `vorname`, `nachname`, `profilbild`, `geschlecht`, `intro` (textarea, 320 Zeichen, leer = Standardtext). Social Media: `instagram`, `tiktok`, `facebook`, `youtube`, `linkedin` (URL oder Benutzername, Engine normalisiert), `whatsapp_nummer`. Kontakt: `email_benachrichtigung`. Meine Seiten: `links` (loop, max 6, `titel` + `url` mit `site_picker` + `site_picker_only`). Design: `farbthema` (6). Check anpassen: `frage_motive`, `frage_investition`. Entfernt: `startseite`.

## Lokale Vorschau

```
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme mint            # Startseite
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme mint --result   # Auswertung (Antworten vorbefüllt)
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme mint --result --step area:1   # ein Bereichs-Schritt
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme mint --result --step lead     # das Formular
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme mint --intro --nolinks
```
Dateien landen in `preview-lokal/` (gitignored). `assets/hero.jpg` wird nicht mehr genutzt und kann beim Rollout entfallen; `assets/fs-logo.svg` bleibt.

## Hinweis Zufriedenheitsgarantie

PM-International gewährt Kunden laut AGB eine 30-tägige Rückgabegarantie ab Rechnungsdatum (auch geöffnete Packungen, Rücksendekosten trägt der Kunde). Der CTA-Text muss zu den aktuellen PM-Bedingungen passen; bei Änderung anpassen.
