-- Broadcast history for waitlist emails
CREATE TABLE IF NOT EXISTS waitlist_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  recipients JSONB NOT NULL DEFAULT '[]',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
