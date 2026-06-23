# FinestSites Template-Regelhandbuch

Dieses Dokument beschreibt alle Regeln für die Erstellung von Templates:
Platzhalter-Syntax, verfügbare Feldtypen, Formular-Integration und Deployment.

---

## Inhaltsverzeichnis

1. [Platzhalter-Syntax](#1-platzhalter-syntax)
2. [Feldtypen im Schema](#2-feldtypen-im-schema)
3. [Template-Dateistruktur](#3-template-dateistruktur)
4. [Formulare](#4-formulare)
5. [Schema-Aufbau (JSON)](#5-schema-aufbau-json)
6. [Deployment-Workflow](#6-deployment-workflow)

---

## 1. Platzhalter-Syntax

Die Template-Engine läuft im Cloudflare Worker und ersetzt Platzhalter zur Laufzeit.

### 1.1 Einfache Variable

```html
{{key}}
```

Wird durch den gespeicherten Wert des Feldes ersetzt. Ist kein Wert vorhanden, wird der Platzhalter durch einen leeren String ersetzt (kein Fehler).

```html
<h1>{{name}}</h1>
<img src="{{profilbild}}" alt="{{name}}">
```

### 1.2 Bedingungsblock — `{{#if}}`

Rendert Inhalt nur wenn der Wert vorhanden, nicht leer, nicht `"false"` und nicht `"0"` ist.

```html
{{#if instagram_url}}
  <a href="{{instagram_url}}">Instagram</a>
{{/if}}
```

**Wert-Vergleich** — rendert nur wenn `key` exakt gleich `wert` ist:

```html
{{#if farbthema=dunkel}}
  <style>body { background: #000; }</style>
{{/if}}
```

### 1.3 Negations-Block — `{{#unless}}`

Das Gegenteil von `#if` — rendert wenn der Wert leer/false/0 ist.

```html
{{#unless profilbild}}
  <div class="avatar-placeholder">?</div>
{{/unless}}
```

Mit Wert-Vergleich:

```html
{{#unless rundung=eckig}}
  <style>.btn { border-radius: 12px; }</style>
{{/unless}}
```

### 1.4 Loop — `{{#each}}`

Iteriert über ein `loop`-Feld (Array aus JSON). Felder innerhalb des Items werden mit `{{this.feldname}}` angesprochen. `{{@index}}` gibt die 1-basierte Position zurück.

```html
{{#each links}}
  <a href="{{this.url}}">
    <span>{{@index}}. {{this.titel}}</span>
    <small>{{this.beschreibung}}</small>
  </a>
{{/each}}
```

### 1.5 Verschachtelung

`#if` und `#unless` können ineinander verschachtelt werden (bis zu 20 Ebenen):

```html
{{#if instagram_url}}
  {{#if twitter_url}}
    <p>Du hast beide Netzwerke</p>
  {{/if}}
{{/if}}
```

### 1.6 Wichtige Regeln

| Regel | Erklärung |
|---|---|
| Keys sind case-sensitiv | `{{Name}}` ≠ `{{name}}` |
| Leerzeichen im Key erlaubt | `{{ name }}` wird zu `name` getrimmt |
| Unbekannte Keys → leer | Kein Fehler, einfach leerer String |
| Reihenfolge | Loops → Conditionals → Variablen |

---

## 2. Feldtypen im Schema

### Einfache Felder

| Typ | Beschreibung | Besonderheiten |
|---|---|---|
| `text` | Einzeiliges Textfeld | `max_length` empfohlen |
| `textarea` | Mehrzeiliges Textfeld | `max_length` empfohlen |
| `url` | URL-Eingabe | Wird als Link-Href verwendet |
| `email` | E-Mail-Adresse | |
| `image` | Bild-Upload | `aspect_ratio` angeben (z.B. `"1/1"`, `"16/9"`, `"free"`) |

### Auswahl-Felder

| Typ | Beschreibung | Besonderheiten |
|---|---|---|
| `dropdown` | Dropdown-Auswahl | `options: ["wert1", "wert2"]` — **nur `string[]`, keine Objekte!** |
| `card_select` | Visuelle Karten-Auswahl | `card_options` Array (siehe unten) |

> ⚠️ **Wichtig – `dropdown` options-Format:**
> `options` ist **immer ein Array aus einfachen Strings** (`string[]`).
> Der gespeicherte Wert entspricht exakt dem angezeigten String.
> **Falsch:** `"options": [{ "value": "light", "label": "Light Mode" }]`
> **Richtig:** `"options": ["light", "dark"]`
>
> Da der Wert = der angezeigte String ist, empfiehlt es sich, technische Werte (z. B. `"light"`, `"dark"`, `"ja"`, `"nein"`) zu verwenden, wenn das Template diese Werte per `{{key}}` direkt in HTML-Attribute oder `{{#if key=wert}}`-Bedingungen einbindet.

**`card_options`-Struktur:**
```json
{
  "value": "dunkel",
  "label": "Dunkel",
  "description": "Elegantes Dunkelblau",
  "card_type": "color",
  "color": "#0F172A",
  "image_url": ""
}
```
`card_type` kann `"color"`, `"image"` oder `"text"` sein.

### Zusammengesetztes Feld

| Typ | Beschreibung | Besonderheiten |
|---|---|---|
| `loop` | Wiederholbare Einträge (z.B. Links-Liste) | `sub_fields`, `min_items`, `max_items` |

**`sub_fields`-Typen:** `text`, `textarea`, `image`, `url`, `email`, `dropdown`

---

## 3. Template-Dateistruktur

Jedes Template in R2 besteht aus mindestens:

```
templates/{template_id}/
├── index.html      ← Pflicht, enthält Platzhalter-Syntax
├── style.css       ← Optional, aber empfohlen (via <link rel="stylesheet">)
└── script.js       ← Optional (via <script src="...">)
```

- `index.html` ist der Einstiegspunkt (`r2_bundle_path` in der DB zeigt darauf)
- Alle Assets werden relativ geladen — der Worker serviert sie aus demselben R2-Pfad
- Externe CDN-Links (z.B. Google Fonts, GSAP) sind erlaubt

---

## 4. Formulare

### 4.1 Was ist nötig

Zwei Dinge müssen zusammenpassen:

| Was | Wo |
|---|---|
| `<form action="/.finestsites/forms/{form_name}">` | `index.html` im Template |
| Schema-Eintrag mit `form_name` | Admin-Panel → Template → Formulare-Tab (oder direkt in `form_schemas`) |

Der `form_name` (z.B. `kontakt`) ist das einzige Bindeglied zwischen HTML und Datenbank.

### 4.2 Minimales Formular-HTML

```html
<form action="/.finestsites/forms/kontakt" method="POST">
  <!-- Honeypot gegen Spam — immer einbauen -->
  <input type="text" name="_honeypot" style="display:none" tabindex="-1" autocomplete="off">

  <input type="text"  name="name"     required placeholder="Dein Name">
  <input type="email" name="email"    required placeholder="deine@email.de">
  <textarea           name="nachricht" required></textarea>
  <button type="submit">Absenden</button>
</form>
```

### 4.3 AJAX-Submit (empfohlen — kein Seitenneuladen)

```js
form.addEventListener('submit', function(e) {
  e.preventDefault()
  var body = {}
  new FormData(form).forEach(function(v, k) { body[k] = v })

  fetch(form.action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',   // ← Worker antwortet mit JSON statt Redirect
    },
    body: JSON.stringify(body),
  })
  .then(function(r) {
    if (!r.ok) throw new Error()
    // Erfolg: Formular ausblenden, Success-State zeigen
  })
  .catch(function() {
    // Fehler: Button wieder aktivieren
  })
})
```

**Ohne `Accept: application/json`** leitet der Worker nach dem Submit auf `/?submitted=1` weiter (klassisches Form-Verhalten).

> ⚠️ **Wichtig – Payload-Format:**
> `FormSubmission.data` ist `Record<string, string>` — **alle Werte müssen Strings sein**.
> Verschachtelte Objekte oder Arrays werden im Admin-Panel als `[object Object]` dargestellt und können Client-seitige Fehler verursachen.
>
> **Falsch:** `{ scores: { traege: 3, sensibel: 1 } }`
> **Richtig:** `{ score_traege: "3", score_sensibel: "1" }`
>
> Auch Zahlen als Strings senden: `alter: String(slider.value)` statt `alter: 35`.

### 4.4 Honeypot-Feld

**Pflicht.** Felder mit dem Namen `_honeypot` werden vom Worker geprüft. Ist der Wert nicht leer (von Bots ausgefüllt), wird die Submission als Spam markiert (`is_spam = true`) — sie wird zwar gespeichert, aber nicht im Dashboard angezeigt und löst keine E-Mail aus.

### 4.5 Felder-Namen

Die `name`-Attribute der Inputs sind frei wählbar. Sie werden 1:1 als Keys im `data`-JSONB-Objekt gespeichert. Das Schema im Admin-Panel definiert diese Keys zur Anzeige im Dashboard — es findet keine serverseitige Validierung der Feldnamen statt.

### 4.6 E-Mail-Benachrichtigung

Wenn `email_notification_enabled: true` im Schema gesetzt ist, sendet der Worker nach jeder nicht-Spam-Submission eine E-Mail an die Adresse des Website-Besitzers. Die E-Mail wird fire-and-forget über Resend gesendet (`ctx.waitUntil`) — der Besucher bekommt sofort eine Antwort, unabhängig davon ob die E-Mail erfolgreich war.

### 4.7 Mehrere Formulare in einem Template

Kein Problem — einfach verschiedene `form_name`-Slugs verwenden:

```html
<form action="/.finestsites/forms/kontakt" ...>   <!-- Kontaktformular -->
<form action="/.finestsites/forms/bewerbung" ...> <!-- Bewerbungsformular -->
```

Für jeden Slug einen eigenen Schema-Eintrag im Admin-Panel anlegen.

---

## 5. Schema-Aufbau (JSON)

Das `placeholder_schema`-JSON hat folgende Struktur:

```json
{
  "version": 1,
  "fields": [
    {
      "key": "name",
      "label": "Name",
      "type": "text",
      "section": "Profil",
      "order": 0,
      "required": true,
      "placeholder_text": "z. B. Max Mustermann",
      "default_value": "",
      "max_length": 60,
      "min_items": 1,
      "max_items": null,
      "options": [],
      "card_options": [],
      "sub_fields": [],
      "aspect_ratio": "free"
    }
  ],
  "preview_values": {
    "name": "Max Mustermann"
  }
}
```

**Pflichtfelder pro Feld:** `key`, `label`, `type`, `required`, `order`

**`preview_values`** — optionale Vorschau-Werte für den Editor (werden nicht gespeichert).

### Loop-Feld vollständig:

```json
{
  "key": "links",
  "label": "Links",
  "type": "loop",
  "section": "Links",
  "order": 5,
  "required": false,
  "min_items": 1,
  "max_items": 20,
  "sub_fields": [
    { "key": "url",    "type": "url",  "label": "URL",   "required": true,  "max_length": null },
    { "key": "titel",  "type": "text", "label": "Titel", "required": true,  "max_length": 60   },
    { "key": "beschreibung", "type": "text", "label": "Beschreibung", "required": false, "max_length": 100 }
  ]
}
```

---

## 6. Deployment-Workflow

### Neues Template anlegen

1. Dateien erstellen: `index.html`, `style.css`, `script.js`
2. In R2 hochladen:
   ```bash
   cd cloudflare-worker
   npx wrangler r2 object put "finestsites-templates/templates/{id}/index.html" \
     --file ./index.html --content-type "text/html; charset=utf-8" --remote
   ```
3. In der DB eintragen (`templates`-Tabelle): `title`, `domain`, `r2_bundle_path`, `placeholder_schema`
4. Formulare im Admin-Panel unter dem Template konfigurieren

### Template-Dateien aktualisieren

```bash
cd cloudflare-worker
# HTML
npx wrangler r2 object put "finestsites-templates/templates/{id}/index.html" \
  --file ./index.html --content-type "text/html; charset=utf-8" --remote
# CSS
npx wrangler r2 object put "finestsites-templates/templates/{id}/style.css" \
  --file ./style.css --content-type "text/css; charset=utf-8" --remote
# JS
npx wrangler r2 object put "finestsites-templates/templates/{id}/script.js" \
  --file ./script.js --content-type "application/javascript; charset=utf-8" --remote
```

**Achtung:** Der KV-Cache (TTL 5 Minuten) kann alte Versionen ausliefern. Nach einem Update kurz warten oder beim Nutzer neu publishen lassen.

### Template-ID der Demo-Seite (Linktree)

```
dbeeb47d-109f-48dd-ae0f-96f59f1f586a
```

---

*Letzte Aktualisierung: 2026-04-13*
