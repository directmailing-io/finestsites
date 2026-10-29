# Besucher-Chat (Seitenbesucher ↔ Seitenbetreiber)

Stand: 22.10.2026. Erst nur für das Konto `demo` freigeschaltet, jederzeit zentral abschaltbar.

## Ziele

- Besucher einer Kundenseite sehen ein hochwertiges Chat-Symbol und können direkt mit dem Betreiber chatten; Gefühl wie WhatsApp (Blasen, Haken, Tag-Trenner, Links anklickbar, „online“).
- Angaben Name / E-Mail / Telefon (WhatsApp) sind **freiwillig**. Hat der Betreiber eine WhatsApp-Nummer in seiner Seite hinterlegt, zeigt der Chat „Schreib mir direkt in WhatsApp“.
- Ein Besucher findet sein Gespräch beim nächsten Besuch wieder (gleicher Browser automatisch; anderes Gerät über den Link in der Antwort-Mail).
- Betreiber sehen in App **und** Web-Dashboard einen Bereich „Chats“ (Liste wie WhatsApp/Messenger), ungelesene Nachrichten sofort (Badge am Tab, App-Symbol), Push-Mitteilung, sobald Push eingeschaltet ist.
- Apple-/Google-Vorgaben für nutzergenerierte Inhalte: Filter, Melden, Sperren, Kontakt (siehe unten).

## Schalter (Notaus)

`app_settings`:

| Schlüssel | Wert | Wirkung |
|---|---|---|
| `visitor_chat_enabled` | `true` / fehlt = aus | Globaler Hauptschalter |
| `visitor_chat_users` | `demo` (Kommaliste von Benutzernamen) | Nur diese Konten |

Helfer: `src/lib/chat/flags.ts` → `isVisitorChatEnabledForUser(userId)`, `isVisitorChatEnabledForUsername(username)`, 30 s Cache wie `readAppSettings`.

Wirkung beim Abschalten (doppelte Sicherung):
1. `GET /api/worker/site-meta` liefert `chat` nicht mehr → der Worker hängt das Skript nicht mehr an (SiteMeta-Cache 60 s).
2. Der Widget-Aufruf `GET /.finestsites/chat/config` antwortet `enabled:false` → ein bereits geladenes Skript zeigt nichts. Alle Besucher-Endpunkte antworten 404 bei ausgeschaltetem Chat.
3. App/Web: `MeResponse.features.visitorChat=false` → Bereich „Chats“ verschwindet; Endpunkte antworten `FEATURE_DISABLED`.

Admin: Seite `/admin/besucher-chat` (nur Admin) mit Ein/Aus und Benutzerliste (schreibt die beiden Schlüssel).

## Datenmodell (`supabase/migrations/20261022200000_visitor_chat.sql`)

```
chat_conversations
  id uuid pk, user_id uuid → users (cascade), site_id uuid → user_sites (cascade)
  visitor_token_hash varchar(64) not null        -- sha256 des Browser-Tokens
  visitor_name text, visitor_email text, visitor_phone text, notify_by_email bool default false
  visitor_key varchar(8) not null                 -- Kurzkennung für „Besucher 4F2A“ (aus dem Hash)
  status text not null default 'open'             -- open | archived | blocked
  started_on_path text, user_agent text, ip_hash varchar(64)
  owner_unread int not null default 0, visitor_unread int not null default 0
  last_message_at timestamptz, last_message_preview text, last_message_sender text
  visitor_last_seen_at timestamptz, owner_last_seen_at timestamptz
  reported_at timestamptz, report_reason text
  visitor_notified_at timestamptz                 -- Drossel der Antwort-Mail
  created_at, updated_at
  unique (site_id, visitor_token_hash)
  index (user_id, status, updated_at desc), index (site_id, visitor_token_hash)

chat_messages
  id uuid pk, conversation_id uuid → chat_conversations (cascade)
  sender text not null ('visitor'|'owner'|'system'), body text not null (≤ 2000)
  client_id varchar(64), created_at timestamptz default now(), read_at timestamptz
  unique (conversation_id, sender, client_id) where client_id is not null
  index (conversation_id, created_at)

chat_blocks
  id uuid pk, user_id uuid → users (cascade)
  visitor_token_hash varchar(64), ip_hash varchar(64), reason text, created_at
  index (user_id, visitor_token_hash), index (user_id, ip_hash)

chat_resume_tokens
  token_hash varchar(64) pk, conversation_id uuid → chat_conversations (cascade)
  expires_at timestamptz not null, used_at timestamptz
  kind text not null default 'reply'              -- reply | handoff | handoff_mail (Migration 20261022230000)

chat_visitor_tokens                                -- weitere Browser-Token je Gespräch (Migration 20261022230000)
  token_hash varchar(64) pk, conversation_id uuid → chat_conversations (cascade)
  created_at, last_used_at

chat_conversations: + resume_code varchar(8)       -- Gesprächs-Code (Migration 20261022250000), unique (site_id, resume_code)

notification_preferences: + chat boolean not null default true
```

Alle Tabellen: `GRANT SELECT, INSERT, UPDATE, DELETE … TO finestsites` (wie in `20261021120000_native_app_push.sql`).

Aufbewahrung: Cron `GET /api/cron/chat-cleanup` (Bearer `CRON_SECRET`, täglich): Gespräche ohne Nachricht seit 180 Tagen löschen, abgelaufene Resume-Tokens löschen, Sperren älter als 365 Tage löschen.

## Besucher-API (Widget → Worker → App)

Das Widget spricht **nur same-origin** `/.finestsites/chat/*` auf der Kundenseite. Der Worker leitet an `${APP_URL}/api/worker/chat/*` weiter und setzt Header:

```
x-worker-secret: <WORKER_SECRET>
x-fs-site-id: <meta.siteId>
x-fs-host: <hostname>
x-fs-ip-hash: <hashIP(ip)>
x-fs-ua: <User-Agent, gekürzt 200>
x-fs-visitor: <Besucher-Token, aus Header X-FS-Visitor des Widgets>
```

Der Worker reicht nie den echten IP durch. Antworten des App-Servers werden 1:1 zurückgegeben (JSON, `Cache-Control: no-store`). Bei Fehler des App-Servers antwortet der Worker `503 {"error":"unavailable"}`.

| Pfad (Widget) | App-Route | Zweck |
|---|---|---|
| `GET  /.finestsites/chat/widget.js` | `GET /chat-widget/v1.js` (statisch, `public/`) | Skript, Worker-Cache 5 min |
| `GET  /.finestsites/chat/config` | `GET /api/worker/chat/config` | `{enabled, owner:{name, avatarUrl, brandColor}, whatsappUrl, welcome, siteHost}` |
| `POST /.finestsites/chat/session` | `POST /api/worker/chat/session` | Body `{visitorToken?, resumeToken?, pageUrl?}` → `{enabled, conversationId, visitorToken, status, visitor:{name,email,phone,notifyByEmail}, messages:[…letzte 50], ownerLastSeenAt}` |
| `GET  /.finestsites/chat/messages?after=<id>[&wait=1..25]` | `GET /api/worker/chat/messages` | Polling; mit `wait` **Long-Polling** (seit 22.10.2026 abends): Antwort erst bei Änderung (neue Nachricht, Lesebestätigung, Status) oder nach `wait` s – je 2 s ein Primärschlüssel-Lookup statt voller Abfragen; aktualisiert `visitor_last_seen_at` (max. alle 20 s); liefert `{messages, status, ownerLastSeenAt, ownerReadAt}` |
| `POST /.finestsites/chat/messages` | `POST /api/worker/chat/messages` | `{body, clientId, pageUrl?}` → `{message}`; 422 `MESSAGE_REJECTED` (Filter), 429 `RATE_LIMITED`, 403 `BLOCKED` |
| `POST /.finestsites/chat/read` | `POST /api/worker/chat/read` | Betreiber-Nachrichten als gelesen |
| `POST /.finestsites/chat/profile` | `POST /api/worker/chat/profile` | `{name?, email?, phone?, notifyByEmail?}` → `{visitor}` |
| `POST /.finestsites/chat/resume` | `POST /api/worker/chat/resume` | `{code, visitorToken}` → ConversationState (Gesprächs-Code, s. u.) |

Token-Regeln:
- `visitorToken`: 32 Byte Zufall, vom Widget erzeugt (`crypto.getRandomValues`), im Browser **erst ab der ersten gesendeten Nachricht** gespeichert (localStorage `fs_chat_token`, Fallback Cookie `fs_chat_token`, 180 Tage, SameSite=Lax). Server speichert nur sha256.
- Ohne Token darf `session` nur `enabled`/Konfiguration liefern; erst `POST messages` ohne bekanntes Gespräch legt eines an (Token dann Pflicht).
- `resumeToken` (Link aus der Antwort-Mail `https://<host>/?fs_chat=<token>`, 30 Tage, `kind='reply'`; Übergabe-Link 7 Tage, `kind='handoff'|'handoff_mail'`): einmalig, hashed; `session` mit gültigem Token hängt den neuen `visitorToken` als **weiteren Zugang** (`chat_visitor_tokens`, seit 22.10.2026 abends) an das Gespräch – der bisherige Browser behält seinen Zugang – und markiert den Token benutzt. Ein Token zeigt immer auf genau ein Gespräch; hatte der neue Browser auf derselben Seite schon ein eigenes Gespräch, wird dessen Token-Hash verwaist (`orphan:`).

### Übergabe zwischen Browsern (`POST /.finestsites/chat/handoff`, seit 22.10.2026)

Problem: Instagram/Facebook/TikTok öffnen Seiten im eigenen In-App-Browser mit eigenem Speicher. Beginnt ein Besucher dort den Chat und öffnet die Seite später in Safari/Chrome, fehlt der Token. Lösung:

| Body | Antwort |
|---|---|
| `{ via: 'link', pageUrl }` | `{ url: 'https://<host><pfad>?fs_chat=<token>', expiresAt }` – Token 7 Tage, einmalig; Pfad = `pathOf(pageUrl)` auf dem Host der Anfrage; 20 Links/h je IP-Hash |
| `{ via: 'email' }` | `{ ok: true }` – Link per Mail (`chatHandoffEmail`, Typ `chat_handoff`, Kategorie system) an `visitor_email`; 400 `NO_EMAIL`, 429 ab der 4. Mail je Gespräch und 24 h, 502 `MAIL_FAILED` |

Beide: 400 `TOKEN_REQUIRED`/`VALIDATION_FAILED`, 403 `BLOCKED`, 404 `NO_CONVERSATION`. Sperren (`chat_blocks`) erfassen alle Token-Hashes eines Gesprächs (ursprünglicher + Aliase).

### Gesprächs-Code (`POST /.finestsites/chat/resume`, seit 22.10.2026 nachts)

Idee (Daniel): Jedes Gespräch hat einen Code, mit dem der Besucher es nach Verlust des Browser-Speichers (Safari geleert, anderes Gerät, In-App-Browser) wieder öffnen kann – ohne Link, ohne E-Mail. Der Betreiber sieht den Code in App/Web und kann ihn dem Besucher nennen (z. B. „ich finde unseren Chat nicht mehr“ per WhatsApp).

- **Format:** 8 Zeichen aus `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (kein 0/O, 1/I/L), angezeigt `7K4M-2P9X`. Eingabe egal in Groß-/Kleinschreibung, Bindestrich/Leerzeichen optional. 31^8 ≈ 8,5 · 10^11 Möglichkeiten je Seite – 4–5 Ziffern wären in Minuten erratbar gewesen (der Code ist faktisch das Passwort zum Gespräch: Name, Telefon, Gesundheitsthemen).
- **Speicherung:** `chat_conversations.resume_code` im Klartext (anders als Token-Hashes), weil der Betreiber ihn sehen soll; wer die DB hat, hat ohnehin die Gespräche. Eindeutig je Seite; Code zur Anlage des Gesprächs erzeugt (`createConversation`), Altbestand per Migration/`ensureResumeCode`.
- **Gültigkeit:** nicht einmalig; bis **90 Tage** nach der letzten Nachricht (`isResumeCodeValid`), bei `blocked` nie. Der Betreiber kann jederzeit einen neuen Code erzeugen (`POST /api/app/v1/chat/conversations/[id]/code`) – der alte gilt sofort nicht mehr, bekannte Browser behalten ihren Zugang.
- **Einlösen:** Body `{ code, visitorToken }`, Ticket Pflicht. Dieser Browser wird als weiterer Zugang angehängt (`attachVisitorToken`, gleicher Kern wie Resume-/Übergabe-Link; frisches eigenes Gespräch des Browsers wird verwaist). Antwort = `ConversationState` wie `session` (inkl. `resumeCode`). Fehler: 400 `TOKEN_REQUIRED`/`VALIDATION_FAILED`, 403 `BLOCKED`/`TICKET_*`, 404 `CODE_INVALID` (immer 404 – verrät nicht, ob ein Gespräch existiert), 410 `CODE_EXPIRED`, 429 `RATE_LIMITED`.
- **Drossel:** 5 Eingaben je IP-Hash und 10 Minuten (`allowResumeCodeAttempt`, jeder Versuch zählt). Keine Sperre je Seite – die würde echte Besucher aussperren; bei 31^8 reicht die IP-Bremse (1.000 IPs × 720 Versuche/Tag ≈ 0,0001 % des Raums).
- **Transparenz:** Kommt ein neuer Browser per Code **oder** Übergabe-Link dazu, steht im Verlauf eine Systemzeile `sender='system'` „Gespräch auf einem weiteren Gerät geöffnet.“ (`DEVICE_ADDED_TEXT`, `addSystemMessage`) – kein Push, kein ungelesen, keine Vorschau. Beide Seiten sehen sie. `addSystemMessage` setzt `updated_at`, und `updated_at` gehört zum Long-Poll-Snapshot: der schon offene Browser bekommt die Zeile sofort statt erst nach ≤ 25 s (live am 22.10.2026 so gefunden und behoben).
- `session` und `POST messages` liefern `resumeCode` (das Widget zeigt die Karte sofort nach der ersten Nachricht).

Widget: erkennt In-App-Browser am User-Agent (`Instagram|FBAN|FBAV|FB_IAB|FB4A|Threads|Barcelona|TikTok|musical_ly|Snapchat|LinkedInApp|Pinterest|Line/`) und zeigt nach der ersten Nachricht eine Hinweiskarte „In Safari öffnen“ / „Im Browser öffnen“ + „Link kopieren“. iOS: `history.replaceState` auf die Link-URL (damit auch Instagrams ⋯-Menü „In Safari öffnen“ den Token mitnimmt), dann `window.open('x-safari-https://…')`; Android: `intent://…#Intent;scheme=https;end`; nach 1,2 s ohne Wechsel Fallback mit Link-Feld. In der Profilkarte bei hinterlegter E-Mail „Chat-Link per E-Mail schicken“. Der Token wird nie ohne Klick in die URL geschrieben.
- Gesperrte Besucher (Token-Hash **oder** IP-Hash in `chat_blocks` des Betreibers): alle Endpunkte 403 `BLOCKED`; das Widget zeigt „Dieser Chat ist nicht verfügbar.“ und bietet nur noch WhatsApp/E-Mail an, falls vorhanden.

Ratenbegrenzung und Spam-Schutz (`src/lib/chat/rate-limit.ts`, `ticket.ts`; Stand 22.10.2026 abends):
- **Ticket-Handshake:** `POST session` liefert `ticket` (HMAC, 2 h, an die Seite gebunden); `POST messages|profile|handoff|read` nur mit Header `X-FS-Ticket` (Worker reicht `x-fs-ticket` weiter), sonst 403 `TICKET_REQUIRED`/`TICKET_INVALID`. Skripte, die direkt auf `messages` feuern, scheitern.
- **Honigtopf:** verstecktes Feld `website` in der Profilkarte → Body `hp`; gefüllt = Bot → scheinbar 200, nichts gespeichert, kein Push.
- **Automatisierung:** `wd: navigator.webdriver` → Nachrichten je Gespräch nur 5 statt 20 pro 10 min (nicht blockiert: Tests, Hilfstechnik).
- **Automatische Sperre:** 5 vom Filter abgelehnte Nachrichten je Besucher-Token in 10 min → `chat_blocks` (Grund „automatisch: Filter mehrfach ausgelöst“), danach überall 403 wie bei „Besucher sperren“; der Betreiber kann sie unter „Gesperrt“ aufheben.
- **Grenzen:** je Besucher-Token 120 Aufrufe/min (Polling), je IP-Hash 600/min mit Token bzw. 60/min ohne (Mobilfunk teilt IPs); neue Gespräche je IP 10/h **und je Webseite 30/h, 150/Tag** (Schutz des Betreibers vor Fluten); Nachrichten je Gespräch 20 pro 10 min, frühestens alle 1,5 s; Übergabe-Links 20/h je IP, Übergabe-Mails 3/Tag je Gespräch. Zähler sind je PM2-Prozess (2×) und leeren sich beim Deploy.
- **Außenhülle (empfohlen, noch nicht eingerichtet):** Cloudflare-Rate-Limiting-Regel je Zone (Free: 1 Regel) auf `POST /.finestsites/chat/*`, z. B. 30 Anfragen/10 s je IP → 1 min blockieren. Der API-Token in `.env.local` hat dafür keine WAF-Rechte; im Dashboard anlegen oder Token um „Zone WAF: Edit“ erweitern.
- `visitor_last_seen_at` wird höchstens alle 20 s geschrieben (Polling alle 3 s wäre sonst ein UPDATE je Poll).

Seiten-Schalter (seit 22.10.2026 abends): `user_sites.visitor_chat_enabled` (Standard true, Migration 20261022240000), Editor-Karte „Besucher-Chat“ nur wenn das Konto freigeschaltet ist; API `GET|PUT /api/sites/[id]/chat` → `{available, enabled}`. Wirkt über `site-meta` (Skript-Injektion) und `resolveVisitor` (config → `enabled:false`, übrige Endpunkte 404) binnen ≤ 60 s.

Push-Pause: hat der Betreiber das Gespräch in den letzten 20 s abgerufen (`owner_last_seen_at`, die App ruft alle 3 s ab), entfällt der Push (`OWNER_ACTIVE_MS` in `src/lib/push/triggers.ts`); die App unterdrückt zusätzlich das Banner, wenn genau dieses Gespräch sichtbar ist.

Filter (`src/lib/chat/filter.ts`): Länge ≤ 2000, max. 3 Links, Sperrliste grober Beleidigungen/Drohungen DE/EN (kleine, gepflegte Liste), Wiederholung derselben Nachricht 3× hintereinander → 422 `MESSAGE_REJECTED` mit neutraler Meldung „Diese Nachricht kann nicht gesendet werden.“ Gilt für Besucher **und** Betreiber.

Antwort-Mail an den Besucher (`src/lib/chat/notify.ts`): nur wenn `visitor_email` gesetzt **und** `notify_by_email=true` **und** der Besucher seit ≥ 2 min nicht online war **und** `visitor_notified_at` älter als 30 min (oder null). Inhalt: „{Betreibername} hat dir geantwortet“ + Vorschau (gekürzt 140) + Knopf „Chat öffnen“ (Resume-Link) + Hinweis, wie man sich abmeldet (Link mit `?fs_chat=<token>&unsubscribe=1` setzt `notify_by_email=false`). Layout `layout()` aus `src/lib/email/templates.ts`, Kategorie `system`, Absender wie Formular-Benachrichtigungen, Reply-To **nicht** die Betreiber-Adresse (Besucher antwortet im Chat). Lokal/Test: kein Versand (Resend-Dummy).

## Betreiber-API

`src/lib/contracts/app-v1/chat.ts` (verbindlich). Routen unter `src/app/api/app/v1/chat/…`, Auth `requireAppUser` (Bearer **und** Cookie-Sitzung funktionieren). Jede Route prüft zuerst `isVisitorChatEnabledForUser` → sonst `FEATURE_DISABLED`.

- Senden durch den Betreiber: `owner_unread` unberührt, `visitor_unread+1`, `last_message_*`, ggf. Antwort-Mail (siehe oben).
- Besucher-Nachricht: `owner_unread+1`, Push `pushTriggers.newChatMessage(conversationId)` (Kategorie `chat`, **seit 22.10.2026 abends wie WhatsApp:** Titel = Anzeigename des Besuchers, Untertitel (iOS) = Titel der Webseite, Text = Nachricht gekürzt auf 160 Zeichen; `data: {type:'chat_message', url:'finestsites://chats/<id>', conversationId, subtitle}`, `collapseKey: chat:<id>`, `throttleSeconds: 5`). Versand sofort nach dem Einreihen (`scheduleImmediateDrain` in `src/lib/push/enqueue.ts`), der Minuten-Cron bleibt als Netz. Besucherdaten auf dem Sperrbildschirm sind damit sichtbar – gewollt (Daniel), in iOS systemweit über „Vorschauen zeigen“ abschaltbar.
- `overview.unread.chat` = Summe `owner_unread` offener Gespräche (0 wenn nicht freigeschaltet); Todo `unread_chats` mit count.
- `me.features.visitorChat`.
- Melden: speichert `reported_at`/`report_reason`, sendet Mail an **info@finestsites.io** (Betreff „Chat gemeldet: <Grund>“, Konto, Seite, Gesprächs-ID, letzte 20 Nachrichten), optional Sperre. Verwendet `layout()`.
- Löschen (`DELETE …/conversations/[id]`): entfernt Gespräch + Nachrichten endgültig.
- Gesprächs-Code: `ChatConversation.resumeCode` („7K4M-2P9X“ | null); `POST …/conversations/[id]/code` → neuer Code (ChatOkResponse mit Gespräch). Web: Chip in der Kontaktzeile (Klick kopiert) + Menü „Neuen Gesprächs-Code erzeugen“. App: Menüpunkt „Gesprächs-Code 7K4M-2P9X“ → Alert „Code kopieren“ / „Neuen Code erzeugen“. Nicht bei gesperrten Gesprächen.

## Worker (`cloudflare-worker/src/chat.ts`)

- `SiteMeta.chat?: { enabled: true }` kommt aus `site-meta` (nur wenn für den Besitzer freigeschaltet).
- `injectChatWidget(html, meta)` in `finalizeHtml`: hängt `<script data-fs-chat src="/.finestsites/chat/widget.js" defer></script>` vor `</body>`; nie doppelt (`data-fs-chat`-Marker); nicht auf `/impressum`, `/datenschutz`, `/agb`.
- Route `/.finestsites/chat/*` nach `meta`-Auflösung (vor den Rechtsseiten). Nur `GET`/`POST`, JSON, `Cache-Control: no-store`, keine CORS-Freigabe nötig (same-origin).
- Datenschutzseite: eigener Abschnitt „Chat“ DE/EN, nur wenn `meta.chat?.enabled` (Text siehe unten).

## Widget (`public/chat-widget/v1.js`, Vanilla JS, kein Build-Schritt, Shadow DOM)

- **Markenfarbe = Farbe der Webseite** (seit 22.10.2026): vor dem Einhängen liest das Widget die erste gültige CSS-Variable auf `body` **und** `html` in dieser Reihenfolge: `--fs-primary`, `--primary`, `--accent`, `--green`, `--blue`, `--brand` (Werte `#rgb`, `#rrggbb`, `rgb()`, `rgba()`; ungültig/leer → nächste). Fallback `owner.brandColor`, dann `#111`. Textfarbe auf der Marke per Luminanz; sehr helle Markenfarben (Luminanz > 0,75) werden für Blasen/Knöpfe um 22 % abgedunkelt. Keine Vorlagen-IDs, nur Variablen.
- Gestaltung (seit 22.10.2026 minimal, Apple-/Linear-artig): Kopf weiß mit Hairline (1 px rgba(0,0,0,.06)), Avatar 36 px, Name 15 px/600, Statuszeile **nur bei online** (12 px grau, grüner 6-px-Punkt + „online“; sonst keine zweite Zeile, Name vertikal mittig – Kopfhöhe bleibt 64 px durch den 40-px-Schließen-Knopf, kein Springen; kein „Antwortet meist schnell“ mehr, seit 22.10.2026 abends), Schließen als graues Chevron (Handy) bzw. X (Desktop), 40 px Tapfläche. Markenfarbe nur als Akzent: eigene Blasen, Senden-Knopf, Fokus-Ring, Links in Betreiber-Blasen, Speichern-Pille. Betreiber-Blasen `#F2F3F5`/Text `#111`, Fläche weiß ohne Muster, Blasen-Radius 18 px mit 6 px an der Sprechseite (unten, nur letzte Blase einer Gruppe), Zeit 11 px rechts unten in der Blase, Häkchen daneben. Tages-Trenner und Systemmeldungen als grauer Text 12 px ohne Pille. Keine Schriften nachladen (`system-ui`).
- Start-Knopf unten rechts (56 px Kreis in Markenfarbe, Schatten `0 8px 24px rgba(0,0,0,.18)`), Chat-Glyph 26 px, rotes Badge 20 px, geöffnet → Chevron-Down, sanfte Einblendung nach 1,5 s, Tastatur-/Screenreader-tauglich (`aria-label`, `role="dialog"`, `role="log"`, Esc schließt).
- Fenster: Handy = Vollbild-Sheet (respektiert `env(safe-area-inset-*)`), Desktop = 380 × min(640 px, 100vh − 40 px) unten rechts, Radius 20, Schatten `0 24px 64px rgba(0,0,0,.18) + 0 0 0 1px rgba(0,0,0,.04)`; Öffnen 200 ms (scale .96 → 1 + fade), `prefers-reduced-motion` ohne Animation. Verlauf: Haken (✓ gesendet, ✓✓ gelesen), Tag-Trenner („Heute“, „Gestern“, Datum), Links anklickbar (`rel="noopener"`, `target="_blank"`), lange Links gekürzt, „Link kopiert“-Hinweis bei Tipp auf Kopier-Symbol neben einem Link.
- Eingabe: weiche Füllung `#F2F3F5` ohne Rahmen, Radius 22, 16 px (Desktop 15 px), mehrzeilig, Enter sendet (Shift+Enter Umbruch), Senden-Knopf 38 px Kreis in Markenfarbe (40 % Deckkraft bei leerem Feld), optimistische Anzeige mit `clientId`, Fehler als dezente rote Zeile mit „Erneut senden“. Hinweiszeile 11 px grau, „Datenschutz“ unterstrichen.
- Ehrlicher Hinweis statt Versprechen (seit 22.10.2026 abends): ganz oben im Verlauf, vor der Begrüßung, eine Systemnotiz (`.sys.note`, 12 px grau, zentriert): „Dieser Chat wird nur in diesem Browser gespeichert und kann verloren gehen, wenn du die Seite verlässt. Wichtiges schickst du mir am besten per WhatsApp oder über das Kontaktformular.“ (EN: „This chat is only stored in this browser and may be lost when you leave the page. For anything important, use WhatsApp or the contact form.“). Ohne `whatsappUrl` entfällt der WhatsApp-Teil („… am besten über das Kontaktformular.“ / „… use the contact form.“). Ob die Seite ein Kontaktformular hat, weiß das Widget nicht – Text bleibt.
- Erster Besuch: Hinweis-Notiz + Begrüßungsblase (`welcome`) + Hinweiszeile unter der Eingabe: „Nur in diesem Browser gespeichert. [Datenschutz](/datenschutz)“ (EN „Stored only in this browser.“). Kein Cookie/Storage vor dem ersten Senden (§ 25 Abs. 2 Nr. 2 TDDDG: technisch erforderlich für die ausdrücklich angeforderte Funktion).
- **Spam-Schutz im Widget** (seit 22.10.2026 abends, Server: `src/lib/chat/ticket.ts`):
  - Ticket-Handshake: `POST session` liefert `ticket` (ca. 2 h). Das Widget hält es **nur im Speicher** (nie localStorage) und schickt es als Header `X-FS-Ticket` bei `POST messages`, `profile`, `handoff`, `read` (`apiT()`); `config` und `GET messages` ohne Ticket. Vor der allerersten Nachricht (kein Token, kein Gespräch) ruft das Widget einmal `session` mit dem frischen `visitorToken`, um das Ticket zu holen – die optimistische Blase steht schon. Antwortet ein POST mit 403 `TICKET_REQUIRED`/`TICKET_INVALID`: einmal `session` neu, Aufruf wiederholen; schlägt das wieder fehl → „Nicht gesendet“ mit „Erneut senden“. Fehlt `ticket` in der Antwort (alter Server), läuft alles ohne Header weiter; nach einem fehlgeschlagenen `session` wird nicht vor jedem Senden erneut gefragt (`sessionDone`), erst bei 403.
  - Honeypot: in der Profilkarte ein unsichtbares Feld `<input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">` (per CSS aus dem Sichtbereich: `position:absolute;left:-9999px;opacity:0;height:0` – **nicht** `display:none`, sonst füllen Bots es nicht). Wert geht als `hp` im Body von `POST messages` und `POST profile` mit (leer bei Menschen); nie anzeigen, nie vorausfüllen.
  - Bot-Signal: `POST messages` enthält zusätzlich `wd: !!navigator.webdriver` (Boolean; Playwright/Selenium = true).
- Nach der ersten Nachricht: einklappbare Karte „Damit ich dich erreiche (optional)“ (eingeklappt eine Zeile 13 px grau mit Chevron; Felder `#F2F3F5` ohne Rahmen, Radius 12, Höhe 40; Toggle 36 × 22; Speichern als kleine Marken-Pille) mit Name, E-Mail, Telefon/WhatsApp und Schalter „Antworten per E-Mail erhalten“ (nur aktiv, wenn E-Mail eingetragen; Standard an, sobald eine E-Mail eingetragen wird). Speichern → `profile`. Klappt nach der ersten Nachricht einmal automatisch auf. Ist eine E-Mail gespeichert, erscheint die Textschaltfläche „Chat-Link per E-Mail schicken“ (`handoff {via:'email'}`, Toast „E-Mail ist unterwegs“ / bei 429 „Bitte später nochmal“) – nützlich Desktop → Handy.
- `whatsappUrl` vorhanden: unter der Begrüßung „Schreib mir direkt in WhatsApp“ als ruhige weiße Pille mit Hairline, WA-Glyph in `#25D366`, Text dunkel 14 px/500 (kein grüner Block). Im Gesperrt-Zustand zentriert unter „Dieser Chat ist nicht verfügbar.“
- **Übergabe aus In-App-Browsern** (`POST /.finestsites/chat/handoff`, nur mit bestehendem Gespräch): UA-Erkennung `/Instagram|FBAN|FBAV|FB_IAB|FB4A|Threads|Barcelona|TikTok|musical_ly|Snapchat|LinkedInApp|Pinterest|Line\//i`, Plattform iOS (`iPhone|iPad|iPod`) / Android. Sobald dort ein Gespräch existiert, steht am Ende des Verlaufs eine ruhige Hinweiskarte (hell, Hairline, 13 px): „Du bist im Instagram-Browser. Damit du später wieder in diesen Chat kommst, öffne ihn in Safari.“ (App-Name aus dem UA, sonst „In-App-Browser“; Android „deinem Browser“), Knöpfe „In Safari öffnen“/„Im Browser öffnen“ (Marken-Pille) und „Link kopieren“ (weiße Pille), Schließen-X → `localStorage fs_chat_handoff_dismissed=<convId>`. Primär-Knopf: `handoff {via:'link', pageUrl}` → URL; iOS: erst `history.replaceState` auf die URL mit `?fs_chat=<token>` (damit auch das ⋯-Menü „In Safari öffnen“ den Token mitnimmt), dann `window.open('x-safari-' + url)`; Android: `location.href = 'intent://…#Intent;scheme=https;end'`. Ist die Seite nach 1,2 s noch sichtbar, zeigt die Karte das Link-Feld + „Oder tippe oben rechts auf ⋯ und „In Safari öffnen“.“ Jeder Klick holt einen frischen Link (einmal einlösbar); der Link wird nie ohne Klick in die URL geschrieben; nur same-origin-URLs werden akzeptiert. „Link kopieren“: frischer Link → Zwischenablage → Toast „Link kopiert“ (schlägt die Zwischenablage fehl, erscheint das Link-Feld markiert). Die Karte erscheint nur in In-App-Browsern, nie in Safari/Chrome – auch nicht nach Einlösen eines Links.
- **Polling sparsam** (seit 22.10.2026 nachts; Anlass: ein 24 h offener Tab erzeugte mit dem alten 3/6/15-s-Timer ≈ 5.700 Anfragen):
  - **Fenster offen → Long-Poll-Schleife**: `GET messages?after=<letzteId>&wait=25`; der Server hält die Antwort bis 25 s offen und antwortet sofort bei Neuem (Nachricht, `ownerReadAt`, Status). Nach der Antwort 300 ms Pause, dann die nächste Anfrage → ≈ 140 Anfragen/Stunde im aktiven Chat (vorher 1.200). Kommt die Antwort trotz `wait` in < 1 s zurück (alter Server/Proxy ohne `wait`), wartet das Widget mindestens 3 s (Schutz vor Dauerfeuer). Nur **eine** offene Anfrage gleichzeitig (`polling`); Schließen, Verstecken (`document.hidden`) und Ruhestopp brechen sie per `AbortController` ab und entwerten die Antwort (`pollGen`). Eine eigene gesendete Nachricht bricht die laufende Anfrage **nicht** ab (die Antwort kommt über den POST); `after` wird beim nächsten Durchlauf aus `lastId()` neu gebildet. Fehler/Netzausfall: 5 → 10 → 20 → 30 s Backoff, dann weiter.
  - **Fenster geschlossen mit Gespräch**: wie bisher Timer 20 s, nach 10 min ohne Interaktion 60 s, ohne `wait`.
  - **Ruhestopp**: 15 min (offen) bzw. 30 min (geschlossen) ohne Interaktion → gar keine Anfragen mehr. Interaktion = Pointer-/Touch-/Tasten-/Eingabe-/Wheel-Ereignis im Widget, eigene Nachricht, neue Betreiber-Nachricht (nicht `scroll`, das feuert auch programmatisch). Zustand: Statuszeile leer (wie offline), ganz unten im Verlauf eine Systemnotiz `.sys.pause` (12 px, `#9CA3AF`) „Pausiert – tippe, um zu aktualisieren“ / EN „Paused – tap to refresh“. Jede Interaktion, erneutes Öffnen, `visibilitychange` → sichtbar und `window` `focus` nehmen sofort wieder auf (eine Anfrage sofort, Hinweis weg). Test-Hook: `window.__fsChatIdleMs = <ms>` setzt die Schwelle (offen = Wert, geschlossen = 2 × Wert), nur wirksam wenn gesetzt.
  - Richtwerte: aktiver Chat ≈ 140–150 Anfragen/h; untätiger offener Tab ≈ 36 Anfragen in den ersten 15 min, danach 0 → 24 h offener Tab ≈ 40 Anfragen; geschlossener Tab mit Gespräch ≈ 50 Anfragen in 30 min, danach 0.
  - Unverändert: `read` beim Öffnen und bei neuer Betreiber-Nachricht im sichtbaren Fenster; Badge am Start-Knopf = ungelesene Betreiber-Nachrichten (auch solche, die im geschlossenen Zustand eintreffen); ✓✓ (`applyOwnerRead`) und Online-Status (`ownerLastSeenAt`) aus jeder Antwort; Titel-Blinken nicht.
- `?fs_chat=<token>` in der URL → `session` mit `resumeToken`, Fenster öffnet sich, Parameter aus der URL entfernt (`history.replaceState`). `&unsubscribe=1` → `profile {notifyByEmail:false}` + Hinweis.
- **Gesprächs-Code (seit 22.10.2026 nachts):** Ohne Gespräch steht oben der Hinweis „Dieser Chat wird in diesem Browser gespeichert. Nach deiner ersten Nachricht bekommst du einen Code, mit dem du ihn auf jedem Gerät wieder öffnen kannst. Wichtiges … {via}.“ und unter dem WhatsApp-Knopf die Zeile `.rs` „Schon ein Gespräch begonnen? **Mit Code fortsetzen**“ → Feld `.ri` (Mono, Großbuchstaben, formatiert beim Tippen `XXXX-XXXX`, max. 9 Zeichen, Enter sendet) + Marken-Pille „Fortsetzen“ → `POST resume {code, visitorToken}` (Token wird bei Bedarf frisch erzeugt, nach Erfolg gespeichert). Fehler inline `.re`: 404 „Code nicht gefunden – bitte prüfen.“, 410 „Dieser Code ist abgelaufen.“, 429 „Zu viele Versuche. Bitte in 10 Minuten nochmal.“; zu kurze Eingabe ohne Serveraufruf. Erfolg: Verlauf da, Toast „Gespräch fortgesetzt“, Profilkarte gefüllt, Polling läuft. Mit Gespräch ersetzt die Karte `.cc` **„Dein Gesprächs-Code“** den Hinweis ganz oben: Code 20 px Mono in Markenfarbe (`user-select:all`), weiße Pille „Code kopieren“ (Toast „Code kopiert“), Text „Damit öffnest du dieses Gespräch auf jedem Gerät wieder – am besten einen Screenshot machen. Gib den Code nicht weiter.“ Die Karte bleibt oben im Verlauf stehen; Gestaltung setzt auf Screenshot/Kopieren, nicht auf Merken.
- Sprache: `document.documentElement.lang` beginnt mit `en` → Englisch, sonst Deutsch. Alle Texte in einem Objekt `T.de`/`T.en`.
- Kein externes Laden (keine Schriften, keine CDN); Schrift = `system-ui`. Größe ≤ 64 kB unminifiziert (`npm run check:chat-widget`; seit 22.10.2026 nachts mit Gesprächs-Code ≈ 61 kB → Limit 64 kB, davor 60-kB-Limit mit Long-Poll/Ruhestopp ≈ 55 kB, davor 56 kB ≈ 51 kB, davor 52 kB, ursprünglich 40 kB; ~5 kB davon sind Kommentare, über den Draht gzip ≈ 15 kB).
- Screenshots: `docs/chat/screenshots/01–08` (Handy 390×844 @2x, Desktop 1280×800 @2x; 07 = Instagram-Hinweiskarte, 08 = Ruhestopp „Pausiert – tippe, um zu aktualisieren“).

## App (mobile/) und Web-Dashboard

- Bereich „Chats“ nur bei `me.features.visitorChat`. App: fünfter Tab „Chats“ (Symbol `message`/`bubble.left.and.bubble.right`), Badge `overview.unread.chat`, App-Symbol-Badge zählt Chat mit. Web: Eintrag „Chats“ in Sidebar und MobileNav mit Badge (Polling `GET /api/app/v1/chat/unread` alle 30 s, wie `supportUnreadUpdate`).
- Liste (wie WhatsApp): Avatar mit Initialen in stabiler Farbe aus `visitor_key`, Name, Seitentitel klein, Vorschau (eigene Nachricht mit „Du: “), Zeit (Heute → Uhrzeit, gestern → „Gestern“, sonst Datum), ungelesen-Punkt mit Zahl, Fettdruck bei ungelesen; Suche; Filter offen/archiviert/gesperrt; Pull-to-refresh; Polling 5 s im Vordergrund.
- Gespräch: Kopf mit Avatar, Name, „online“/„zuletzt online …“, Seitenlink; Aktionen (…-Menü): Anrufen, E-Mail, WhatsApp (falls Daten), Gesprächs-Code (kopieren / neu erzeugen), Archivieren, Besucher sperren, Melden (Grund wählen), Gespräch löschen (Bestätigung). Verlauf wie WhatsApp (Tag-Trenner, Blasen, Haken ✓/✓✓ für eigene, Links anklickbar, langes Drücken = kopieren), Eingabe am unteren Rand mit Tastatur-Vermeidung, optimistisches Senden, Polling 3 s, Lesen beim Öffnen. Nie Preise/Kauf-Wörter (`check:words`).
- Push: `routeFromNotification` kennt `finestsites://chats/<id>` → Gespräch öffnen. Einstellungen: Schalter „Chat“ bei den Mitteilungen (nur sichtbar bei `features.visitorChat`).
- Mock-Modus der App bekommt 3 Beispielgespräche.

## Apple / Google (UGC)

Apple 1.2 verlangt für Apps mit nutzergenerierten Inhalten: Filter, Melden mit zeitnaher Reaktion, Sperren, veröffentlichte Kontaktdaten. Google Play „User Generated Content“: Nutzungsbedingungen vor dem Erstellen, laufende Moderation, In-App-Melden **und** -Sperren bei 1:1-Nachrichten, klar getrennte Knöpfe. Umsetzung:

- Filter: serverseitig (`filter.ts`) für beide Richtungen.
- Melden: „Melden“ im Gesprächsmenü (eigener Knopf, nicht mit Sperren vermischt), Mail an info@finestsites.io, Bearbeitung innerhalb 24 h (Admin sieht gemeldete Gespräche unter `/admin/besucher-chat`).
- Sperren: „Besucher sperren“ (Token + IP-Hash).
- Kontakt: Impressum/Datenschutz der Plattform und der Kundenseite; in der App unter „Mehr“ bereits vorhanden.
- Bedingungen: Besucher akzeptiert beim Senden den Hinweis (Datenschutz-Link); Betreiber sind an AGB gebunden (§ Inhalte). App Review Notes: Demokonto mit Beispielgesprächen.
- Keine anonyme/zufällige Chat-Vermittlung (1.1.6/1.2 Chatroulette-Verbot nicht berührt: immer Besucher ↔ konkreter Betreiber).

## Datenschutztext (Kundenseite, nur bei aktiviertem Chat)

DE: **Chat-Funktion.** Auf dieser Webseite kannst du mir über ein Chat-Fenster Nachrichten schreiben. Dabei werden deine Nachrichten, der Zeitpunkt, die aufgerufene Seite sowie – nur wenn du sie freiwillig angibst – Name, E-Mail-Adresse und Telefonnummer gespeichert. Deine IP-Adresse wird ausschließlich in gekürzter, nicht rückrechenbarer Form (Hash) zum Schutz vor Missbrauch verarbeitet. Damit du dein Gespräch beim nächsten Besuch fortsetzen kannst, speichert dein Browser eine zufällige Chat-Kennung (lokaler Speicher bzw. Cookie „fs_chat_token“, 180 Tage). Diese Speicherung ist technisch erforderlich, um die von dir ausdrücklich gewünschte Chat-Funktion bereitzustellen (§ 25 Abs. 2 Nr. 2 TDDDG); sie erfolgt erst, wenn du die erste Nachricht sendest. Zusätzlich erhält jedes Gespräch einen Gesprächs-Code, mit dem du es auf einem anderen Gerät oder in einem anderen Browser wieder öffnen kannst. Der Code wirkt wie ein Passwort für dieses Gespräch: Wer ihn kennt, kann die Nachrichten lesen und weiterschreiben. Gib ihn daher nicht weiter; er verfällt 90 Tage nach der letzten Nachricht. Rechtsgrundlage der Verarbeitung ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung bzw. Durchführung eines Vertrags oder Beantwortung deiner Anfrage) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer einfachen Kontaktmöglichkeit und am Schutz vor Missbrauch). Wenn du eine E-Mail-Adresse angibst und „Antworten per E-Mail erhalten“ aktivierst, informieren wir dich per E-Mail über neue Antworten; das kannst du jederzeit über den Link in der E-Mail oder im Chat beenden. Die Chat-Daten werden auf Servern von FinestSites (Hetzner Online GmbH, Deutschland) im Rahmen einer Auftragsverarbeitung gespeichert und 180 Tage nach der letzten Nachricht automatisch gelöscht; auf Wunsch lösche ich dein Gespräch auch früher. Für WhatsApp gilt der Abschnitt „WhatsApp“.

EN: **Chat.** You can send me messages through the chat window on this website. We store your messages, the time, the page you were on and, only if you provide them voluntarily, your name, e-mail address and phone number. Your IP address is processed only in truncated, irreversibly hashed form to prevent abuse. So you can continue your conversation on your next visit, your browser stores a random chat identifier (local storage or cookie "fs_chat_token", 180 days). This is technically necessary to provide the chat you explicitly requested (Section 25 (2) no. 2 TDDDG) and only happens once you send your first message. Each conversation also gets a conversation code that lets you reopen it on another device or in another browser. The code works like a password for this conversation: anyone who knows it can read the messages and keep writing. Do not share it; it expires 90 days after the last message. The legal basis is Art. 6 (1) (b) GDPR (initiating or performing a contract or answering your enquiry) and Art. 6 (1) (f) GDPR (legitimate interest in an easy way to get in touch and in preventing abuse). If you provide an e-mail address and enable "receive replies by e-mail", we notify you about new replies by e-mail; you can stop this at any time via the link in the e-mail or in the chat. Chat data is stored on FinestSites servers (Hetzner Online GmbH, Germany) under a data processing agreement and deleted automatically 180 days after the last message; on request I will delete your conversation earlier. For WhatsApp, see the "WhatsApp" section.

## Dateizuständigkeit (parallele Umsetzung)

| Bereich | Dateien |
|---|---|
| Backend | `supabase/migrations/20261022200000_visitor_chat.sql`, `src/lib/db/schema.ts` (nur neue Tabellen + `chat` in notification_preferences), `src/lib/chat/*`, `src/app/api/worker/chat/*`, `src/app/api/app/v1/chat/*`, `src/app/api/cron/chat-cleanup/route.ts`, `src/app/api/worker/site-meta/route.ts` (+`chat`), `src/app/api/app/v1/{me,overview,notification-preferences}` (+Felder), `src/lib/push/{triggers,preferences,enqueue}.ts` (+`chat`), `src/lib/email/templates.ts` (+2 Mails), `scripts/test-visitor-chat.ts` |
| Worker + Widget | `cloudflare-worker/src/chat.ts`, `cloudflare-worker/src/index.ts` (Einhängepunkte, SiteMeta, Datenschutz-Abschnitt), `public/chat-widget/v1.js`, `scripts/check-chat-widget.mjs` (Syntax + Größe) |
| App | `mobile/src/app/(tabs)/chats/*`, `mobile/src/features/chat/*`, `mobile/src/api/{endpoints,queries,types,mock}.ts` (+Chat), `mobile/src/app/(tabs)/_layout.tsx` (+Tab), `mobile/src/lib/push.ts` (+Route), Einstellungen (+Schalter), `mobile/src/api/contracts/*` (sync) |
| Web | `src/app/(dashboard)/chats/*`, `src/components/chat/*`, `src/components/dashboard/{Sidebar,MobileNav}.tsx` (+Eintrag), `src/app/(dashboard)/layout.tsx` (Flag), `src/app/(admin)/admin/besucher-chat/*`, `src/app/api/admin/chat/*` |

Gemeinsame Verträge: `src/lib/contracts/app-v1/chat.ts` (fertig, nicht ändern ohne Absprache).

## Rollout an App-Nutzer (29.10.2026)

Daniel: „Allen, die sich die App heruntergeladen haben, die Chatfunktion freischalten – nicht automatisch aktiv, sondern im Editor erst aktivieren.“

- Freischaltung (`src/lib/chat/flags.ts`): Hauptschalter `visitor_chat_enabled` UND (Benutzername in `visitor_chat_users` ODER `visitor_chat_app_users='true'` und Konto ist App-Nutzer). App-Nutzer = Eintrag in `push_devices` ODER Sitzung mit User-Agent `FinestSites/…`/`…FinestSitesApp/…` ODER schon der Chat-AVV zugestimmt (bleibt nach Abmelden freigeschaltet). 30 s Cache je Konto. Admin: /admin/besucher-chat → Schalter „Alle App-Nutzer“.
- Freigeschaltet heißt nur: „Chats“ + Editor-Karte sichtbar. `user_sites.visitor_chat_enabled` ist seit Migration `20261029120000_chat_app_users.sql` standardmäßig `false` (alle Seiten außer denen von `demo` auf false gesetzt).
- Einschalten im Editor (Bereich „Domain“, Karte „Besucher-Chat“): beim ersten Mal Zustimmungsfeld „Kurz zustimmen, dann ist der Chat an“ → `PUT /api/sites/[id]/chat {enabled:true, acceptAvv:true}`. Ohne Zustimmung 409 `AVV_REQUIRED`. Nur der Kontoinhaber selbst kann zustimmen (nicht ein Admin per „Anmelden als“).
- Ergänzung zur Auftragsverarbeitung: Text in `src/lib/chat/avv.ts` (Version `chat-v1`, nie nachträglich ändern), öffentlich unter finestsites.io/agb/avv-besucher-chat. Nachweis in `chat_avv_consents` (Zeitpunkt, Version, SHA-256 des Textes, IP, User-Agent, Seite).
