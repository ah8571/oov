-- Consolidate billing + promo into users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_pro_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_tier TEXT,
  ADD COLUMN IF NOT EXISTS stripe_status TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS stripe_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_promo_code TEXT,
  ADD COLUMN IF NOT EXISTS last_promo_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_promo_redeemed_at TIMESTAMPTZ;

-- Drop separate tables (consolidated into users)
DROP TABLE IF EXISTS public.user_billing_entitlements;
DROP TABLE IF EXISTS public.promo_redemptions;
