# FinestSites Template-Agent

Dieser Agent erstellt hochwertige, conversion-optimierte Website-Vorlagen für die FinestSites-Plattform.

## Invokation

Neues Claude Code Chat im Projektverzeichnis öffnen und sagen:
> "Erstelle ein Template für [Branche/Nische]"

oder direkt: `/create-template`

---

## Pflichtlektüre vor dem Start

Lies immer zuerst:
- `docs/template-regelhandbuch.md` — Platzhalter-Syntax, Feldtypen, Schema-Aufbau
- `public/examples/placeholders-schema.json` — Beispiel-Schema

---

## Qualitätsstandards

- **Niveau:** Apple.com, Linear.app, Stripe.com — kein generisches AI-Look
- **Conversion:** Klarer Hero, starker CTA, Social Proof, FAQ, Kontakt
- **Personalisierung:** Jeder sichtbare Text und jedes Bild muss ein Platzhalter sein
- **Mobile-first:** Vollständig responsive, iOS Safari getestet
- **Performance:** Inline CSS bevorzugt, externe CDNs nur für GSAP/Fonts
- **Sprache:** Alle Beispieltexte auf Deutsch, Template-Keys auf Englisch (snake_case)

---

## Workflow — Schritt für Schritt

### Phase 1: Briefing erfassen

Frage den Nutzer (falls nicht angegeben):
1. **Branche/Nische** — z.B. "Friseur", "Rechtsanwalt", "Coach", "Restaurant"
2. **Zielgruppe** — Wer sind die Kunden?
3. **Hauptangebot** — Was wird verkauft/angeboten?
4. **Stil-Präferenz** — Modern/minimalistisch, warm/persönlich, luxuriös, etc.
5. **Farben** — Präferenzen oder "Agent entscheiden lassen"

### Phase 2: Research (Agent-Tool verwenden)

Starte einen Sub-Agenten mit dem Agent-Tool:

```
Aufgabe: Recherchiere für [Branche]:
1. Top 5 Best-Practice-Websites in dieser Branche (Conversion + Design)
2. Häufigste Kundenbedürfnisse und Pain Points
3. Typische Angebote und USPs
4. Vertrauenssignale die in dieser Branche funktionieren
5. Optimale Farbpsychologie für diese Zielgruppe
6. Passende Google Fonts Kombinationen (Headline + Body)
7. Welche Sektionen eine typische Seite dieser Branche hat
```

### Phase 3: UX/UI Design planen

Verwende den `ui-ux-pro-max` Skill:
- Seitenstruktur festlegen (Sections von oben nach unten)
- Farbpalette definieren (Primary, Secondary, Accent, Background, Text)
- Typografie wählen (Google Fonts CDN)
- Abstände und Grid-System planen
- Mobile-Breakpoints planen
- Animation-Konzept (GSAP ScrollTrigger für Reveal-Animationen)

**Standard-Seitenstruktur für Dienstleister:**
1. Hero — Headline + Subheadline + CTA + Bild
2. Vertrauen — Logos, Zahlen, kurze Beweise
3. Leistungen — 3–6 Cards mit Icon + Text
4. Über mich/uns — Bild + Text + Werte
5. Referenzen/Testimonials — 3 Bewertungen
6. FAQ — 4–6 häufige Fragen
7. Kontaktformular — Mit FinestSites Forms-Integration
8. Footer — Impressum-Link, Social Media

### Phase 4: Texte erstellen (Sub-Agent)

Starte einen Sub-Agenten:

```
Aufgabe: Erstelle deutsche Beispieltexte für ein [Branche]-Template.
Alle Texte müssen:
- Conversion-optimiert sein (klare Nutzenversprechen, Handlungsaufforderungen)
- Realistisch und professionell klingen (keine generischen Floskeln)
- Als Platzhalter-Beispiele dienen (der echte Nutzer ersetzt sie mit seinen Texten)
- Auf eine typische Person in dieser Branche zugeschnitten sein

Erstelle:
- Hero Headline (max 8 Wörter, Nutzen im Fokus)
- Hero Subheadline (max 20 Wörter, konkreter Mehrwert)
- CTA-Button Text (max 5 Wörter)
- 3–6 Leistungs-Titel + Beschreibungen (je max 20 Wörter)
- Über-mich-Text (3–4 Sätze)
- 3 Testimonial-Texte (je 2–3 Sätze, realistisch)
- 4–6 FAQ-Fragen + Antworten
- Kontaktformular-Headline
```

### Phase 5: Template bauen (frontend-design Skill)

Verwende den `frontend-design` Skill. Erstelle `index.html`:

**Technische Anforderungen:**
- Einzel-HTML-Datei mit inline `<style>` (kein externes CSS-File nötig, aber erlaubt)
- Google Fonts via CDN-Link
- GSAP via CDN für Scroll-Animationen: `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js`
- GSAP ScrollTrigger: `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js`
- CSS Custom Properties für alle Farben und Schriften (ermöglicht Theme-Wechsel per `{{#if}}`)
- Alle sichtbaren Texte als `{{key}}` Platzhalter
- Alle Bilder als `<img src="{{key}}" ...>` Platzhalter
- Kontaktformular mit `<form action="/.finestsites/forms/kontakt" method="POST">` + Honeypot
- Responsive via CSS Grid/Flexbox, mobile-first

**CSS Custom Properties Schema:**
```css
:root {
  --color-primary: {{color_primary}};     /* Hauptfarbe */
  --color-secondary: {{color_secondary}}; /* Sekundärfarbe */
  --color-accent: {{color_accent}};       /* Akzentfarbe für CTAs */
  --color-bg: {{color_bg}};               /* Hintergrund */
  --color-text: {{color_text}};           /* Haupttext */
  --font-heading: {{font_heading}}, sans-serif;
  --font-body: {{font_body}}, sans-serif;
  --border-radius: {{border_radius}}px;
}
```

**Theme-Switching-Pattern:**
```html
{{#if farbthema=dunkel}}
<style>:root { --color-bg: #0F172A; --color-text: #F8FAFC; }</style>
{{/if}}
```

**GSAP Animations Pattern:**
```javascript
gsap.registerPlugin(ScrollTrigger);
gsap.from('.reveal', {
  opacity: 0, y: 40, duration: 0.8, stagger: 0.1,
  scrollTrigger: { trigger: '.reveal', start: 'top 85%' }
});
```

### Phase 6: Placeholder-Schema erstellen

Erstelle das JSON-Schema nach `docs/template-regelhandbuch.md`:

**Pflicht-Sektionen:**
1. **Profil** — Name, Bild, Beruf, Kurzbeschreibung, Kontaktdaten
2. **Design** — Farbthema (card_select), Primärfarbe, Schrift (dropdown), Ecken-Radius (dropdown)
3. **Inhalte** — Alle content-spezifischen Felder (Hero, Leistungen als loop, Testimonials als loop, FAQ als loop)
4. **Social Media** — Instagram, Facebook, LinkedIn, etc. (alle optional)

**Schema-Vorlage:**
```json
{
  "fields": [
    {
      "key": "name",
      "label": "Dein vollständiger Name",
      "type": "text",
      "required": true,
      "placeholder_text": "z. B. Anna Müller",
      "default_value": "",
      "max_length": 60,
      "options": [],
      "card_options": [],
      "section": "Profil"
    },
    {
      "key": "profilbild",
      "label": "Profilbild",
      "type": "image",
      "required": true,
      "placeholder_text": "Am besten quadratisch, min. 400×400px",
      "default_value": "",
      "max_length": null,
      "options": [],
      "card_options": [],
      "section": "Profil",
      "aspect_ratio": "1/1"
    },
    {
      "key": "farbthema",
      "label": "Farbthema",
      "type": "card_select",
      "required": true,
      "placeholder_text": "",
      "default_value": "hell",
      "max_length": null,
      "options": [],
      "card_options": [
        { "value": "hell", "label": "Hell", "description": "Klares, helles Design", "card_type": "color", "color": "#FFFFFF", "image_url": "" },
        { "value": "dunkel", "label": "Dunkel", "description": "Elegantes Dunkeldesign", "card_type": "color", "color": "#0F172A", "image_url": "" }
      ],
      "section": "Design"
    }
  ]
}
```

### Phase 7: Qualitätsprüfung

Checkliste vor Abgabe:

**Conversion:**
- [ ] Klare Headline mit Nutzen (kein generisches "Willkommen")
- [ ] CTA im Hero above the fold
- [ ] Mindestens 3 Vertrauenssignale
- [ ] Kontaktformular vorhanden und funktional
- [ ] Honeypot im Formular

**Personalisierung:**
- [ ] Jeder Text ist ein Platzhalter
- [ ] Jedes Bild ist ein Platzhalter
- [ ] Farben sind über CSS Custom Properties steuerbar
- [ ] Mindestens 2 Design-Varianten (z.B. hell/dunkel)

**Technisch:**
- [ ] Kein JavaScript-Fehler in der Konsole
- [ ] Mobile-Ansicht korrekt (320px–768px)
- [ ] Alle `{{#if}}` Blöcke korrekt geschlossen
- [ ] Formular-Action zeigt auf `/.finestsites/forms/kontakt`
- [ ] Honeypot-Feld vorhanden

**Design:**
- [ ] Keine generische AI-Ästhetik
- [ ] Klare visuelle Hierarchie
- [ ] Konsistente Abstände
- [ ] GSAP Scroll-Animationen aktiv

---

## Deliverables

Am Ende des Prozesses werden geliefert:

1. **`index.html`** — Vollständige Template-Datei mit allen Platzhaltern
2. **`placeholders-schema.json`** — Komplettes JSON-Schema für den Admin
3. **`template-readme.md`** — Kurze Beschreibung: Was macht dieses Template, für wen, Besonderheiten

---

## Sub-Agenten Übersicht

| Agent | Aufgabe | Tool |
|---|---|---|
| Researcher | Markt, Zielgruppe, Best Practices | Agent + WebSearch |
| Copywriter | Deutsche Beispieltexte | Agent |
| Designer | UX/UI-Plan, Farben, Fonts | ui-ux-pro-max Skill |
| Developer | HTML/CSS/JS Template | frontend-design Skill |
| Image Generator | Placeholder-Bilder (optional) | WebSearch (Unsplash) |

---

## Hinweise für spezifische Branchen

### Dienstleister (Friseur, Kosmetik, Massage)
- Booking-CTA prominent
- Vorher/Nachher-Bilder als loop-Feld
- Öffnungszeiten als Tabelle

### Berater/Coaches
- Autorität aufbauen (Zertifikate, Erfahrung)
- Kostenlose Erstberatung als Hauptangebot
- Kalender-Embed-Placeholder

### Handwerker
- Notfall-Telefonnummer prominent
- Gewerke als Tags/Badges
- Einzugsgebiet-Feld

### Restaurants/Cafés
- Speisekarte als Loop (Kategorie + Preis + Beschreibung)
- Öffnungszeiten prominent
- Reservierungsformular

---

## Deployment nach Template-Erstellung

1. HTML-Datei im Admin hochladen: Admin → Templates → [Template] → Asset hochladen
2. Schema im Admin eintragen: Admin → Templates → [Template] → Platzhalter bearbeiten
3. Formular-Schema anlegen: Admin → Templates → [Template] → Formulare
4. Testsite anlegen und alle Felder befüllen
5. Preview prüfen, dann live stellen
