# Template: Beauty – „Schönheit von innen & außen“ (pm-beauty)

**Domain:** beautylove.net (Zone in Cloudflare vorhanden, DNS-Wildcard + Worker-Route noch NICHT angelegt – erst vor der ersten Veröffentlichung)
**Template-ID:** `ca8225e7-4299-4d1e-85ab-d8343c30c548` (alte Zeile „Beauty-Line“ wiederverwendet)
**Status:** `is_test = true`, Zugriff nur über `template_access` (aktuell: demo). Demo-Seite `36e1cd81-e49e-49c3-8560-9b64d52740f0` (Entwurf, nicht veröffentlicht).
**Zielgruppe:** Interessentinnen, die Produkte und Konzept nicht kennen (Story gesehen, angesprochen worden). Ziel der Seite: Beauty-Check (Termin) buchen, alternativ selbst im Hersteller-Shop bestellen.

## Bauen

```
python3 templates/pm-beauty/build.py          # src/*.html + _reuse.css + _cookie.html → index.html
npx tsx scripts/render-template-preview.ts pm-beauty [--theme sand|salbei|pflaume] [--set scanner_anzeigen=aus]
```

- `src/01-head.html … 11-footer.html`: die eigentliche Quelle (DE/EN Dual-DOM mit `.l-de`/`.l-en`).
- `_reuse.css`: Leiste, Kontakt-Fenster (C1), Buttons, PM-Hinweis, FAQ, Über mich, Kontakt-Karte/Formular, Fußzeile – 1:1 aus `pm-cellrestart/index.html` übernommen (gleiche Variablennamen, `--green` = Primärfarbe).
- `_cookie.html`: DSGVO-Cookie-Block wie in den anderen Templates.
- `preview-lokal/assets` ist ein Symlink auf `../assets`, damit die lokale Vorschau Bilder zeigt.

## Sektionen

Hero (4 KI-Bilder, `hero_variante`, Fraunces-Headline, kein Pill) → PM-Hinweis → Innen & außen (Bild-Bogen „key.webp“ zwischen zwei Typo-Spalten) → Routine (zwei Listen Morgens/Abends + zwei Stillleben) → Beauty-Check (Scan-Ergebnis-Bild bei `scanner_anzeigen=an`, sonst Selfie-Bild) → Drei Gründe (typografische Zeilen) → Produkte (ruhige Liste in Gruppen, ohne Preise/Shop-Knöpfe; Fenster mit Hersteller-Text, Preis + Shop-Link) → Über mich → FAQ (5) → Kontakt (einstufiges Formular: Name, E-Mail, Telefon/WhatsApp, Vor Ort/Video/Telefon, Nachricht) → Footer.

**Runde 6 (29.10.2026, 10:30, Daniel sehr unzufrieden mit Runde 5):** Überschriften Instrument Serif (groß, dunkel; abgelehnt waren Fraunces, Geist, Jost light), Fließtext DM Sans. **Nur Deutsch**: `build.py` entfernt alle `.l-en`-Spans und blendet den Sprachschalter aus (Quellen behalten EN für später). Innen/außen jetzt Vollbreite (`100vw`), große Serif-Worte + Tags, Freisteller davor, darunter drei Farbkarten (Außen apricot / Innen beere / Zusammen dunkel). Ring passgenau ums Gesicht (cx 52 / cy 78 / rx 34 / ry 43, geprüft per Element-Screenshot). Check-Text kurz. Produkte: Überschrift über dem Vollbild, Kacheln mit **Zweck zuerst** („Reinigen“, „Für mehr Glow“ …), Produktname klein, Zeitpunkt als Chip. CTA mit Handy-Mockup der Ergebnis-Ansicht (Analyse/Produkte, 84 %, Hautalter, Hautdetails-Kacheln mit Gut/Okay/Niedrig, neutral ohne Marken). USP-Bento mit vorhandenen Bildern (innen, aussen, routine-morgen), 1993-Zahlkarte, Garantie. Reihenfolge: … Über mich → **Empfohlene Routine** → Antworten auf häufige Fragen → Kontakt. Abstand Überschrift→Karten repariert (Reuse-`.wrap{margin:0 auto}` hatte `.s-head` überschrieben → jetzt `section .s-head` nach dem Reuse-Block). Keine neuen API-Bilder mehr (Daniels Vorgabe).

**Runde 5 (29.10.2026, 09:50):** Headline wieder Motto „Schönheit von innen & außen“, Sub = Angebot in drei Sätzen, sekundärer CTA „Zu den Produkten“, Fakten-Zeile mit echten USPs (Patentierte Technologie NTC®, Hersteller seit 1993, 30 Tage Geld-zurück; „Made in Germany“ bewusst NICHT, für Kosmetik nicht belegt). Leiste nur noch Beauty-Check / Produkte / Über mich + Kontakt + Sprache + CTA. „Kennst du das“ gestrichen. Innen & außen = Farbsplit (links Außen apricot, rechts Innen beere, Variablen `--aussen/--innen`) mit Freisteller `cutout.webp` (gpt-image-2 auf Weiß, Hintergrund lokal mit rembg/isnet entfernt; transparente Ausgabe unterstützt das Modell nicht). Skinscan-Ring: cx 50 / cy 75 / rx 38 / ry 48, 60 Striche. Produkte: Vollbild `lineup.webp` (gpt-image-2-Edit aus unseren Produktbildern) mit Verlauf, dann Kacheln Basis (5, nummeriert) / Extras / Sets, Beratungs-CTA „Du brauchst nicht alles. Ich berate dich.“ mit neutraler Ergebnis-UI (CSS, Beispielwerte). USP-Bento 2+1 / 1+1+1 / 3, „der Hersteller“ statt PM/FitLine im Fließtext. Reihenfolge: Hero → Innen&außen → Beauty-Check → Produkte → USPs → Über mich → Meine Routine → Fragen → „Beauty-Check mit {{vorname}} sichern“ (Kontaktweg WhatsApp/Anruf/E-Mail, kein Vor-Ort, kein Newsletter-Satz). Feld `region` entfernt (Schema + DB).

**Runde 4 (28.10.2026, 21:00, Lesefluss für Einsteiger):** Reihenfolge Hero („Du wünschst dir bessere Haut?“) → „Kennst du das?“ (drei Alltagssätze, keine Beschwerden) → Innen & außen → Skinscan (Bild ohne Ring, Ring aus 64 SVG-Strichen mit wanderndem Leuchten, `#scanRing`) → Routine → Produkte (Zeilen mit Wann/Hauttyp, Fenster mit Wann/Hauttyp/Inhaltsstoff-Auswahl aus den Dossiers) → Vorteile (Bento 2+1 / 1+1+1 / 3) → Über mich → FAQ → Kontakt. Schrift Jost (Überschriften, light) + DM Sans (Text). Quelldateien umbenannt (05-check, 07-routine, 09-vorteile, 10-ueber-faq, 11-kontakt, 12-footer).

**Runde 3 (28.10.2026, 20:30):** Schrift Geist statt Fraunces, Squircle (`corner-shape: squircle` + große Radien), Innen & außen als breites Visual mit den Wörtern im Bild, Skinscan-Sektion mit Gesichts-Mesh-Bild (gpt-image-2 Edit nach Daniels Referenz-Screenshot), Vorteile als Bento wie Dailyoptimal (NTC®, Hauttypen, Wirkstoffe, Von innen, Hersteller seit 1993, 30-Tage-Garantie), Produkte „Was zur Auswahl steht“ + CTA-Karte „Du weißt nicht, was du nehmen sollst?“, Formular dreistufig (Anliegen → Wünsche → Kontakt) wie Dailyoptimal.

**Design-Feedback Daniel 28.10.2026 (Runde 2, eingearbeitet):** nicht wie cellRESET aussehen, keine Tagline mit Punkt, Innen/außen-Visual nicht langweilig, echtes Scan-Bild, Vorteile kürzer und überzeugender, insgesamt viel weniger Text, Formular nicht aus cellRESET, kein „AI generated“-Badge, Produkte ohne Shop-Gefühl.

**Runde 7 (29.10.2026, 10:50, Daniel: „Scheiß Font, Scheiß Stil, alles neu aufsetzen“):** Kompletter Neuaufbau nach seinem neuen Standard – die Framer-Seiten **dermato-wbs**, **aurevana** und **yogagrove** (Screenshots in `scratchpad/ref/`). Schriften jetzt **Hedvig Letters Serif** (Überschriften, wie dermato) + **Figtree** (Fließtext). Cremefarbene Palette (Standardthema `sand` #FDF7EF mit Braun; weiter rose/salbei/pflaume/eigene). Bausteine wie in den Referenzen: Eyebrow-Pills mit Punkt („• Beauty-Check · kostenlos“), Pill-Buttons, Hero als **eingerückte Bildkarte** (abgerundet, Text links im freien Bereich), Intro-Statement in großer Serif, Innen/außen als abgerundete Bildkarte mit **neuem Bild `assets/duo.webp`** (einziges neues API-Bild, von Daniel erlaubt: Frau mit Handtuch-Turban und Beerenglas, links frei für die Worte „Außen / Innen“) + drei Karten (Außen-Foto / Innen-Foto / Zusammen dunkel). Beauty-Check Bild links / Text rechts mit 3 Schritt-Zeilen (dermato-Treatment-Stil). Produkte als **Zeilen** (Thumb · Zweck in Serif · Produktname · Hauttyp/Zeitpunkt · „+“), Extras/Sets als Bildkarten mit Beschriftung unter dem Bild (Overlay war auf hellen Produktfotos unlesbar). Dunkle CTA-Karte mit Handy-Mockup bleibt. Bento, Über mich (Bild links, Text rechts, Pills), Routine, FAQ, 3-Schritt-Formular neu gestylt. Handy: Hero-Text unter dem Bild (nichts über dem Gesicht), Innen/Außen-Worte unter dem Bild. Alle Abschnitte per Playwright geprüft (Desktop 1440 + Handy 390, Ring, Produktfenster). `lineup.webp`, `cutout.webp`, `key*.webp` werden nicht mehr verwendet.

## Shop-Links

Direkt im Template: `https://www.fitline.com/de/de-de/products/{Artikelnr}?sponsor={{team_partner_number}}` (JS `fsShopUrl`). Keine `shop_*`-Felder im Schema.

## Bilder

- `assets/hero/*.webp`, `assets/key|innen|aussen|routine-morgen|routine-abend|scan-result|scan-selfie.webp`: mit OpenAI `gpt-image-2` erzeugt (28.10.2026, zweite Serie „Beauty-Kampagne, editorial“), ohne Marken/Verpackungen. `scan-result` per Edits-Endpoint mit zwei Standbildern des PM-Tutorials als Referenz (Skript war `scratchpad/img/gen2.py`). Kein KI-Badge im Bild (Daniels Wunsch).
- `assets/produkte/*.webp` (14 Stück, 600×600): mit `gpt-image-2` Edits-Endpoint aus den offiziellen Shop-Fotos erzeugt (Form/Farbe/Material wie das Original, ALLE Texte und Logos entfernt, auf Cremestein). Daniels Vorgabe 28.10.2026: „1:1 wie die echten Produkte, aber ohne Logo“. Hinweis: Verpackungsdesigns sind laut PM-Richtlinie geschützt; die Bilder zeigen nur die Form ohne Etikett. Fehlt ein Bild, zeigt die Zeile ein Symbol (`onerror` → `.noimg`).
- Editor-Vorschauen: `public/templates/pm-beauty/hero-previews/*.webp`, `section-previews/section-scanner|men.webp`, Galerie `public/previews/beauty.jpg`.

## Compliance (PM-Richtlinien + HCVO/Kosmetik-VO)

- „Selbstständige/r Vertriebspartner/in“ oben (PM-Hinweis) und im Footer; keine PM-Logos, keine Produktfotos mit Logo, keine Rabatte, kein eigener Warenkorb, Verkauf nur über den PM-Shop.
- Produkttexte nur im Wortlaut des Herstellers (fitline.com DE, Okt. 2026), Health Claims je Nährstoff einzeln (Vitamin C / Biotin / Zink), Pflichthinweise beim Drink und im Footer.
- Keine Hautbeschwerden/Krankheiten, keine Wirkversprechen, AI Scanner nur als „kosmetische Einschätzung, keine medizinische Untersuchung“.
- Grundlage: `docs/beauty/02-rechtsrahmen-und-formulierungen.md`, PM-Richtlinien in `docs/beauty/quellen/pm-richtlinien/`.

## Vor der Veröffentlichung (offen)

1. Cloudflare: Wildcard-A `*.beautylove.net → 192.0.2.1` (proxied), Route in `cloudflare-worker/wrangler.toml` mit Zone `4ccbbf9be3ce31ee976223007f72d228`, Worker-Deploy vom App-Server, Health-Check.
2. App-Deploy (für `public/`-Vorschaubilder), nur im Zeitfenster 06:00/23:00.
3. Produktbilder von Daniel nach `assets/produkte/` + R2-Upload.
4. Sperrliste `src/lib/compliance/check.ts` um Beauty-Begriffe erweitern (Vorschlag in der Rechtsdatei).
5. Freigabe durch Daniel, dann `is_test=false` bzw. weitere `template_access`-Zeilen.
