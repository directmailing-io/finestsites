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

Hero (4 KI-Bilder, `hero_variante`) → PM-Hinweis → Innen & außen → Routine (Morgens/Abends) → Beauty-Check (+ optional AI Scanner, `scanner_anzeigen`) → 6 Gründe → Produkte (Basis / Ergänzungen / Sets, Fenster mit Hersteller-Texten) → Über mich → FAQ → Kontakt (Wünsche → Formular `kontakt` → Erfolg, „Zum Shop“) → Footer.

## Shop-Links

Direkt im Template: `https://www.fitline.com/de/de-de/products/{Artikelnr}?sponsor={{team_partner_number}}` (JS `fsShopUrl`). Keine `shop_*`-Felder im Schema.

## Bilder

- `assets/hero/*.webp`, `assets/innen|aussen|routine-morgen|routine-abend|check.webp`: mit OpenAI `gpt-image-2` erzeugt (28.10.2026), ohne Marken/Verpackungen, KI-Kennzeichen (`ai-label.svg`) im Bild.
- `assets/produkte/*.webp` FEHLEN noch (Daniel liefert, nicht per API): `cleansing-lotion, tonic, 4ever, 4ever-enriched, 4ever-overnight, beauty-drink, activize-serum, dark-spot-corrector, augencreme, ultimate-young, men-face, set-young-care, set-4ever, set-4ever-enriched`. Bis dahin zeigt die Karte eine Farbfläche mit Symbol (`onerror` → `.noimg`).
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
