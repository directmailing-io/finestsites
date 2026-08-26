-- Erfahrungsberichte: öffentliche Testimonial-Sammlung (app.finestsites.io/erfahrungsbericht)
-- Zwei Tabellen: Submissions + Assets (eigener Lifecycle pro Datei wegen
-- Presigned-Uploads: pending -> verified/rejected).

CREATE TYPE testimonial_status AS ENUM ('draft', 'new', 'reviewed', 'published', 'rejected');
CREATE TYPE testimonial_category AS ENUM ('produkte', 'stoffwechselkur', 'business');
CREATE TYPE testimonial_asset_kind AS ENUM ('before_image', 'after_image', 'video', 'audio');
CREATE TYPE testimonial_asset_status AS ENUM ('pending', 'verified', 'rejected');

CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status testimonial_status NOT NULL DEFAULT 'draft',
  category testimonial_category NOT NULL,
  text text,
  text_source varchar(16),
  full_name varchar(200),
  display_name_mode varchar(16),
  age integer,
  email varchar(320),
  instagram varchar(300),
  tiktok varchar(300),
  facebook varchar(300),
  upload_token varchar(64) NOT NULL,
  consent_version varchar(16),
  consent_hash varchar(64),
  consent_ip varchar(64),
  consent_ua text,
  consented_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS testimonial_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  testimonial_id uuid NOT NULL REFERENCES testimonials(id) ON DELETE CASCADE,
  kind testimonial_asset_kind NOT NULL,
  status testimonial_asset_status NOT NULL DEFAULT 'pending',
  r2_key text NOT NULL,
  content_type varchar(100) NOT NULL,
  size_bytes bigint,
  duration_seconds integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_status_created ON testimonials (status, created_at);
CREATE INDEX IF NOT EXISTS idx_testimonial_assets_testimonial ON testimonial_assets (testimonial_id);
