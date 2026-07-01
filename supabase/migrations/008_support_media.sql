-- Add rich media support to support_messages
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
