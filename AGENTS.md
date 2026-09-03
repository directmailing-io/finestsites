<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# Deployment (verbindlich seit 03.09.2026)

FinestSites läuft ausschließlich auf Hetzner: App-Server `188.245.35.52`, DB-Server `142.132.174.86` (privates Netz). Deploy nur über `git push origin main` und dann `ssh -i ~/.ssh/finestsites_hetzner root@188.245.35.52 "/usr/local/bin/finestsites-deploy.sh"` (siehe `deploy.sh`). Der frühere Hostinger-VPS (187.124.187.228, srv1554729.hstgr.cloud) ist stillgelegt, Vercel ist abgeschaltet: niemals dorthin deployen, nichts dort ausführen. Details: `docs/architecture.md`.
