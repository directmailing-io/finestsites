# Template: Der Vitalcheck (Variante B, Profil-Layout)

Lead-Check für PM-International-Teampartner. Gleiche 20 Verhaltens-Aussagen und gleiche Rechtsleitplanken wie `templates/vitalcheck/` (siehe `docs/konzept-vitalcheck.html`), aber als **Profilseite mit eingebettetem Check**, aufgebaut wie die Linkseite (`templates/lnko-bio/`).

Stand 07.10.2026 (zweite Runde nach User-Feedback): Startseiten-Layouts, Hero-Foto, Kopfleiste, Fortschritts-Pille, „Zum Profil“-Zeile und Sticky-Leiste sind weg. Oben das Profil, direkt darunter der Check in einer Karte, die Auswertung als Kartenfolge.

## Aufbau

Alles einspaltig (600 px), ruhig, jede Einheit eine weiße Karte mit Rundung. Kein Ansichtswechsel: Das Profil bleibt immer oben stehen, der Check läuft darunter in einer Karte.

1. **Profil** (wie lnko): Profilbild 112 px mit weißem Ring und farbigem Schatten, Name, kurzer Text, Social-Icons (Instagram, TikTok, Facebook, YouTube, LinkedIn, WhatsApp, E-Mail; nur gesetzte). Keine Rollenzeile unter dem Namen; die PM-Kennzeichnung steht im Footer und in der Beratungs-Karte. **Duo-Modus** (`partner_modus=duo`): zwei Fotos leicht überlappend, gemeinsamer Name („Daniel & Anna Kurzeja“ bei gleichem Nachnamen, sonst „Daniel Kurzeja & Anna Müller“, berechnet in JS), ein gemeinsamer Text (Standardtext auf „wir“), darunter zwei Kontaktspalten mit Vorname und je eigener Icon-Zeile (Felder `*2`, nur im Duo sichtbar via `show_when`). Duo zieht sich durch: Typ-Karten-Signatur und Beratungs-Karte mit beiden Fotos, „Wir arbeiten mit dem FitLine-Konzept“, Formular „Deine Beratung mit Daniel & Anna“, Einwilligung mit beiden Namen, Danke-Seite „melden sich“ mit zwei WhatsApp-Buttons, Footer mit beiden Fotos und Plural-Kennzeichnung. Die Check-Ergebnisse gehen immer an die eine Adresse unter „Kontakt“. Ist `intro` leer, greift ein eingebauter lockerer Standardtext in DE und EN. Rechts oben nur der Sprachschalter (nicht sticky).
2. **Check-Karte** (`.panel`): oben „Schritt n von 8“ mit dünnem Fortschrittsbalken, darunter der Schritt (Wünsche → fünf Bereiche → Motive → Budget → Reveal), unten „Weiter“ in voller Breite und „Zurück“ als Textlink. Die vier Aussagen eines Bereichs liegen als ruhige Abschnitte in der Karte (aktive Aussage leicht getönt), keine Karte in der Karte. Bei jedem Schritt scrollt die Seite an den Kartenanfang.
3. **Auswertung**, eine Folge gleich gebauter Karten:
   - Typ-Karte im Farbverlauf: Abzeichen, Typname, Beschreibung, Merkmal-Chips, Kacheln „Vitallevel“ und „Größter Hebel“, **fünf Bereichs-Ringe mit Prozent**, Buttons **Teilen** und **Als Story speichern**, Signatur „Vitalcheck von {Name}“ mit Profilbild. Ein Screenshot der Karte steht für sich.
   - Beratungs-Karte (einmal): Profilbild/Name/Rolle, „Lass uns über dein Profil sprechen.“, personalisierter Satz, Motiv-Satz, Konzept-Absatz (geprüfter Wortlaut), Garantie-Zeile, Button, Fineprint.
   - Karten „Dein Tag auf einen Blick“, „Deine fünf Bereiche“, „Drei Dinge, die du morgen starten kannst“ (mit Wunsch-Rückbezug in der Karte); Überschriften jeweils in der Karte.
   - **Meine Seiten** (`links`, optional) als eigene Karte: Profilbild, „Meine Seiten · Mehr von {Vorname}, unabhängig von deinem Ergebnis“, Link-Buttons, fester Hinweissatz „Diese Links gehören zu meinem Profil. Sie sind keine Empfehlung aus deinem Vitalprofil und haben mit deinem Ergebnis nichts zu tun.“
   - Werkzeug-Karte: „Persönliche Beratung anfragen“ (Akzent, volle Breite), „Profil als Story speichern“, „Nochmal starten“. Keine Sticky-Leiste mehr.
   - Teilen: Web Share API mit Story-PNG + Text + URL (Handy); ohne Share-API wird der Link kopiert (Toast). Story-PNG 1080×1920 (Canvas, ohne Profilbild, damit das Canvas nicht durch Cross-Origin „tainted“ wird); unten die Zeile „Mach deinen eigenen Check auf {host}“ mit der Seitenadresse ohne Protokoll (lokal/ohne Host: „Vitalcheck von {Name}“).
4. **Formular** und **Danke** als eigene Karten, darunter „Zurück zum Profil“.
5. **Footer** als dunkler Streifen über die volle Breite (wie bei den anderen Templates): Profilbild + Name + PM-Kennzeichnung, zwei Icon-Zeilen (Daten bleiben bei dir · Selbsteinschätzung, keine Diagnose), unten links Copyright · Impressum · Datenschutz, rechts „Made with ♥ von FinestSites“ mit Logo (E-Mail und WhatsApp stehen nur im Profil) (`assets/fs-logo.svg`, invertiert).

## Kein Freitext in der Auswertung (Entscheidung 07.10.2026)

Nutzer können sich nur im Profil vorstellen (`intro`, 320 Zeichen, Hinweis „keine Produkt- oder Wirkaussagen“). In der Auswertung gibt es bewusst **kein** eigenes Textfeld und keinen Erfahrungsbericht. Grund: Ein persönlicher FitLine-Erfahrungsbericht neben dem Gewohnheits-Ergebnis ist im Gesamteindruck eine gesundheitsbezogene Angabe zu einem Lebensmittel (HCVO Art. 10; Testimonials sind keine zugelassenen Claims, Art. 12 lit. c verbietet den Verweis auf Empfehlungen Einzelner bei Gesundheitsbezug), dazu UWG § 5 und die PM-Partnerrichtlinien. Eine KI-Prüfung senkt das Risiko nicht genug: Verbotene Wirkung entsteht aus Kontext und Andeutung („seitdem schlafe ich besser“), nicht aus einzelnen Wörtern, und eine „geprüfte“ Freigabe würde FinestSites in die Mitverantwortung ziehen. Der Erfahrungsbericht gehört ins persönliche Gespräch.

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

Profil: `partner_modus` (solo/duo), `vorname`, `nachname`, `profilbild`, `geschlecht`, `intro` (textarea, 320 Zeichen, leer = Standardtext), im Duo zusätzlich `vorname2`, `nachname2`, `profilbild2` (alle mit `show_when` auf duo, `color_tag` person1/person2 wie bei cellRESET). Social Media: `instagram`, `tiktok`, `facebook`, `youtube`, `linkedin` (URL oder Benutzername, Engine normalisiert), `whatsapp_nummer`; im Duo dieselben als `*2` plus `email2` (nur für das Icon). Kontakt: `email_benachrichtigung`. Meine Seiten: `links` (loop, max 6, `titel` + `url` mit `site_picker` + `site_picker_only`). Design: `farbthema` mit sechs Themen `gruen` (Standard), `orange`, `rot`, `blau`, `violett`, `nacht` (dunkel). Jedes Thema setzt Akzent, Akzent-Soft und einen **Hintergrund-Verlauf** (`--wash-a/-b/-c`): zwei weiche Lichtflecken links oben und rechts plus ein vertikaler Verlauf, der nach 760 px in die ruhige Seitenfarbe ausläuft (`background-size` begrenzt, kein Blob, keine harte Kante). Der Check und die Auswertung stehen damit immer auf neutralem Grund, die Farbe sitzt hinter dem Profil. Check anpassen: `frage_motive`, `frage_investition`. Entfernt: `startseite`.

## Lokale Vorschau

```
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme gruen            # Startseite
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme gruen --result   # Auswertung (Antworten vorbefüllt)
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme gruen --result --step area:1   # ein Bereichs-Schritt
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme gruen --result --step lead     # das Formular
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme blau --duo [--result] [--step done]  # Duo-Modus
npx tsx scripts/render-template-preview.ts vitalcheck-b --theme gruen --intro --nolinks
```
Dateien landen in `preview-lokal/` (gitignored). `assets/hero.jpg` wird nicht mehr genutzt und kann beim Rollout entfallen; `assets/fs-logo.svg` bleibt.

## Hinweis Zufriedenheitsgarantie

PM-International gewährt Kunden laut AGB eine 30-tägige Rückgabegarantie ab Rechnungsdatum (auch geöffnete Packungen, Rücksendekosten trägt der Kunde). Der CTA-Text muss zu den aktuellen PM-Bedingungen passen; bei Änderung anpassen.
