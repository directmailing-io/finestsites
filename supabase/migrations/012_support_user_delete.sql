-- Add soft-delete flag for user-deleted support conversations
ALTER TABLE support_conversations
  ADD COLUMN IF NOT EXISTS deleted_by_user boolean NOT NULL DEFAULT false;
