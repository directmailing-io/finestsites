-- Support Chat System
CREATE TABLE IF NOT EXISTS support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  subject TEXT,
  last_message_at TIMESTAMPTZ,
  unread_by_admin INTEGER NOT NULL DEFAULT 0,
  unread_by_user INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_conv_user_id ON support_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_status ON support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_support_conv_last_msg ON support_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_msg_conv_id ON support_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_msg_created ON support_messages(created_at);
