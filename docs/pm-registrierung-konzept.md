# Konzept: Direkt-Registrierung als Teampartner (PM-Business-Seite)

> Stand 15.10.2026 abends: Phase 1 umgesetzt und nur für demo live (Sektion v2 mit Sponsor-Karte,
> eigener Editor-Tab „Registrierung“, Link vorgegeben + optional editierbar, Modal „Sag Bescheid“ mit
> Formular `registrierung`). Übersetzungen IT/RU/UK/PL/BG/HI folgen nach Text-Freigabe. Details: Memory `project_pm_registrierung`.

Stand 15.10.2026. Anlass: mehrfaches Nutzer-Feedback, dass Interessenten auf der
Business-Seite nur das Kontaktformular ausfüllen können. Manche Teampartner wollen,
dass sich Interessenten direkt bei PM-International als Teampartner registrieren.

## 1. Wie die PM-Registrierung funktioniert

Link-Schema (von PM vorgegeben):

```
https://registration.pm-international.com/?TP={Teampartner-Nummer}&lang={de|en}&country={ISO-2}
```

- `TP` = Sponsor. Die Seite zeigt im ersten Schritt sichtbar **„Dein Sponsor: Daniel Kurzeja (#40237198)“**
  (Name und Nummer werden aus der TP-Nummer aufgelöst). Der Interessent sieht also klar,
  bei wem er einsteigt. Falsche Nummer = Umsatz landet beim falschen Sponsor, deshalb
  muss der Link immer aus der Teampartner-Nummer des Nutzers gebaut werden, nie von Hand.
- `lang`: Die Seite bietet nur **Deutsch und Englisch**. Unsere 8 Sprachen bilden wir ab als
  `de → de`, alles andere `→ en`.
- `country`: belegt das Länder-Feld vor; der Interessent kann es im Formular ändern.
  Ohne Parameter steht Deutschland.

Ablauf auf der PM-Seite (geprüft am 15.10.2026, Headless-Chrome, DE und US):

1. **„Starte Dein Business noch heute“**: Sponsor (fest), Land oder Region, Frau/Herr,
   Vorname, Nachname, E-Mail → „Weiter“.
2. **Startpaket wählen** (Screenshot Daniel): „Manager Quickstart“ (Professional) und
   „Teampartner Start“ (Basic), jeweils mit Inhalt, Vorteilen, Preis, „Choose“/„Customize“.
   Registrieren geht laut PM-Vertriebspartnerregeln auch **ohne Bestellung**.
3. Persönliche Daten (Adresse, Geburtsdatum, Telefon), Versand (DHL oder Abholung im DSC),
   Zahlungsart, Vertriebspartnerregeln akzeptieren → „Jetzt registrieren“. Vertrag kommt
   mit der Bestätigungs-Mail von PM zustande.

## 2. Preise und Bedingungen je Land (PM-Registrierung, Stand 15.10.2026)

Quelle: `pmebusiness.com/registrationv2/?country=…` (serverseitig gerendert, gleiche
Pakete wie registration.pm-international.com). Preise ändern sich, wir zeigen sie
deshalb **nicht** auf der Nutzerseite, sondern nur die Struktur.

| Land | Starter-Kit (Demo Bag) | Teampartner Start | Manager Quickstart | Startup 25 |
|---|---|---|---|---|
| DE | 19,90 € | 79,92 €/Monat · 3× Optimal-Set, 90 Tage, Abo mit 10 % Club-Rabatt | 454,50 € einmalig · 6× Optimal-Set, danach automatisches Abo | 47,12 € |
| AT | 19,90 € | 84,76 €/Monat · 3× Optimal-Set | 482,80 € | 51,04 € |
| CH | 25 CHF | 119,10 CHF/Monat · 3× Optimal-Set, Lieferung alle 3 Monate, Mindestlaufzeit 3 Monate | 798,80 CHF | 72,10 CHF |
| IT | 29,90 € | 92,66 €/Monat · 1× Optimal-Set, 30 Tage | 512,50 € | 54,00 € |
| PL | 97 PLN | 443,20 PLN · 1× Optimal-Set, 30 Tage | 2 214 PLN | 238,50 PLN |
| US | $26.80 | $105.12/Monat · 1× Optimal Set, 30 Tage | $596.00 | $61.80 |

Auf registration.pm-international.com (DE) stehen im Screenshot 99,82 € bzw. 474,40 €,
das ist jeweils Paket + Starter-Kit 19,90 €. Dazu überall: „Generation 50+“-Varianten,
Bonusprodukte gratis bei Bestellung innerhalb von 24 h, Einmal-Angebote (Serum, Joghurt).

Bedingungen, die in **allen** geprüften Ländern gleich sind (aus den PM-Vertriebspartnerregeln):

- Registrierung **kostenlos**, keine Gebühr.
- **Keine Kaufpflicht**, keine Mindestabnahme, keine Umsatzvorgabe
  („Eine Bestellung von FitLine-Produkten ist nicht erforderlich“).
- **30 Tage Widerruf** der Partnerschaft ab Annahme.
- Nebenberuflich; Provisionen monatlich (bis 20. des Folgemonats, US-Regeln).
- Pakete mit Abo: „Teampartner Start“ ist ein Abo; „Manager Quickstart“ löst im Folgemonat
  ein automatisches Abo aus. Kündigungsfristen stehen nicht auf der Seite (CH: bis 5 Werktage
  vor der nächsten Lieferung).

Nur diese drei Aussagen (kostenlos, keine Kaufpflicht, 30 Tage Widerruf) übernehmen wir
auf die Nutzerseite. Keine Preise, keine Produktbilder von PM, keine Bonus-Versprechen.

## 3. Einbau in die PM-Business-Seite

Grundsatz für Klarheit: **Kein Besucher landet bei PM, ohne vorher auf unserer Seite
gesehen zu haben, was dort passiert.** Deshalb führen alle Einstiege (Menü, Hero, Formular)
zuerst zu einer eigenen Erklär-Sektion `#teampartner`; nur der Button in dieser Sektion
verlässt die Seite (neuer Tab, `rel="noopener"`).

### 3.1 Neue Sektion „Direkt starten“ (direkt vor „Kontakt“)

Überschrift: „Du weißt schon, dass du das willst?“ / Unterzeile: „Dann kannst du dich
direkt bei PM-International als Teampartner registrieren. {{vorname}} wird dabei
automatisch als dein Sponsor eingetragen.“ (Duo: „{{vorname}} & {{vorname2}} werden …“)

Drei Schritte als Karten, damit niemand bei PM überrascht ist:

1. **Daten eingeben**: Land, Name, E-Mail. Sponsor steht schon drin.
2. **Startpaket wählen oder weglassen**: PM zeigt dir zwei Pakete (Teampartner Start,
   Manager Quickstart). Du kannst auch ohne Bestellung registrieren.
3. **Bestätigung per E-Mail**: Danach meldet sich {{vorname}} bei dir und begleitet dich.

Darunter drei Fakten in einer Zeile: „Kostenlos“ · „Keine Kaufpflicht“ · „30 Tage Widerruf“.

Button (primär): „Bei PM-International registrieren ↗“, Kleintext darunter:
„Öffnet die offizielle Registrierung von PM-International in einem neuen Tab.“
Zweiter, leiser Link: „Lieber erst Fragen stellen? Zum Kontaktformular.“

### 3.2 Hero: sekundärer CTA

Neben „Zeig mir, wie das läuft“ ein Ghost-Button „Direkt als Teampartner starten“ → `#teampartner`.
Primär bleibt das Gespräch, weil es für die meisten Besucher der richtige erste Schritt ist.

### 3.3 Menü, Mobile-Overlay, Footer

- Desktop-Nav: Textlink „Teampartner werden“ vor dem Kontakt-Button → `#teampartner`.
- Mobile-Overlay: unter „Kontakt aufnehmen“ ein zweiter, outlined Button „Teampartner werden“.
- Footer-Liste „Seite“: Eintrag „Direkt registrieren“.

### 3.4 Kontaktformular

Unter der Formular-Karte eine Zeile: „Schon entschieden? Direkt bei PM registrieren ↗“ → `#teampartner`.
Zusätzlich im Erfolgs-Screen nach dem Absenden: „Du willst nicht warten? Du kannst dich
auch jetzt schon registrieren.“ mit demselben Ziel.

### 3.5 Tracking (optional, Phase 2)

Ausgehender Klick auf den PM-Button als Event `pm_registrierung` über den bestehenden
Beacon, damit der Nutzer in der Statistik sieht, wie viele Interessenten den Weg gehen.

## 4. Editor: Nutzer schaltet selbst

Neue Felder im Schema `templates/pm-business-wellpreneur/placeholders-schema.json`,
Gruppe „Bereiche“ (wie `global_sektion`, `warum_sektion`):

| Key | Typ | Default | Bedeutung |
|---|---|---|---|
| `pm_registrierung` | `card_select`, `display_mode: section_toggle` | `ausblenden` | Sektion + alle Einstiege an/aus |
| `pm_reg_land` | `select` | `DE` | Land auf der PM-Seite vorbelegen (DE, AT, CH, IT, PL, US, …); `show_when: pm_registrierung=zeigen` |

Karte „Anzeigen“ mit Vorschaubild der Sektion (`section-previews/section-teampartner.webp`).
Erklärtext: „Interessenten können sich direkt bei PM-International als Teampartner
registrieren. Du wirst automatisch als Sponsor eingetragen (Nummer aus deinem Profil).“

Im Editor wird der fertige Link schreibgeschützt angezeigt (wie die FitLine-Shoplinks):
„Dein Registrierungslink · Sponsor-Nr. 40237198 (aus deinem Profil)“. Fehlt die
Teampartner-Nummer im Profil: roter Hinweis mit Link zu `/settings` und die Sektion
bleibt auf der Live-Seite ausgeblendet, auch wenn der Schalter auf „Anzeigen“ steht.

## 5. Technik

- **Quelle der Nummer**: `users.team_partner_number` (Profil-Tab, seit 15.10.2026 bei allen gesetzt).
  Das Business-Schema hat kein eigenes Feld dafür, also liefert `GET /api/worker/site-data`
  zusätzlich `team_partner_number` (Seitenwert gewinnt, falls ein Template wie FitLine ein
  eigenes Feld hat; sonst Profilwert) und den fertigen `pm_registrierung_url`.
  Der Link wird serverseitig gebaut (`encodeURIComponent`, Nummer nur Ziffern), nie im Template
  zusammengesetzt.
- **Sprache**: Template-Script setzt `lang=` beim Klick aus `document.documentElement.lang`
  (`de` → `de`, sonst `en`), damit auch die i18n-Fassungen (IT/RU/UK/PL/BG/HI) stimmen.
- **Template**: `index.de-en.html` → `i18n/build.py` → `index.html` → R2. Neue Strings in
  `i18n/source.json` + `translate.py` + `review.py` für die 6 weiteren Sprachen.
- **Gate im HTML**: `{{#if pm_registrierung=zeigen}}{{#if team_partner_number}} … {{/if}}{{/if}}`
  an allen Einstiegen (Nav, Hero, Sektion, Footer, Formular).
- **Compliance**: Seite nennt PM-International bereits im Footer-Hinweis als unabhängige
  Vertriebspartnerschaft; der Link führt auf die offizielle PM-Seite. Keine PM-Produktbilder,
  keine Preise, keine Health-Claims. Texte laufen wie alles durch `check-template-render.ts`.

## 6. Rollout

**Phase 1 (nur demo):** Feld `pm_registrierung` bekommt `admin_only: true` auf Feldebene
(Editor zeigt es nur Admin-Konten; demo ist das einzige Admin-Konto). Default `ausblenden`,
dadurch ändert sich für alle anderen Seiten nichts, auch nach dem R2-Upload. Test auf
demo.wellpreneur.io (alle 8 Sprachen, Mobile, Duo-Modus), KV-Purge nur für diesen Host.

**Phase 2 (alle):** `admin_only` entfernen, Checkliste `docs/new-template-checklist.md`
für die neue Sektion abhaken, Hinweis in der nächsten Update-Mail („Interessenten können
sich jetzt direkt registrieren, Schalter unter Bereiche“). Freigabe durch Daniel.

Offene Entscheidungen vor Phase 1:

1. Soll der Hero-Button wirklich sekundär bleiben, oder will ein Nutzer ihn primär setzen
   können (zweiter Schalter „Registrierung als Hauptziel“)? Vorschlag: erst mal nein.
2. Länder-Vorbelegung als Liste im Editor oder immer DE? Vorschlag: Liste mit den Ländern
   der Globe-Sektion, Default DE.
