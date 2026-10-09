-- Werbung & Tracking: Meta / Google Ads / TikTok (see src/lib/tracking/, docs/werbung-tracking-konzept.html)
ALTER TABLE site_events ADD COLUMN IF NOT EXISTS event_id VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS site_events_event_id_unique ON site_events (event_id);

CREATE TABLE IF NOT EXISTS tracking_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  meta_pixel_id TEXT,
  meta_token_enc TEXT,
  google_ads_id TEXT,
  google_lead_label TEXT,
  google_contact_label TEXT,
  tiktok_pixel_id TEXT,
  tiktok_token_enc TEXT,
  site_ids JSONB,
  events JSONB NOT NULL DEFAULT '{"contact": true, "lead": true}',
  confirmed_at TIMESTAMPTZ,
  last_send_at TIMESTAMPTZ,
  last_send_platform TEXT,
  last_send_status TEXT,
  last_send_error TEXT,
  first_lead_at TIMESTAMPTZ,
  first_lead_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Die App-Rolle braucht Rechte auf neue Tabellen (Tabellen werden als postgres angelegt):
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tracking_configs TO finestsites;

-- Nachtrag 09.10.2026: wählbare Ereignisse
ALTER TABLE tracking_configs ADD COLUMN IF NOT EXISTS events JSONB NOT NULL DEFAULT '{"contact": true, "lead": true}';
