-- Site analytics events, written by the Cloudflare Worker via /api/worker/track.
-- site_id / template_id deliberately have NO foreign keys: events must survive
-- site deletion so template-level aggregates stay complete.
CREATE TABLE IF NOT EXISTS site_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  site_id uuid NOT NULL,
  template_id uuid NOT NULL,
  event_type text NOT NULL,
  visitor_hash varchar(64),
  host text NOT NULL,
  path text NOT NULL DEFAULT '/',
  source text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device varchar(16),
  browser varchar(32),
  os varchar(32),
  country varchar(8),
  meta jsonb
);

CREATE INDEX IF NOT EXISTS idx_site_events_site_occurred ON site_events (site_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_site_events_template_occurred ON site_events (template_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_site_events_occurred ON site_events (occurred_at);
