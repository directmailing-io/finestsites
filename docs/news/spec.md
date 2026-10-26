# Neuigkeiten (Ankündigungen) – Spezifikation für die Umsetzung

Stand 26.10.2026. Entschieden von Daniel nach `docs/app/neuigkeiten-konzept.html`: eigener Bereich „Neuigkeiten“ in App **und** Webanwendung, Push mit Deep-Link auf die Neuigkeit, Schalter standardmäßig an, Knopf mit festen Zielen oder Link. UI muss sehr ansprechend sein und 1:1 in Web und App gleich wirken (Regel „Gleichlauf Web + App“ in AGENTS.md).

## Grundlage (bereits vorhanden, nicht ändern)

- Migration `supabase/migrations/20261027060000_news.sql`: Tabellen `news_posts`, `news_reads`, Spalte `notification_preferences.news` (Standard `true`), Push-Kategorie `news` im Check-Constraint. Lokal eingespielt.
- Schema `src/lib/db/schema.ts`: `newsPosts`, `newsReads`, `notificationPreferences.news`.
- Verträge `src/lib/contracts/app-v1/news.ts` (`NewsItem`, `NewsListResponse`, `NewsDetailResponse`, `NewsActionResponse`, `NewsCard`, `NewsCta`, `NewsCtaKind`, `newsBodyBlocks()`), `push.ts` (`PushCategory` + `news`), `preferences.ts` (`news`), `overview.ts` (`news: { unread, latest }`). In die App synchronisiert (`mobile/src/api/contracts/`).
- `src/lib/push/preferences.ts`: Standard `news: true`, `rowToPreferences` liest die Spalte. Der Drain prüft `categoryAllowed(p, 'news')` automatisch.

## Fachliche Regeln

| Regel | Festlegung |
|---|---|
| Status | `draft` → `published` → `archived`. Nur `published` ist für Nutzer sichtbar. Archivieren versteckt sofort in Web und App. |
| Felder | `title` ≤ 80 · `pushTitle` ≤ 40 · `pushBody` ≤ 170 (Richtwert 110, Zähler ab 35/100 orange) · `body` ≤ 5000 · `ctaLabel` ≤ 30 · `ctaKind` ∈ sites, submissions, chats, affiliate, settings, url · `ctaUrl` nur bei `url`, muss `https://` sein · `audience` ∈ all, plan:starter, plan:pro, plan:unlimited, users (dann `audienceUserIds` = 1…200 Konto-IDs, sonst leer) · `expiresAt` optional als Kalendertag YYYY-MM-DD („Sichtbar bis“, Ende des Tages Europe/Berlin) |
| Sichtbarkeit | `audience = all` → alle Konten. `plan:x` → nur Konten mit `users.plan = x`. `users` → nur Konten in `audience_user_ids` (zum Testen vor dem Rollout; die Konto-Liste darf auch nach dem Veröffentlichen geändert werden, ohne neuen Push). Zusätzlich `expires_at IS NULL OR expires_at > now()` – nach „Sichtbar bis“ verschwindet die Neuigkeit in Web und App von selbst (Admin sieht sie weiter, Pill „abgelaufen“). Neue Nutzer sehen auch ältere veröffentlichte Neuigkeiten (Liste zeigt höchstens 50, neueste zuerst). |
| Inhalt | Reiner Text. Leerzeile = Absatz, Zeilen mit `- ` = Aufzählung. Rendern **ausschließlich** über `newsBodyBlocks()` aus dem Vertrag (Web und App identisch). Kein HTML, kein Markdown. |
| Push | Kategorie `news`, `type: 'news'`, `title = pushTitle`, `body = pushBody`, `data = { type: 'news', url: 'finestsites://news/<id>', newsId }`, `collapseKey: 'news'`, `inbox: false` (keine Doppelung im Mitteilungs-Postfach; Neuigkeiten haben ihren eigenen Bereich). Nur an Nutzer mit mindestens einem aktiven Gerät (`push_devices.enabled`) **und** Audience-Treffer **und** ohne laufende Löschanfrage (`users.deletion_requested_at IS NULL`). Die Schalter-Prüfung (`news = false`) übernimmt der Drain; Ruhezeiten ebenfalls. |
| Häufigkeit | Höchstens **eine** Veröffentlichung mit Push pro Kalendertag (Europe/Berlin). Server lehnt eine zweite ab (`NEWS_PUSH_LIMIT`, HTTP 409, deutsche Meldung). Veröffentlichen **ohne** Push ist jederzeit möglich. |
| Testversand | Schickt die Push-Mitteilung nur an die Geräte des angemeldeten Admins, veröffentlicht nichts, zählt nicht. Enqueue mit `collapseKey: 'news-test'`, `throttleSeconds: 30`. |
| Gelesen | `news_reads.read_at` beim Öffnen des Details (Web und App). `cta_clicked_at` beim Tipp auf den Knopf. `dismissed_at` beim Wegwischen der Startkarte (Web-Dashboard und App-Startbildschirm teilen sich den Wert). |
| Ungelesen | Anzahl veröffentlichter, sichtbarer Neuigkeiten ohne `read_at`. Für die Zähler unter „Mehr → Neuigkeiten“ (App), in der Seitenleiste (Web) und in `/overview`. |
| Startkarte | Neueste sichtbare Neuigkeit, die weder gelesen noch weggewischt ist **und höchstens 14 Tage alt** (`NEWS_CARD_MAX_AGE_DAYS`, Server `overviewFor` und Web-Karte identisch – ein neues Konto bekommt keine alte Karte), sonst `null`. (Gelesen = Karte verschwindet.) |
| Keine Preise | Weder in Push-Texten noch im Inhalt dürfen Tarifnamen oder Preise stehen (Apple-Regel 3.1.3, unser `check:words`). Der Admin-Editor warnt bei den Wörtern aus `mobile/scripts/check-words.mjs` (siehe dort), blockiert aber nicht. |
| Löschen | Nur Entwürfe dürfen gelöscht werden. Veröffentlichte werden archiviert. |

## Server-Modul `src/lib/news/service.ts` (Agent A)

Reine Funktionen über Drizzle, keine HTTP-Details:

- `listForUser(userId, { plan }) → { items: NewsItem[], unreadCount }`
- `getForUser(userId, newsId, { plan }) → NewsItem | null` (null auch bei falscher Audience/Status)
- `markRead(userId, newsId)`, `markCtaClicked(userId, newsId)`, `dismiss(userId, newsId)` → `{ item, unreadCount }` (Upsert in `news_reads`)
- `overviewFor(userId, { plan }) → { unread, latest: NewsCard | null }`
- `unreadCountFor(userId, { plan })`
- Admin: `listAdmin()` (mit Statistik je Neuigkeit: `pushQueued`, `readCount`, `ctaCount`, `dismissedCount`), `createDraft(input, adminId)`, `updateDraft(id, input)` (auch für veröffentlichte erlaubt: title/body/cta ändern, nicht pushTitle/pushBody nach Push), `publish(id, { push: boolean }, adminId)` → reiht Push ein, setzt `published_at`, `push_sent_at`, `push_queued`; `archive(id)`, `deleteDraft(id)`, `sendTest(id, adminId)`, `recipientPreview(id) → { users: number, devices: number }` (für den Dialog „An alle senden“).
- Eingabe-Validierung mit einem zod-Schema `NewsAdminInput` in `src/lib/news/admin-schema.ts` (deutsche Fehlermeldungen je Feld).

## HTTP (Agent A)

Fehlerform überall wie im Projekt üblich (App: `appError`, Web/Admin: `NextResponse.json({ error }, { status })`).

**App (Bearer, `requireAppUser`), Antworten validiert über `appJson(Schema, …)`:**
- `GET /api/app/v1/news` → `NewsListResponse`
- `GET /api/app/v1/news/[id]` → `NewsDetailResponse` (404 `NOT_FOUND`)
- `POST /api/app/v1/news/[id]/read` · `/cta` · `/dismiss` → `NewsActionResponse`
- `GET /api/app/v1/overview` liefert zusätzlich `news: { unread, latest }` (in die bestehende `Promise.all` einhängen)
- `GET/PUT /api/app/v1/notification-preferences` lesen/schreiben `news` (PUT-Teilupdate wie `chat`)

**Web (Sitzungs-Cookie, `getUserFromRequest`), gleiche Formen:**
- `GET /api/news`, `GET /api/news/[id]`, `POST /api/news/[id]/read` · `/cta` · `/dismiss`
- `GET /api/news/unread` → `{ unreadCount }` (leichtgewichtig für die Seitenleiste)

**Admin (`getRealUserFromRequest` + `isAdmin`, Muster `src/app/api/admin/users/route.ts`):**
- `GET /api/admin/news` → Liste mit Statistik
- `POST /api/admin/news` → Entwurf anlegen (Body = `NewsAdminInput`)
- `GET /api/admin/news/[id]` · `PUT` (Update) · `DELETE` (nur Entwurf)
- `POST /api/admin/news/[id]/publish` Body `{ push: boolean }` → 409 `NEWS_PUSH_LIMIT` bei zweitem Push am selben Tag
- `POST /api/admin/news/[id]/test` → Testpush an den Admin, Antwort `{ devices: number }` (0 = „Du hast kein Gerät mit Push angemeldet“)
- `POST /api/admin/news/[id]/archive`
- `GET /api/admin/news/[id]/recipients` → `{ users, devices }`

**Middleware:** `/neuigkeiten` in `protectedPaths` in `src/middleware.ts` aufnehmen (Web-Seite nur angemeldet).

**Test:** `scripts/test-news.ts` nach dem Muster von `scripts/test-account-deletion.ts` (eigene Wegwerf-DB, Prüfungen: Audience, Gelesen/Ungelesen, Startkarte verschwindet nach Lesen oder Wegwischen, Tageslimit, Testversand nur eigene Geräte, Push nur mit aktivem Gerät, Archivieren versteckt, Löschen nur Entwurf, Nutzer mit `news = false` bekommt keinen Push durch den Drain). Alle Prüfungen grün, Ergebnis im Bericht.

## Admin-Oberfläche (Agent B)

Stil exakt wie die vorhandenen Admin-Seiten (`src/app/(admin)/admin/users`, `_components/AdminTable.tsx`, Pills/Farben aus `AdminUsersTable.tsx`). Deutsche Texte, keine Preise.

- Seitenleiste `src/components/admin/AdminSidebar.tsx` + `AdminMobileNav.tsx`: Eintrag **„Neuigkeiten“** (Icon Megaphon/Sparkles) zwischen „Newsletter“ und „Support“.
- `/admin/neuigkeiten`: Kennzahlen oben (Veröffentlicht, Entwürfe, Push-Empfänger letzte, Gelesen-Quote letzte), Tabelle: Titel, Status-Pill (Entwurf/Veröffentlicht/Archiviert), Veröffentlicht am, Push (Anzahl oder „ohne Push“), Gelesen, Knopf getippt, Aktionen. Knopf „Neue Neuigkeit“.
- `/admin/neuigkeiten/neu` und `/admin/neuigkeiten/[id]`: Editor **zweispaltig** wie im Konzept (Abschnitt 3): links Formular mit Zählern (Titel der Mitteilung 0/40, Text 0/110 mit harter Grenze 170, Überschrift 0/80, Inhalt), Knopf + Ziel (Select: Meine Webseiten, Anfragen, Chats, Partnerbereich, Einstellungen, Eigener Link + URL-Feld), Empfänger (Segment: Alle · Starter · Pro · Unlimited). Rechts **Live-Vorschau**: iPhone-Sperrbildschirm (dunkler Lila-Verlauf, Glas-Karte mit Logo-Icon, Titel, Text, „jetzt“), Android-Karte (dunkel, aufgeklappt) und darunter die Neuigkeit, wie sie in der App aussieht (Karte mit Lila-Verlauf-Kopf, Kicker „NEUIGKEIT · Datum“, Überschrift, Inhalt über `newsBodyBlocks`, Knopf). Dazu „Reichweite jetzt“ (aus `/recipients`) und Hinweise zur Sichtbarkeit.
- Aktionen: „Entwurf speichern“, „Test an mein iPhone“ (Toast mit Geräteanzahl), „Veröffentlichen …“ → Dialog mit zwei Optionen „Mit Push-Mitteilung an N Nutzer (M Geräte)“ / „Ohne Push, nur im Web und in der App zeigen“, Bestätigung. Bei veröffentlichten: „Archivieren“, bei Entwürfen: „Löschen“. 409-Meldung des Tageslimits freundlich anzeigen.
- Wortwarnung: live unter dem jeweiligen Feld, wenn ein Wort aus der Sperrliste vorkommt (Liste von `mobile/scripts/check-words.mjs` übernehmen; nur Warnung).
- Autosave nicht nötig; ungespeicherte Änderungen beim Verlassen abfragen (`beforeunload`).

## Webanwendung (Agent B)

- Seitenleiste `src/components/dashboard/Sidebar.tsx`: Eintrag **„Neuigkeiten“** (sekundäre Gruppe, über „Einstellungen“) mit Badge = `unreadCount` (laden über `GET /api/news/unread`, alle 5 Minuten und bei Fokus). `MobileNav.tsx` ebenso.
- `/neuigkeiten`: Liste als Karten (Datum-Kicker, Überschrift, Kurztext, Punkt „ungelesen“), neueste zuerst, Leerzustand „Noch keine Neuigkeiten“.
- `/neuigkeiten/[id]`: Detail wie in der App: Karte mit Lila-Verlauf-Kopf „FinestSites“, Kicker, Überschrift, Inhalt (`newsBodyBlocks`), Knopf (interne Ziele als Link auf die Web-Route, `url` als `target=_blank rel=noopener`; Klick → `POST …/cta`). Beim Laden `POST …/read`. Zurück-Link „‹ Neuigkeiten“.
- Dashboard-Karte: oben auf `/sites` (über „Neue Webseite erstellen“ bzw. über der Seitenliste, unter dem Onboarding-Banner falls vorhanden) die Karte aus dem Konzept (Bild 4): Kicker „NEU BEI FINESTSITES“, Überschrift, Kurztext, „Mehr erfahren ›“, Schließen-Kreuz → `POST …/dismiss`. Quelle: `GET /api/news` (neueste ungelesene, nicht weggewischte). Die Karte darf den Seitenaufbau nicht springen lassen (erst rendern, wenn geladen).
- Gleiche Farben/Radien wie die App-Tokens (`mobile/src/theme/tokens.ts`: Akzent `#7C3AED`, `accentSoft #F5F0FB`, `accentSoftBorder #E4D7F5`, Karte Radius 24, Geist).

## App (Agent C) – `mobile/`

- `mobile/src/api/endpoints.ts`: `getNews()`, `getNewsItem(id)`, `markNewsRead(id)`, `markNewsCta(id)`, `dismissNews(id)`; Typen aus `@/api/contracts/news`. Query-Keys in `qk` ergänzen (`news`, `newsItem(id)`), Overview-Typ bekommt `news`.
- Mock-Server `mobile/src/api/mock/server.ts` + `data.ts`: 3 Beispiel-Neuigkeiten (eine ungelesen, eine mit Knopf `url`, eine mit `sites`), Overview liefert `news`.
- Screens unter `mobile/src/app/(tabs)/account/news/index.tsx` (Liste) und `news/[id].tsx` (Detail), in `account/_layout.tsx` registrieren (`news/index` Titel „Neuigkeiten“, `news/[id]` Titel „Neuigkeit“).
- „Mehr“ (`account/index.tsx`): neue Zeile **Neuigkeiten** (Icon Sparkles) zwischen „Einstellungen“ und „Mitteilungen“, Badge = `overview.news.unread`.
- Startbildschirm (Tab „Webseite“, `(tabs)/index.tsx`): Karte wie Konzept Bild 4 über dem Knopf „Neue Webseite erstellen“, wegwischbar (Kreuz → `dismissNews`), Tipp → Detail. Erscheint nur, wenn `overview.news.latest` gesetzt ist; sanftes Ein-/Ausblenden.
- Detail: Karte mit Lila-Verlauf-Kopf, Kicker „NEUIGKEIT · 4. November 2026“, Überschrift (`typography.title`), Inhalt über `newsBodyBlocks` (Absätze `typography.body`, Aufzählung mit Punkt in Akzentfarbe), Knopf (Hauptbutton wie überall) → interne Ziele per `router.navigate` (`sites → /`, `submissions → /inbox`, `chats → /chats`, `affiliate → /account/partner`, `settings → /account/settings`), `url` per `Linking.openURL`; davor `markNewsCta`. Beim Öffnen `markNewsRead` + Queries `news`, `overview` invalidieren. Sekundärer Knopf „Später“ = zurück.
- Push-Einstellungen (`account/notifications.tsx`): neue Zeile **„Neuigkeiten von FinestSites“** mit Untertitel „Neue Funktionen und Aktionen, höchstens einmal am Tag“, Schalter an `prefs.news`.
- Deep-Link: `mobile/src/lib/push.ts` → `routeFromNotification`: `case 'news': return withId('/account/news')`; `/account/news` in `ALLOWED_ROUTES`. Beim Tipp auf die Push-Mitteilung landet der Nutzer direkt im Detail.
- `npm run check:words` (in `mobile/`) und `npx tsc --noEmit` grün. Mock-Modus muss alles zeigen (Daniel schaut es im Simulator an).

## Abnahme

- Web: Seite und Karte im lokalen Dev-Server (Port 3077) mit Playwright-Screenshots (Login `qa-pro@example.invalid` / `Test1234!`, Admin `admin@example.invalid` / `Test1234!`).
- App: Mock-Modus, Screens per Simulator oder Expo-Web-Screenshots.
- Deploy nur durch Daniel/Koordinator im 06:00/23:00-Fenster; Migration vorher auf dem DB-Server. App-Teil kommt mit Build 9.
