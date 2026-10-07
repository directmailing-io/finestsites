# Template: Der Vitalcheck (Variante B, Profil-Layout)

Lead-Check für PM-International-Teampartner. Gleiche 20 Verhaltens-Aussagen und gleiche Rechtsleitplanken wie `templates/vitalcheck/` (siehe `docs/konzept-vitalcheck.html`), aber als **Profilseite mit eingebettetem Check**, aufgebaut wie die Linkseite (`templates/lnko-bio/`).

Stand 07.10.2026: Startseiten-Layouts (Split/Bühne/Teaser), Hero-Foto und Kopfleiste mit Marke sind weg. Die Seite ist einspaltig (600 px), oben das Profil, direkt darunter der Check.

## Aufbau

1. **Profil** (wie lnko): Profilbild 112 px mit Akzent-Ring, Name, Rolle („Unabhängige/r Vertriebspartner/in der PM-International“, aus `geschlecht`), Social-Icons (Instagram, TikTok, Facebook, YouTube, LinkedIn, WhatsApp, E-Mail; nur gesetzte), kurzer Text. Ist `intro` leer, greift ein eingebauter lockerer Standardtext in DE und EN. Darunter die Zeile „Der Vitalcheck · 3 Minuten · kostenlos“.
2. **Check**, beginnt sofort mit dem Wunsch-Schritt („Schritt 1 von 8“). Ab dem ersten Weiter verschwindet das Profil, oben erscheint die sticky Fortschritts-Pille, über dem Schritt die Zeile „Vitalcheck von {Vorname} · Zum Profil“. Ablauf, Skala, Reveal, Formular wie bisher (siehe unten).
3. **Auswertung**:
   - Typ-Karte im Farbverlauf: Abzeichen, Typname, Beschreibung, Merkmal-Chips, Vitallevel + größter Hebel, **fünf Bereichs-Ringe mit Prozent**, Buttons **Teilen** und **Als Story speichern**, Signatur „Vitalcheck von {Name}“ mit Profilbild. Die Karte ist so gebaut, dass ein Screenshot für sich steht.
   - Teilen: Web Share API mit Story-PNG + Text + URL (Handy); ohne Share-API wird der Link kopiert (Toast). Story-PNG 1080×1920 wie bisher (Canvas, ohne Profilbild, damit das Canvas nicht durch Cross-Origin „tainted“ wird).
   - Beratungs-Block, Tag auf einen Blick, fünf Bereiche, drei Tipps, Wunsch-Rückbezug, kompakter Beratungs-Block, Sticky-Leiste: unverändert.
   - **Meine Seiten** (`links`, optional): nach dem zweiten Beratungs-Block, über den Werkzeug-Buttons. Kopfzeile mit Profilbild, „Meine Seiten · Mehr von {Vorname}, unabhängig von deinem Ergebnis“, Link-Buttons im Linkseiten-Stil, darunter der feste Satz „Diese Links gehören zu meinem Profil. Sie sind keine Empfehlung aus deinem Vitalprofil und haben mit deinem Ergebnis nichts zu tun.“ Für alle Besucher gleich, unabhängig vom Ergebnis.

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
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme mint --intro --nolinks
```
Dateien landen in `preview-lokal/` (gitignored). `assets/hero.jpg` wird nicht mehr genutzt und kann beim Rollout entfallen; `assets/fs-logo.svg` bleibt.

## Hinweis Zufriedenheitsgarantie

PM-International gewährt Kunden laut AGB eine 30-tägige Rückgabegarantie ab Rechnungsdatum (auch geöffnete Packungen, Rücksendekosten trägt der Kunde). Der CTA-Text muss zu den aktuellen PM-Bedingungen passen; bei Änderung anpassen.
