# Checkliste: Neues Template hinzufügen

Diese Liste MUSS Punkt für Punkt abgearbeitet werden, sonst gehen Dinge
schleichend kaputt (E-Mails kommen nicht an, Preview zeigt nichts, Publish
scheitert, KI-Compliance-Check fehlt, etc.). Nach jedem Template durchgehen.

---

## 1. Template-HTML im Repo

- [ ] `templates/{slug}/index.html` anlegen
- [ ] Dual-DOM DE/EN (`.l-de` / `.l-en` Spans), wenn zweisprachig
- [ ] Sprachumschalter oben rechts, wenn zweisprachig
- [ ] Contact-Form mit **exakt diesen 3 hidden Feldern**:
  ```html
  <form action="/.finestsites/forms/kontakt" method="POST">
    <input type="hidden" name="_recipient" value="{{email_benachrichtigung}}">
    <input type="text" name="_honeypot" style="position:absolute;left:-9999px;opacity:0" tabindex="-1" autocomplete="off">
    <!-- optional: <input type="hidden" name="_redirect" value="..."> -->
  </form>
  ```
  **Fehlt `_recipient`, kommt keine Benachrichtigungs-Mail an.**
- [ ] About-me H2 flach mit `<span class="l-de">{{{about_intro_de_html}}}</span><span class="l-en">{{{about_intro_en_html}}}</span>` (nicht mit verschachtelten Konditionalen — der Parser stolpert!)
- [ ] Impressum/Datenschutz-Links auf Worker-Routen `/impressum` und `/datenschutz`
- [ ] Alle CTAs verwenden **starke Verben** ("Jetzt loslegen", nicht "Kontakt aufnehmen")

## 2. Placeholder-Schema

- [ ] `templates/{slug}/placeholders-schema.json` anlegen
- [ ] Pflichtfelder: `vorname`, `nachname`, `email_benachrichtigung`, `about_bild`, `about_intro` (type: `intro`), `about_me_html`, `farbthema`
- [ ] `about_intro` `order: 17.5`
- [ ] `about_me_html` `order: 18` (immer über/nach `about_intro`, nie ohne `order` — fällt sonst auf 0 zurück und rutscht in der Hierarchie hoch)
- [ ] **KI-Compliance-Check** auf `about_me_html` einschalten (Abmahn-Schutz):
  ```json
  { "key": "about_me_html", "type": "richtext", "compliance_check": true, ... }
  ```
- [ ] Bei zweisprachigen Templates: `tags: ["multilingual"]` (steuert die DE/EN-Flaggen auf der Startseite)

## 3. Datenbank: `templates`-Row

- [ ] `title` gesetzt
- [ ] `description` gesetzt (wird im Vorlagen-Grid gezeigt)
- [ ] `domain` gesetzt (z. B. `cellrestart.net`)
- [ ] `slug` gesetzt
- [ ] `r2_bundle_path` = `templates/{templateId}/index.html`
- [ ] `preview_images` = `["/previews/{slug}.jpg"]` — **Bild muss auch in `public/previews/` existieren**
- [ ] `placeholder_schema` = JSON-Schema (aus Datei importieren oder Admin-UI)
- [ ] `is_test = false` (für alle User sichtbar)
- [ ] `is_free = false` (kostet Kontingent) oder `true` (kostenlos)
- [ ] `status = 'published'`
- [ ] `sort_order` sinnvoll (10/20/30 = published, 40+ = coming soon)
- [ ] `badge` optional ("NEU", "Beta", …)
- [ ] `tags` gesetzt (mind. `multilingual` bei DE+EN)

## 4. Datenbank: `form_schemas`-Row (für E-Mail-Benachrichtigung)

Fehlt der Row komplett, funktioniert die E-Mail immer noch (fallback auf accountEmail),
aber die Betreff-Zeile bleibt roh (`kontakt` statt `Kontaktanfrage {template}`) und
die Field-Labels in der Mail sind unstyled.

- [ ] Row anlegen:
  ```sql
  INSERT INTO form_schemas (template_id, form_name, title, fields, email_notification_enabled)
  VALUES (
    '{templateId}',
    'kontakt',
    'Kontaktanfrage {Template-Name}',
    '[{"key":"name","label":"Name"},{"key":"email","label":"E-Mail"}, …]'::jsonb,
    true
  );
  ```

## 5. R2-Uploads (immer mit `--remote`!)

Wichtig: **`wrangler r2 object put` ohne `--remote` schreibt in einen lokalen
Dev-Bucket und meldet „Upload complete" — der echte R2-Bucket bleibt leer.**

```bash
ssh root@187.124.187.228 "cd /var/www/finestsites/cloudflare-worker && CLOUDFLARE_API_TOKEN=... npx wrangler r2 object put finestsites-templates/templates/{ID}/index.html --file=/var/www/finestsites/templates/{slug}/index.html --content-type='text/html; charset=utf-8' --remote"
```

- [ ] `templates/{templateId}/index.html` hochgeladen
- [ ] Alle Assets (Bilder, Fonts, JS) unter `templates/{templateId}/assets/**/*` hochgeladen (`--recursive` ist NICHT unterstützt — pro Datei einzeln oder Loop)

## 6. Cloudflare-DNS + Worker-Route

Nur nötig wenn eine **neue Template-Domain** ins Spiel kommt.

- [ ] CF Dashboard: Proxied Wildcard-A-Record `*.domain.tld → 192.0.2.1` in der Zone anlegen
- [ ] `cloudflare-worker/wrangler.toml`: `[[routes]]`-Eintrag + `zone_id` hinzufügen
- [ ] Vom VPS deployen: `npx wrangler deploy --config wrangler.toml` (`--config wrangler.toml` ist Pflicht, sonst kapert `wrangler.jsonc` im Repo-Root den Deploy)
- [ ] Health-Check: `curl https://test.domain.tld/.finestsites/health` → 200

## 7. Preview-Image für Startseite + Vorlagen-Seite

- [ ] Screenshot von `demo.domain.tld` mit puppeteer-core, 1280×800 mit 2× DPR
- [ ] Downscale auf 1280×800 mit `sips -Z 1280 out.jpg`
- [ ] Als `public/previews/{slug}.jpg` speichern
- [ ] Commit + push + `finestsites-deploy.sh` (damit `/public` neu ausgeliefert wird)

## 8. Deploy-Reihenfolge (Kritisch!)

1. `git push origin main`
2. `ssh root@187.124.187.228 "/usr/local/bin/finestsites-deploy.sh"`
3. R2-Upload mit `--remote` (VPS git-pull ist automatisch im Deploy-Skript)
4. Worker-Deploy nur wenn Worker-Code geändert wurde
5. KV purge für alle Demo/Test-Hosts: `POST /.finestsites/kv {"action":"purge"}` mit `Authorization: Bearer {WORKER_SECRET}`

## 9. Verifikation (Live!)

- [ ] Startseite finestsites.io: neues Template erscheint im Grid, mit richtigem Preview-Bild, mit Flaggen (bei zweisprachigen)
- [ ] Vorlagen-Seite /vorlagen: erscheint dort
- [ ] Live-Site `demo.domain.tld`: rendert korrekt (H2 nicht leer, Nav-Links klicken, Sprachumschalter funktioniert)
- [ ] **Contact-Form-Submit**: Kurz Test-Submit machen und prüfen dass Benachrichtigungs-E-Mail an `email_benachrichtigung` ankommt
- [ ] Editor öffnet Template, alle Felder rendern, Autosave funktioniert
- [ ] Publish-Flow funktioniert (auf Test-Account durchklicken)
- [ ] KI-Compliance-Check greift bei `about_me_html` (roter Warnhinweis wenn Heilaussage getippt)

---

**Wenn ein Punkt übersprungen wird, hier festhalten warum** — die Liste
ist bewusst konservativ; kein Punkt ist zufällig drin.
