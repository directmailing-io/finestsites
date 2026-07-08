-- Impersonation requests: admin requests access to a user's account with explicit user consent
CREATE TABLE IF NOT EXISTS impersonation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  -- pending → approved (user consents) → active (admin entered) → ended
  -- pending → rejected (user declines)
  status TEXT NOT NULL DEFAULT 'pending',
  conversation_id UUID REFERENCES support_conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_impersonation_token ON impersonation_requests(token);
CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON impersonation_requests(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_user ON impersonation_requests(user_id);
