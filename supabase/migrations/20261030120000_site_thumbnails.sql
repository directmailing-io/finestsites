-- Echte Vorschaubilder je Webseite (30.10.2026, Daniel): Statt des statischen Vorlagen-Bildes zeigt die
-- Karte im Dashboard (Web + App) ein Bildschirmfoto der veröffentlichten Seite des Nutzers.
--
--  * thumb_url:          aktuelles Bild (…/api/media/site-thumbs/<userId>/<siteId>-<ms>.webp, unveränderlich)
--  * thumb_at:           wann es aufgenommen wurde
--  * thumb_requested_at: beim Veröffentlichen gesetzt → scripts/site-thumbnails.ts nimmt neu auf
--  * thumb_error_at:     letzter Fehlversuch (Pause, damit kaputte Seiten nicht dauernd geladen werden)
--
-- Idempotent. Ohne Bild bleibt alles wie bisher (Vorlagen-Bild).

BEGIN;

ALTER TABLE public.user_sites ADD COLUMN IF NOT EXISTS thumb_url TEXT;
ALTER TABLE public.user_sites ADD COLUMN IF NOT EXISTS thumb_at TIMESTAMPTZ;
ALTER TABLE public.user_sites ADD COLUMN IF NOT EXISTS thumb_requested_at TIMESTAMPTZ;
ALTER TABLE public.user_sites ADD COLUMN IF NOT EXISTS thumb_error_at TIMESTAMPTZ;

COMMIT;
