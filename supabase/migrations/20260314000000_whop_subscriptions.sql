-- Whop.com payment integration: subscriptions table + profile linking
-- Tracks membership lifecycle separate from identity (profiles)

-- 1. Create whop_subscriptions table
CREATE TABLE IF NOT EXISTS whop_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  whop_user_id TEXT NOT NULL,
  whop_membership_id TEXT NOT NULL UNIQUE,
  whop_product_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled', 'expired', 'past_due')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  raw_webhook_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common lookups
CREATE INDEX idx_whop_subscriptions_profile_id ON whop_subscriptions(profile_id);
CREATE INDEX idx_whop_subscriptions_whop_user_id ON whop_subscriptions(whop_user_id);
CREATE INDEX idx_whop_subscriptions_status ON whop_subscriptions(status);

-- 2. Add whop_user_id to profiles for quick user lookups
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whop_user_id TEXT;

-- Unique partial index: only one profile per whop_user_id (where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_whop_user_id
  ON profiles(whop_user_id)
  WHERE whop_user_id IS NOT NULL;

-- 3. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_whop_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER whop_subscriptions_updated_at
  BEFORE UPDATE ON whop_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_whop_subscriptions_updated_at();

-- 4. RLS policies
ALTER TABLE whop_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON whop_subscriptions FOR SELECT
  USING (profile_id = auth.uid());

-- Admins can read all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON whop_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only service role can insert/update (webhook handler bypasses RLS)
-- No INSERT/UPDATE policies for authenticated users
