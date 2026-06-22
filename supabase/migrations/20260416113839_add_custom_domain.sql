-- Add custom domain support to user_sites

ALTER TABLE user_sites
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_status TEXT,
  ADD COLUMN IF NOT EXISTS cf_custom_hostname_id TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ;

-- Ensure a custom domain can only be used by one site
CREATE UNIQUE INDEX IF NOT EXISTS user_sites_custom_domain_unique
  ON user_sites (custom_domain)
  WHERE custom_domain IS NOT NULL;
