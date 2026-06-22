# Template: FitLine Optimalset (Teampartner)

**Branche:** Direktvertrieb / Nahrungsergänzung (PM-International AG)
**Zielgruppe:** Unabhängige FitLine-Teampartner, die das Optimalset (PowerCocktail, Activize, Restorate + optional Probiotic) bewerben.
**Vorbild:** auk.com (Schriftarten, Farben, Rundungen, Hero-Stil).

## Vorschau

Im Browser oeffnen: `index-preview.html`. Das wird vom Build-Script `python3 build-preview.py` aus `index.html` plus den Defaults im Schema gerendert.

## Bilder (lokal in `assets/`)

Alle 13 Bilder via Higgsfield API generiert (cinematisch, fotorealistisch):

- `hero.png` (16:9): Glas mit angeruehrtem Drink + Lebensmittel drumherum
- `lifestyle-familie.png` / `lifestyle-oma.png` / `lifestyle-sportler.png` / `lifestyle-frau.png` (4:5)
- `food-rotebete.png`, `food-karotte.png`, `food-orange.png`, `food-acerola.png`, `food-heidelbeere.png`, `food-apfel.png`, `food-mandeln.png`, `food-kuerbiskerne.png` (1:1)

Im Schema ist jedes Bild ein Image-Feld mit dem entsprechenden `assets/...` als `default_value`. Der Endkunde kann jedes durch ein eigenes Bild ueberschreiben.

## Schriftarten (lokal in `assets/fonts/`)

- **Arizona Flare** (Headings, Serif): Light, Regular, Medium, Bold, RegularItalic
- **Arizona Sans** (Body, Sans): Light, Regular, Medium, Bold

> **Lizenz-Hinweis:** Beide Schriftarten sind als TRIAL von der ABC Dinamo Foundry geladen worden, weil auk.com sie verwendet. Fuer die Produktion muss der Kunde sie regulär lizenzieren oder durch lizenzfreie Alternativen ersetzen (z. B. Google Fonts: Fraunces fuer Heading, Inter oder DM Sans fuer Body).

## Farbpalette (von auk.com gescraped)

| Token | Wert | Verwendung |
|---|---|---|
| `--bg` | `#FDF9F2` | Cream-Background |
| `--surface-warm` | `#F8F1E4` | Warme Sektion |
| `--primary` | `#338950` | Gruener Akzent (Buttons, Links) |
| `--primary-soft` | `#B2E2C6` | Mintgruene Pills |
| `--primary-deep` | `#226637` | Hover-State, Form-Section |
| `--text` | `#2A2A2A` | Haupttext |
| `--footer-bg` | `#111111` | Footer Hintergrund |

## Sektionen (Reihenfolge)

1. Disclaimer-Bar (sticky top)
2. Navigation (sticky)
3. **Hero** mit grosser Serif-Headline, CTA, dann grosses Hero-Bild (Glas + Lebensmittel)
4. Trust-Strip ("Über 1.000 Spitzensportler")
5. **Routine**: 4 Produkt-Karten (PowerCocktail, Activize, Restorate, Probiotic)
6. **Was steckt drin?** 8 Lebensmittel-Karten mit Bild + Inhaltsstoff-Tags + EU-Health-Claim
7. **Wer das nutzt:** 3 Lifestyle-Karten (Familie, Sportler, ältere Dame)
8. **Was das anders macht:** 4 Punkte (NTC, Kölner Liste, GMP, Made in Germany) als Editorial-Liste
9. Video-Testimonials Wall (6 Hochformat-Platzhalter)
10. Audio-Memos (3 Sprachmemos)
11. Text-Reviews
12. Über mich
13. WOW Multi-Step-Formular
14. FAQ
15. Footer mit Disclaimer-Block

## Drei Stilrichtungen (`stilrichtung`)

- `weiss` (Default): Cream-Background, warm und freundlich, Apple-Style
- `noir`: Dunkel mit mintgruenem Akzent
- `mint`: Sanfter Salbei-Hintergrund

## Form

- Slug: `optimalset-quiz`
- 5 Steps: Fokus (Cards) → Alltag (Cards) → Ernaehrung (Slider 1-5) → Ziel (Textarea) → Kontakt (Name, Email, Telefon, Consent)
- Honeypot `_honeypot`
- AJAX mit `Accept: application/json`
- Daten als Strings: `fokus`, `alltag`, `ernaehrung_score`, `ziel_text`, `vorname`, `email`, `telefon`

## Compliance

- Keine Heil- oder Wirkaussagen. Nur EU-zugelassene Health-Claims (VO (EU) 432/2012) wortwoertlich.
- Keine FitLine- oder PM-International-Logos. Keine Verpackungen. Lebensmittel- und Lifestyle-Bilder ohne Marken.
- Disclaimer doppelt: Sticky Top-Bar plus voller Block im Footer.
- Markennennung im Text klar als unabhängiger Vertriebspartner.

## Status

Komplett uebearbeitet im auk.com-Stil mit Higgsfield-generierten Bildern.
