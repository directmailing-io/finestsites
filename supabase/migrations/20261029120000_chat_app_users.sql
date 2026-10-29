-- Besucher-Chat für App-Nutzer (29.10.2026, Daniel): Konten, die die App benutzt haben, bekommen den Chat
-- freigeschaltet – er ist aber AUS, bis der Nutzer ihn im Editor einschaltet und dabei der Ergänzung zur
-- Auftragsverarbeitung (Besucher-Chat) zustimmt. docs/chat/konzept.md
--
--  * user_sites.visitor_chat_enabled: Standard ab jetzt false. Bisher war der Chat nur für `demo`
--    freigeschaltet, für alle anderen Seiten war der Wert wirkungslos → auf false setzen ändert nichts
--    Sichtbares. Die Seiten von `demo` behalten ihren Wert.
--  * chat_avv_consents: Nachweis der Zustimmung (Zeitpunkt, Textversion + Hash, IP, User-Agent, Seite).
--  * app_settings.visitor_chat_app_users = 'true' → App-Nutzer freigeschaltet (eigener Notaus).
--
-- Idempotent.

BEGIN;

ALTER TABLE public.user_sites ALTER COLUMN visitor_chat_enabled SET DEFAULT false;

UPDATE public.user_sites us SET visitor_chat_enabled = false
WHERE us.visitor_chat_enabled = true
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = us.user_id AND lower(u.username) = 'demo');

CREATE TABLE IF NOT EXISTS public.chat_avv_consents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  site_id       UUID REFERENCES public.user_sites(id) ON DELETE SET NULL,
  version       VARCHAR(20) NOT NULL,
  text_hash     VARCHAR(64) NOT NULL,
  ip            VARCHAR(64),
  user_agent    TEXT,
  accepted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_avv_consents_user ON public.chat_avv_consents(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_avv_consents TO finestsites;

INSERT INTO public.app_settings (key, value) VALUES ('visitor_chat_app_users', 'true')
ON CONFLICT (key) DO NOTHING;

COMMIT;
