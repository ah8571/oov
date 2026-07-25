-- Consolidate billing entitlements into users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_pro_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_tier TEXT,
  ADD COLUMN IF NOT EXISTS stripe_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS stripe_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_tier TEXT,
  ADD COLUMN IF NOT EXISTS paddle_status TEXT DEFAULT 'inactive';

-- Drop the separate entitlements table
DROP TABLE IF EXISTS public.user_billing_entitlements;
