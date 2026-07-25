-- Create the user_billing_entitlements table that was missing.
-- The 20260718 migration ALTERs this table but it never existed.
CREATE TABLE IF NOT EXISTS public.user_billing_entitlements (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  billing_state VARCHAR(30) NOT NULL DEFAULT 'trial',
  is_pro_active BOOLEAN NOT NULL DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_tier TEXT,
  stripe_status TEXT DEFAULT 'inactive',
  paddle_subscription_id TEXT,
  paddle_tier TEXT,
  paddle_status TEXT DEFAULT 'inactive',
  stripe_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.user_billing_entitlements ENABLE ROW LEVEL SECURITY;

-- Users can read their own entitlements
CREATE POLICY "Users can read own entitlements"
  ON public.user_billing_entitlements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do anything
CREATE POLICY "Service role full access"
  ON public.user_billing_entitlements
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_billing_entitlements_updated_at ON public.user_billing_entitlements;
CREATE TRIGGER update_user_billing_entitlements_updated_at
  BEFORE UPDATE ON public.user_billing_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
