-- Add Paddle subscription fields to billing entitlements
ALTER TABLE user_billing_entitlements
ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS paddle_tier TEXT,
ADD COLUMN IF NOT EXISTS paddle_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS paddle_updated_at TIMESTAMP WITH TIME ZONE;
