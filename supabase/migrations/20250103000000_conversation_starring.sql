-- Add starring capability to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

-- Create index for efficient starred conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_starred ON conversations (user_id, is_starred, updated_at DESC)
WHERE is_starred = TRUE;
