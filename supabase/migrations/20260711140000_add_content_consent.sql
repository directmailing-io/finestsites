-- Add content consent tracking to user_sites
-- Users must confirm they won't publish prohibited content (trademark violations, health claims).
-- We store: timestamp, IP address, user agent, and the consent text version for legal proof.

ALTER TABLE public.user_sites
  ADD COLUMN IF NOT EXISTS content_consent_given_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_consent_ip        VARCHAR(64),
  ADD COLUMN IF NOT EXISTS content_consent_ua        TEXT,
  ADD COLUMN IF NOT EXISTS content_consent_version   VARCHAR(20) DEFAULT 'v1';

COMMENT ON COLUMN public.user_sites.content_consent_given_at IS 'Timestamp when user gave content consent before first publish';
COMMENT ON COLUMN public.user_sites.content_consent_ip        IS 'IP address at time of content consent (legal proof)';
COMMENT ON COLUMN public.user_sites.content_consent_ua        IS 'User-Agent at time of content consent (legal proof)';
COMMENT ON COLUMN public.user_sites.content_consent_version   IS 'Version of the consent text the user agreed to';
