# Projekt Beauty-Template – Recherche

Stand: 28.10.2026 · Kernbotschaft: **Schönheit von innen & außen** · Quelle der Produktliste:
https://www.fitline.com/de/de-de/products?category=beauty (20 Produkte)

Nur Recherche, noch keine Webseite. Alle Angaben mit Quelle in den Einzeldateien; Kennzeichnung
**[PM]** = offizielle Aussage, **[Allg.]** = allgemeines Fachwissen.

## Ordner

| Pfad | Inhalt |
|---|---|
| `01-marke-und-positionierung.md` | Wie FitLine Beauty positioniert, Linie „FitLine skin“, Routine, Neuheiten Kongress 19.09.2026, Wettbewerb |
| `02-rechtsrahmen-und-formulierungen.md` | Kosmetik-VO, Health Claims, HWG/UWG, BGH-Kollagen-Urteil, PM-Partnerregeln, ~90 Beispielsätze erlaubt/riskant/verboten |
| `produkte/` | 20 Produktdossiers (je 12 Abschnitte) + `vergleich-4ever-linie.md` |
| `scanner/` | FitLine AI Scanner: Überblick, Ablauf in der App (mit Standbildern), Ideen für die Webseite |
| `quellen/` | Rohdaten: Produktseiten-Text, gerendertes HTML, offizielle Datenblätter (PDF + Text) |
| `scanner/quellen/` | PM-Info-PDF, Tutorial-Abschrift, FitLine-App-Datenschutztext; `scanner/video-frames/` 60 Standbilder |

## Die 20 Produkte

| Nr. | Produkt | Preis DE | Rolle für „innen & außen“ |
|---|---|---|---|
| 0709028 | Beauty (Trinkpulver, Kollagenpeptide) | 47,50 € | **innen** – Kernprodukt |
| 0704002 | Cell Kapseln | 54,00 € | innen (nur zusammen mit Cell Lotion) |
| 0116127 | Cleansing Lotion | 26,90 € | außen – Schritt 1 Reinigung |
| 0116007 | Tonic | 26,90 € | außen – Schritt 2 |
| 0116116 | Activize Serum | 48,90 € | außen – Serum (Brücke zum Trinkprodukt Activize) |
| 0116222 | Dark Spot Corrector (neu) | 58,90 € | außen – Pigmentflecken, vor dem Serum |
| 0116093 | Augencreme | 49,90 € | außen – Augenpartie |
| 0116122 | 4ever | 64,90 € | außen – Tagespflege normal/Mischhaut |
| 0116220 | 4ever enriched (neu) | 64,90 € | außen – Tagespflege trocken/reif |
| 0116223 | 4ever overnight enriched (neu) | 64,90 € | außen – Nachtpflege |
| 0116050 | Ultimate Young | 79,00 € | außen – Soforteffekt („3-Minuten-Lifting“) |
| 0116041 | Q10 Oxy Repair Intensive | 59,50 € | außen – Intensivpflege, Linie „med“ (Vorsicht) |
| 0116109 | Men Face Rich & Hydrating | 29,90 € | außen – Männer, All-in-One |
| 0116101 | Cell Lotion | 31,50 € | außen – Körper (mit Cell Kapseln) |
| 0116048 | Active Gel | 29,90 € | Körper/Sport – eher nicht auf die Beauty-Seite |
| 0116123 | Dental+ | 5,95 € | Zahnpflege – Randthema |
| 9116472 | Einsteiger-Set Young Care | 59,90 € | Set: einzige komplette Routine mit Reinigung |
| 9116562 | Starter Set 4ever | 123,90 € | Set: 4ever + overnight |
| 9116563 | Starter Set 4ever enriched | 123,90 € | Set: enriched + overnight |
| 9116585 | FitLine AI Scanner Starter Set | 505,90 € | Set für Teampartner, schaltet den Scanner frei |

## Wichtigste Erkenntnisse

1. **Die Kernbotschaft ist offiziell:** PM nennt den Bereich selbst „Beauty von innen und außen“; NTC®-Text
   „… auf die Zellebene von innen und außen“. Der BGH (09.10.2025, I ZR 135/24) sieht „schöne Haut von innen“
   allein nicht als Gesundheitsaussage – aber keine Kollagen-, Studien- oder „gesunde Haut“-Versprechen.
2. **Routine (aus Anwendungstexten abgeleitet, keine offizielle Routine-Seite):** Reinigung → Tonic →
   Dark Spot Corrector → Activize Serum → Augencreme → 4ever (Tag) / 4ever overnight enriched (Nacht);
   Ultimate Young als Soforteffekt obendrauf; innen: Beauty-Drink täglich.
3. **AI Scanner** (seit FitLine-App 1.12.0, 18.09.2026): Selfie → 11 Hautwerte, Hautalter, Empfehlungen aus
   Pflege + Nahrungsergänzung, teilbarer Warenkorb. Freischaltung für Teampartner über das Starter Set.
   Kosmetisch, keine Diagnose; Bildauswertung über OpenAI/Gemini laut Datenschutzerklärung.
4. **PMs eigene Seiten gehen teils zu weit** (Beauty-Fußnote fasst Claims zusammen, „Kollagen-Boost“,
   Kundenstimme „Falten glätteten sich“) – nicht übernehmen. Pro Nährstoff nur den zugelassenen Claim.
5. **Datenlücken/Widersprüche:** mehrere INCI-Listen unterscheiden sich zwischen Webseite und Etikett
   (Ultimate Young, 4ever, Dental+, Cell Lotion – echt bestätigt), Set-Seite Young Care mit falscher Tonic-INCI
   (die „$42“-Platzhalter waren unser Extraktionsfehler, PM zeigt die INCI) *(korrigiert 28.10.2026 nach INCI-Abgleich, siehe `docs/beauty/inci-abgleich.md`)*,
   4ever-Lichtschutz (UV-Filter ja, LSF-Angabe nein), Kojisäure-Grenzen beim Dark Spot Corrector.

## Offene Fragen an PM / Entscheidungen für Daniel

- Dürfen Partner Shop-Produktbilder verwenden (Markenrichtlinie: nur freigegebenes Material)?
- Darf „FitLine AI Scanner“ namentlich auf Partnerseiten stehen? Einwilligungstext fürs Scannen von Kundinnen?
- Gilt das Dermatest-Siegel aktuell, und dürfen Partner es nennen?
- Welche INCI-Listen sind aktuell (Webseite vs. Etikett)?
- Sollen Active Gel, Dental+ und Q10 Oxy Repair („med“) auf die Beauty-Seite?
- Sperrliste erweitern (Vorschläge in `02-rechtsrahmen-und-formulierungen.md`, z. B. Rosazea, Botox, Filler)?
