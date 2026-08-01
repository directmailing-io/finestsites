# Feedback-Aktion vollständig entfernen

Die anonyme Feedback-Kampagne ist komplett isoliert gebaut. Zum Rückbau nach Ende der Aktion:

## 1. Dateien löschen

```bash
rm -rf src/app/feedback
rm -rf src/app/api/feedback
rm -rf src/app/api/admin/feedback
rm -rf "src/app/(admin)/admin/feedback"
rm supabase/migrations/20260801160000_feedback_kampagne.sql
rm docs/feedback-aktion-entfernen.md
```

## 2. Sidebar-Eintrag entfernen

In `src/components/admin/AdminSidebar.tsx` das `navItems`-Objekt mit
`href: '/admin/feedback'` (Label „Feedback-Aktion“, markiert mit Kommentar
„Temporäre Feedback-Kampagne“) löschen.

## 3. Datenbank-Tabelle löschen

Auf dem VPS (kein lokales psql — via node + postgres, DATABASE_URL aus `.env.production`):

```sql
DROP TABLE IF EXISTS feedback_responses;
```

## 4. Deployen

```bash
git push origin main
ssh root@187.124.187.228 "/usr/local/bin/finestsites-deploy.sh"
```

Danach ist die Aktion rückstandslos entfernt. Es gibt keine weiteren Referenzen
(kein Schema-Eintrag in `src/lib/db/schema.ts`, keine Middleware-Änderung, keine
Umgebungsvariablen nur für dieses Feature — `OPENAI_API_KEY` wird auch vom
Compliance-Checker genutzt und bleibt).
