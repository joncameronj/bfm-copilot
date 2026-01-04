-- Add archiving capability to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Create index for efficient archived conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations (user_id, is_archived, updated_at DESC);
