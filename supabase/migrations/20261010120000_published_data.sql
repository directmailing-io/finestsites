-- Entwurf ≠ Live: veröffentlichter Stand der Seitendaten (src/lib/sites/published-data.ts)
ALTER TABLE user_sites ADD COLUMN IF NOT EXISTS published_data JSONB;
ALTER TABLE user_sites ADD COLUMN IF NOT EXISTS published_data_at TIMESTAMPTZ;
-- Bestehende veröffentlichte Seiten: aktuellen Stand einfrieren
UPDATE user_sites s SET published_data = coalesce((SELECT jsonb_object_agg(d.field_key, coalesce(d.field_value, '')) FROM site_data d WHERE d.user_site_id = s.id), '{}'::jsonb), published_data_at = now()
WHERE s.status = 'published' AND s.published_data IS NULL;
