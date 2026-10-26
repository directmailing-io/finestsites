<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# Deployment (verbindlich seit 03.09.2026)

FinestSites läuft ausschließlich auf Hetzner: App-Server `188.245.35.52`, DB-Server `142.132.174.86` (privates Netz). Deploy nur über `git push origin main` und dann `ssh -i ~/.ssh/finestsites_hetzner root@188.245.35.52 "/usr/local/bin/finestsites-deploy.sh"` (siehe `deploy.sh`). Der frühere Hostinger-VPS (187.124.187.228, srv1554729.hstgr.cloud) ist stillgelegt, Vercel ist abgeschaltet: niemals dorthin deployen, nichts dort ausführen. Details: `docs/architecture.md`.

# Gleichlauf Web + App (verbindlich seit 26.10.2026, Daniels Vorgabe)

Die native App (`mobile/`, Expo) ist eine 1:1-Fassung der Webanwendung. Jede Änderung an Oberfläche, Texten oder Abläufen, die es in beiden Fassungen gibt, wird **im selben Arbeitsgang** in `src/` (Web) **und** `mobile/src/` (App) umgesetzt – nie nur in einer. Konkret:

1. **Beide Seiten anfassen:** Web-Seite/-Komponente und der passende App-Screen (`mobile/src/app/...`) sowie der Mock-Server (`mobile/src/api/mock/`) werden zusammen geändert. Änderungen an `src/lib/contracts/app-v1/*` danach mit `node mobile/scripts/sync-contracts.mjs` in die App übernehmen; `npm run check:words` muss in beiden Fassungen grün sein (keine Preise/Tarifnamen in der App).
2. **API bleibt abwärtskompatibel:** Nutzer aktualisieren die App nicht sofort. Die Server-API (`/api/app/v1/*`) muss mit der ältesten installierten App-Version funktionieren (Versionen stehen in `push_devices.app_version` und in `sessions.user_agent`, Kennung `FinestSites/<Build>`). Felder nur hinzufügen, nie umbenennen oder entfernen, ohne die App-Versionen zu prüfen.
3. **Ausliefern:** Web geht wie gewohnt über das Deploy-Script live. Die App geht über einen neuen Store-Build (EAS, nur mit Daniels Freigabe) bzw. – sobald EAS Update eingerichtet ist – per `eas update` im selben Deploy-Lauf für reine JS/UI-Änderungen. Bis dahin werden App-Änderungen gesammelt und im Abschlussbericht ausdrücklich als „in der App erst mit dem nächsten Build“ genannt.
4. **Abschluss:** Kein Arbeitsgang gilt als fertig, solange nur eine Fassung geändert ist. Im Bericht an Daniel steht immer, was Web und was App bekommen hat und wann es dort ankommt.
