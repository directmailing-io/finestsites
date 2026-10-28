# INCI-Abgleich FitLine Beauty: Webseite vs. Etikett/Datenblatt

Stand: 28.10.2026 · Prüfung: Element für Element (normalisiert: Groß/Klein, Leerzeichen, Trennstriche, Satzzeichen) · Quellen: `docs/beauty/quellen/`

## Kurzfassung

- **Echte inhaltliche Abweichungen (d): 4 Produkte**: Ultimate Young, 4ever, Cell Lotion, Dental+. In allen vier Fällen steht auf der Webseite (fitline.com, DE/AT/CH/US identisch, heute neu abgerufen) eine andere Rezeptur-Fassung als auf dem verlinkten Etikett-PDF. Die Etiketten habe ich als Bild geprüft, Lesefehler sind ausgeschlossen.
- **Unsere Extraktionsfehler (c): der angebliche „$42“-Platzhalter** bei Augencreme, Activize Serum, 4ever enriched und den Sets (dazu „$41“ auf der UK-Seite). „$42“ ist ein interner Verweis im Next.js-Datenstrom (RSC-Textblock Nr. 0x42). Unser Extraktor hat den Verweis nicht aufgelöst. **Auf der echten Seite wird die vollständige INCI angezeigt** (geprüft per Klick auf das Akkordeon in einem echten Browser, Screenshot liegt vor). Einen Anzeigefehler bei PM gibt es nicht.
- **Tonic:** Die Einzelseite stimmt exakt mit dem Etikett überein. Der gemeldete Unterschied stammt von der **Set-Seite „Einsteiger-Set Young Care“ (9116472)**: Dort steht unter „Tonic:“ die INCI einer **Creme** (u. a. Distarch Phosphate, Ribes Nigrum (Schwarze Johannisbeere) Seed Oil, Ectoin, Coumarin). Das ist ein Datenfehler von PM auf der Set-Seite. Das Set-Datenblatt-PDF enthält das richtige Tonic-Etikett.
- Alle anderen Produkte: identisch (a) oder nur Schreibweise (b).

## Übersicht

| Produkt | Webseite vs. Etikett (Version) | Klasse | Kurzbefund |
|---|---|---|---|
| 0116007 Tonic | Seite = E0116007DE-01 (KW12/2025) | **a** (Einzelseite) | 21/21 Stoffe, gleiche Reihenfolge. pdftotext hatte nur Leerzeichen verschluckt („Aqua(Water)“). **Aber:** Set-Seite 9116472 zeigt unter „Tonic“ eine falsche INCI (PM-Fehler, siehe unten) |
| 0116127 Cleansing Lotion | Seite = E0116127DE-01 (KW12/2025) | **a** | 33/33, identisch |
| 0116093 Augencreme | Seite = F0116093DE00 (12/2022) | **a** + **c** | 42/42, identisch. „$42“ war **unser** Extraktionsfehler, die Seite zeigt die Liste. Tippfehler „Chamonilla … (Chamomille)“ steht auf Etikett **und** Seite (PM) |
| 0116116 Activize Serum | kein Etikett verlinkt/auffindbar | **c** (nur „$42“) | Seite zeigt die volle INCI. Ein Vergleich mit dem Etikett ist mangels PDF nicht möglich |
| 0116222 Dark Spot Corrector | Seite (deutsche Namen) = F0116222DE00 (08/2026) | **b** | 23/23, gleiche Reihenfolge. Die Seite nutzt eingedeutschte Namen („Kojisäure“, „Squalan“) statt INCI-Namen |
| 0116050 Ultimate Young | Seite ≠ F0116050DE-02 (KW32/2024) | **d** | 21 Stoffe gemeinsam; 15 nur auf der Seite, 14 nur auf dem Etikett; Pflanzenkomplex komplett anders |
| 0116041 Q10 Oxy Repair Intensive | Seite = F0116041DE-01 (KW06/2025) | **a** | 26/26, identisch |
| 0116109 Men Face | kein Etikett verlinkt/auffindbar | – | nicht prüfbar (Seite zeigt INCI) |
| 0116122 4ever | Seite ≠ F0116122DE-00 (09/2025, auch im AI-Scanner-Set-PDF) | **d** (klein) | Seite +Jojobaöl, +1,2-Hexanediol; Etikett +Hydroxyacetophenone; 2 Positionswechsel |
| 0116220 4ever enriched | Seite (2. Akkordeon „Ingredients“) = F0116220DE00 (08/2026) | **a** + **c** | 52/52, identisch. „$42“ war **unser** Fehler. Das Feld `ingredients` enthält bei PM nur den Werbesatz, die INCI steht im Feld `packageInfo` (ebenfalls mit „Ingredients“ beschriftet) |
| 0116223 4ever overnight enriched | Seite = F0116223DE00 (08/2026) | **a** | 38/38, identisch |
| 0116101 Cell Lotion | Seite ≠ E0116101DE-01 (2124 / PDF 12/2024) | **d** | Seite +9 Stoffe (u. a. Konservierer Sodium Benzoate, Potassium Sorbate), Etikett +3; Reihenfolge stark anders |
| 0116048 Active Gel | Seite = E0116048DE-02 (KW06/2023) | **b** | 38/38. Etikett schreibt „Tumeric“, die Seite korrekt „Turmeric“ |
| 0116123 Dental+ | Seite ≠ Tube 0116123DE-01 (Druck-PDF 03.10.2024) | **d** | Seite +5 Stoffe (Jojoba, Spearmint-Öl, Carvone, Eukalyptusöl, Pinene), Reihenfolge stark anders |
| 0709028 Beauty (NEM) | Seite = LMIV-Etikett ROW 2923 (Dose) | **b** | 20/20, identisch („38 %“ vs. „38%“) |
| 0704002 Cell Kapseln (NEM) | Seite = F0704002DE-08 (2024) | **a** | 10/10, identisch |

Lesart der Versionscodes: Die vierstellige Endung im Dateinamen ist Kalenderwoche + Jahr. Belegt bei Ultimate Young: „3224“ = KW32/2024, und die PDF-Erstellung war am 07.08.2024. Das passt auch bei Tonic/Cleansing („1225“, erstellt 03.04.2025) und Active Gel („0623“, erstellt 07.02.2023).

## Was wir ausgeschlossen haben (für alle (d)-Fälle)

1. **Spaltensalat durch pdftotext:** ausgeschlossen. Alle vier Etiketten habe ich als Bild gelesen (Read-Tool bzw. 300–800-dpi-Ausschnitt). Die Dental+-Tube hat Text in Pfaden, pdftotext liefert dort gar nichts. Die Liste ist vom Bild abgeschrieben.
2. **Mehrsprachiges Etikett:** ausgeschlossen. Die INCI steht auf allen Etiketten nur einmal (INCI ist sprachneutral).
3. **Falsches JSON-Feld:** ausgeschlossen. Ich habe alle Felder der Seite aus dem Next.js-Datenstrom gelesen und Verweise aufgelöst. Nur ein Feld enthält eine INCI-Liste.
4. **Anderes Land / alter Abruf:** ausgeschlossen. Heute neu abgerufen: DE, AT, CH und US liefern **zeichengleich dieselbe Liste** (gleicher Hash) wie unser Abruf. Es gibt also eine zentrale Stammdaten-Liste für alle Länder.
5. **Falsches PDF:** ausgeschlossen. Artikelnummer und Packmittelcode auf dem Etikett passen jeweils zum Produkt, und die Produktseite verlinkt genau dieses PDF.

## Auffälliges Muster: neue EU-Duftstoff-Allergene

In drei der vier (d)-Fälle enthält die **Webseite zusätzlich genau die Duftstoffe, die durch die erweiterte EU-Allergenliste (VO (EU) 2023/1545) neu kennzeichnungspflichtig werden**. Für neu in Verkehr gebrachte Produkte gilt sie ab 31.07.2026, für alle ab 31.07.2028 (nach unserem Kenntnisstand, vor Verwendung im Gesetzestext gegenprüfen):

- Ultimate Young (Seite): Citrus Limon Peel Oil, Citrus Aurantium Bergamia Peel Oil, Lavandula Hybrida Oil, Linalyl Acetate (+ Limonene, Parfum)
- Dental+ (Seite): Mentha Viridis Leaf Oil, Eucalyptus Globulus Leaf/Twig Oil, Carvone, Pinene
- Cell Lotion (Seite): Pinene, Camphor, Beta-Caryophyllene, Terpineol (typische Bestandteile des Rosmarinöls, das in beiden Fassungen steht)

Die neueren Etiketten von 2025/2026 (Tonic, Cleansing, enriched-Linie) deklarieren solche Stoffe bereits, z. B. Tetramethyl Acetyloctahydronaphthalenes, Anethole und Citrus Limon Peel Oil. **Das spricht dafür, dass die Webseiten-Listen bei Ultimate Young, Dental+ und Cell Lotion die neuere Deklaration sind und die verlinkten PDFs ältere Druckstände.** Ein Beweis ist das nicht. Neben der Allergen-Kennzeichnung haben sich jeweils auch Rezepturbestandteile geändert.

---

## Einzelbefunde (c) und (d)

### 0116050 Ultimate Young (d)

- **Webseite** (alle Länder identisch, 36 Stoffe): Aqua, Sodium Silicate, Magnesium Aspartate, Pentylene Glycol, Green Tea, Aspalathus, Caprylic/Capric Triglyceride, **Bergamot Fruit Oil, Lemon Fruit Extract**, Lavender Extract, **Apple Fruit Extract**, Rosemary, **Sage Oil, Clary Oil**, Dunaliella, Lecithin, Ubiquinone, Tocopheryl Acetate, Ergothioneine, Tocopherol, Mica, Glycerin, Ethylhexylglycerin, **Caprylyl/Capryl Glucoside**, Squalane, Alcohol, **Citric Acid**, CI 77491, CI 77891, Punica Granatum, **Parfum, Bergamot Peel Oil, Limonene, Lavandin Oil, Lemon Peel Oil, Linalyl Acetate**.
- **Etikett F0116050DE-02, KW32/2024** (`quellen/datenblaetter/0116050_…_3224.pdf`, Faltschachtel, als Bild geprüft; 35 Stoffe): enthält zusätzlich **Hydrated Silica, Cupressus Sempervirens Seed Extract, Fucus Vesiculosus Extract, Prunus Persica (Peach), Vanilla Planifolia, Jasminum Officinale, Plumeria Rubra, Coriandrum Sativum, Rose Extract, Amyl Cinnamal, Linalool**, Bergamot *Fruit Extract* (statt Fruit Oil). Es fehlen dort Zitrone, Apfel, Salbei, Muskatellersalbei, Lavandin, Caprylyl/Capryl Glucoside, Citric Acid, Parfum, Limonene und Linalyl Acetate.
- Die Reihenfolge der gemeinsamen Stoffe ist stark anders: Glycerin und Ubiquinone stehen auf dem Etikett weit vorn, auf der Seite weit hinten. Granatapfel steht auf dem Etikett an 8. Stelle, auf der Seite an 30.
- **Beleg für ein zweites Druckdokument:** Die Seiten-Liste enthält Silbentrennungen aus einem Satzlayout („Magne-sium“, „Flo-wer“, „Ubiqui-none“, „Gra-natum“). Das Etikett -02 trennt an anderen Stellen („Magnesi-um“, „Gly-cerin“, „Rooi-bos“). PM hat die Webseiten-Liste also aus einem **anderen, uns nicht vorliegenden Etikett** kopiert, vermutlich einer neueren Fassung (-03).
- Der Vergleich der Fassungen spricht für die Webseite als neuere Liste (Allergen-Muster oben). Bemerkenswert: Die Pflanzenextrakte des Etiketts -02 (Zypresse, Blasentang, Pfirsich, Vanille, Jasmin, Plumeria, Koriander, Rose) finden sich heute fast vollständig im **Activize Serum** wieder.
- **Empfehlung Template:** keine vollständige INCI abschreiben, nur auf die Produktseite verlinken. Keine einzelnen Pflanzenextrakte bewerben, außer denen, die in **beiden** Fassungen stehen: Grüntee, Rooibos, Granatapfel, Lavendel, Rosmarin, Dunaliella, Q10, Vitamin E, Ergothionein, Squalan.
- **Frage an PM:** „Für Ultimate Young (Art. 0116050) nennt die Produktseite auf fitline.com eine andere INCI-Liste als das dort verlinkte Faltschachtel-PDF F0116050DE-02 (KW32/2024), u. a. mit Salbei-, Muskatellersalbei- und Lavandinöl statt Zypresse, Blasentang, Pfirsich, Vanille, Jasmin, Plumeria, Koriander und Rose. Welche INCI entspricht der aktuell in Deutschland ausgelieferten Ware, und können Sie uns das aktuelle Packmittel-PDF (vermutlich F0116050DE-03) zur Verfügung stellen?“

### 0116122 4ever (d, geringfügig)

- **Webseite** (alle Länder und Set-Seiten 9116562/9116585 identisch, 48 Stoffe) vs. **Faltschachtel F0116122DE-00** (`0116122_DE_4ever_0116122DE.pdf`, erstellt 11.09.2025, als Bild geprüft, 47 Stoffe). **Dasselbe Etikett steckt auch im AI-Scanner-Set-PDF 9116585**, zusammen mit den Etiketten der enriched-Linie von 08/2026.
  - nur Webseite: **Simmondsia Chinensis (Jojoba) Seed Oil**, **1,2-Hexanediol**
  - nur Etikett: **Hydroxyacetophenone** (an der Stelle, wo die Seite 1,2-Hexanediol hat)
  - Reihenfolge: Pentylene Glycol steht auf der Seite an Position 4, auf dem Etikett hinter Cetearyl Alcohol (Position 9). Lycium-Barbarum-Kallus und Dunaliella sind vertauscht.
  - Der Duftstoff-Teil ist identisch.
- Hier spricht mehr für das **Etikett als aktuellen Stand**, weil PM es noch im Set-PDF vom Spätsommer 2026 verwendet. Sicher ist das nicht.
- **Empfehlung Template:** Jojobaöl bei 4ever nicht als Inhaltsstoff nennen. Alle übrigen Schlüsselstoffe (Hyaluron, Ceramide NP, Bakuchiol, Goji-Kallus, Palmitoyl Tripeptide-38, Q10, Panthenol, UV-Filter) stehen in beiden Fassungen und sind unkritisch.
- **Frage an PM:** „Bei 4ever (0116122) weicht die INCI auf fitline.com von der Faltschachtel F0116122DE-00 ab: Die Webseite nennt zusätzlich Jojobaöl und 1,2-Hexanediol, die Faltschachtel stattdessen Hydroxyacetophenone, und Pentylene Glycol steht an anderer Position. Welche Fassung ist aktuell im Handel?“

### 0116101 Cell Lotion (d)

- **Webseite** (alle Länder identisch, 44 Stoffe) vs. **Etikett E0116101DE-01** (`…_2124.pdf`, PDF-Erstellung 05.12.2024, als Bild geprüft, 38 Stoffe).
  - nur Webseite: **Sodium Benzoate, Potassium Sorbate** (Konservierer), **Alcohol Denat.**, **Hydrogenated Palm Glycerides Citrate**, **Triticum Vulgare (Wheat) Bran Extract**, **Pinene, Camphor, Beta-Caryophyllene, Terpineol**
  - nur Etikett: **Lactic Acid**, **Methylpropanediol**, **Triticum Vulgare (Wheat) Seed Extract**
  - Die Reihenfolge ist ab Position 4 deutlich anders (z. B. Dimethicone: Etikett Pos. 12, Seite Pos. 24).
- Indizien für die **Webseite als neuere Fassung**: (1) die Allergen-Deklaration (Rosmarinöl-Bestandteile). (2) Den Wechsel von „Wheat Seed Extract + Methylpropanediol“ zu „Wheat Bran Extract“ ohne Methylpropanediol sieht man auch bei den 2025er-Etiketten von Tonic und Cleansing Lotion. Die älteren Etiketten (Augencreme 2022, Active Gel 2023) haben noch die Seed-Variante. (3) Die dritte Fassung auf der Cell-Set-Seite 9701000 (mit Whey und dem seit 2022 verbotenen Lilial) ist sicher die älteste.
- **Die Behauptung im Dossier, die Webseiten-Fassung sei „aktuell“, ist nicht belegt.** Sie ist nur wahrscheinlich (korrigiert im Dossier).
- **Empfehlung Template:** keine Aussage „ohne Konservierungsstoffe“. Keine einzelnen Stoffe außerhalb der Schnittmenge bewerben. Koffein, Carnitin, Linolsäure, Coleus, Rosmarinöl, Benzylnicotinat und Tetrahydropiperin stehen in beiden Fassungen.
- **Frage an PM:** „Für Cell Lotion (0116101) nennt fitline.com eine INCI mit Sodium Benzoate, Potassium Sorbate, Alcohol Denat. und Weizenkleie-Extrakt. Das verlinkte Etikett E0116101DE-01 nennt dagegen Lactic Acid, Methylpropanediol und Weizensamen-Extrakt und keine Konservierer. Welche Fassung ist aktuell im Handel, und gibt es ein aktuelles Etikett-PDF? Zusätzlich: Die Cell-Set-Seite 9701000 nennt noch Butylphenyl Methylpropional (Lilial) und Whey. Bitte prüfen und aktualisieren.“

### 0116123 Dental+ (d)

- **Webseite** (alle Länder identisch, 36 Stoffe) vs. **Tube 0116123DE-01** (Druck-PDF „…IIDE_3424_Esko“, Freigabe 03.10.2024, geändert 07.07.2025; Text liegt als Pfad vor, deshalb mit 800 dpi vom Bild gelesen, 31 Stoffe):
  - Tube: Aqua, Sorbitol, Glycerin, Cellulose, Hydrated Silica, Xylitol, Pentylene Glycol, Lauryl Glucoside, Aroma, Sodium Cocoyl Glutamate, Carrageenan, Panthenol, Crocus Sativus Flower Extract, Ubiquinone, Menthol, Lecithin, Olive Oil, Dunaliella, Krameria Triandra, Caprylic/Capric Triglyceride, Tocopheryl Acetate, Squalane, Dipotassium Glycyrrhizate, Tocopherol, Propanediol, Propylene Glycol, Zinc Oxide, Chlorophyllin-Copper Complex, Hydroxyacetophenone, Xanthan Gum, Limonene.
  - nur Webseite: **Simmondsia Chinensis (Jojoba) Seed Oil, Mentha Viridis (Spearmint) Leaf Oil, Carvone, Eucalyptus Globulus Leaf/Twig Oil, Pinene**. Nur auf der Tube steht nichts zusätzlich.
  - Reihenfolge ab Position 11 deutlich anders: Carrageenan Tube Pos. 11 / Seite Pos. 22, Menthol 15 / 30, Chlorophyllin 28 / 36.
- Die Minz- und Eukalyptus-Bestandteile passen zur neuen Allergen-Kennzeichnung (Aroma wird aufgeschlüsselt). Jojobaöl und die neue Reihenfolge sprechen aber zusätzlich für eine geänderte Rezeptur. Die Seite ist vermutlich neuer. Offen.
- **Empfehlung Template:** Jojoba, Minze und Eukalyptus nicht nennen. Sicher in beiden Fassungen: Xylit, Krokusblüte, Ratanhia, Panthenol, Q10, Vitamin E, Zinkoxid, sulfatfreie Tenside.
- **Frage an PM:** „Für Dental+ (0116123) nennt fitline.com zusätzlich Jojobaöl, Spearmint-Öl, Carvone, Eukalyptusöl und Pinene und eine andere Reihenfolge als die Tube 0116123DE-01 (Druckfreigabe 10/2024). Welche Rezeptur bzw. Deklaration ist aktuell im Handel, und gibt es ein aktualisiertes Tuben-PDF?“

### „$42“ – Augencreme, Activize Serum, 4ever enriched, Sets (c, unser Fehler)

- **Ursache:** fitline.com ist eine Next.js-App. Lange Texte stehen im Datenstrom als eigener Block (`42:T415,Aqua (Water), …`), und das Feld verweist mit `"value":"$42"` darauf. Unser Extraktor (`quellen/produktseiten/*.md`) hat den Verweis wörtlich übernommen.
- **Belege:** `quellen/html/0116093.html` enthält `42:T415,Aqua (Water), Glycerin, Simmondsia …`. In einem echten Browser (Playwright, 28.10.2026) zeigt das Akkordeon „Inhaltstoffe/Pflichtangaben“ bei 0116093 und 0116116 die vollständige Liste. Bei 0116220 zeigt das zweite Akkordeon „Ingredients“ die volle INCI, das erste den Werbesatz. Die Set-Seiten 9116562, 9116563 und 9116585 zeigen ihre INCI im Feld „Inhaltsstoffe“ (`measures`).
- **Konsequenz:** Für Augencreme und 4ever enriched sind Webseite und Etikett identisch. Für Activize gibt es nur die Webseiten-Liste. Ein Hinweis an PM ist **nicht** nötig.

### Set-Seite Einsteiger-Set Young Care 9116472 – falsche Tonic-INCI (PM-Fehler)

- Das Feld „Inhaltstoffe/Pflichtangaben“ der Set-Seite enthält unter „Tonic:“ eine 56-teilige Liste einer Creme (Distarch Phosphate, Octyldodecanol, Ribes Nigrum Seed Oil, Cocos Nucifera Oil, Cardiospermum, Saccharomyces Lysate, Ectoin, Coumarin …). Die Einzelseite 0116007, das Etikett E0116007DE-01 und das Tonic-Etikett im Set-PDF stimmen dagegen exakt überein (21 Stoffe).
- Reinigungsschaum und Balancing Creme auf derselben Set-Seite stimmen mit dem Set-PDF überein.
- **Frage/Hinweis an PM:** „Auf der Set-Seite 9116472 (Einsteiger-Set Young Care) steht unter ‚Tonic‘ eine INCI, die nicht zum Tonic 0116007 gehört (u. a. Distarch Phosphate, Ribes Nigrum Seed Oil, Ectoin, Coumarin). Die Einzelseite und das Etikett E0116007DE-01 nennen eine andere Liste. Bitte korrigieren. Zu welchem Produkt gehört die dort angezeigte Liste?“

### Schreibweisen (b), nur zur Info

- Dark Spot Corrector: Die Seite nutzt deutsche Bezeichnungen. Im Template die **INCI-Namen vom Etikett** verwenden (INCI ist die vorgeschriebene Bezeichnung). Die Seite schreibt außerdem „Tetramethyl Acetyloctahydronaphthalene“ (Singular).
- Active Gel: Etikett „Tumeric“ (Tippfehler), Seite „Turmeric“.
- Augencreme: „Chamonilla Recutita (Chamomille)“ auf Etikett und Seite (korrekt: Chamomilla Recutita (Matricaria)).
- Ultimate Young und Activize: Trennstriche aus dem Satzlayout in der Seiten-Liste („Magne-sium“, „Plan-ifolia“). Beim Übernehmen entfernen.

## Welche Liste gilt für unser Template?

1. **Grundregel:** Keine vollständigen INCI-Listen ins Template kopieren. Stattdessen „Inhaltsstoffe: siehe offizielle Produktseite“ mit Link. Die Webseite ist die Liste, die PM selbst pflegt und laufend ändert.
2. **Schlüsselstoffe nur aus der Schnittmenge** beider Fassungen (bei Ultimate Young, 4ever, Cell Lotion, Dental+), bis PM antwortet.
3. Für (a)/(b)-Produkte dürfen Webseiten- und Etikettliste gleichermaßen genutzt werden.
4. Für Activize Serum und Men Face gibt es nur die Webseiten-Liste. Ein Etikett ist nicht verlinkt, über die Seiten nicht auffindbar und auch auf DE/AT/CH/US nicht verlinkt.

## Verwendete Belege (Auswahl)

- Webseiten-Felder mit aufgelösten Verweisen: aus `quellen/html/{ID}.html` (Next.js-Datenstrom), Neuabruf 28.10.2026 von `fitline.com/{de/de-de,at/de-at,ch/de-ch,us/en-us}/products/{0116050,0116101,0116122,0116123}`
- Browser-Prüfung des sichtbaren Akkordeons: 0116093, 0116116, 0116220, 0116223, 0116222, 0116050 (Playwright/Chromium)
- Etiketten als Bild gelesen: 0116050, 0116101, 0116122 (Ausschnitt 300 dpi), 0116123 (Ausschnitt 800 dpi), 0709028, 0704002. Übrige per `pdftotext -raw` und Listenvergleich: Reihenfolge und Anzahl identisch, deshalb kein Lese-Risiko.
- PDF-Metadaten (Erstellungsdatum) per `pdfinfo`
