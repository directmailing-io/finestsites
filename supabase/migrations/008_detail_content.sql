ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS detail_content JSONB DEFAULT '[]';
