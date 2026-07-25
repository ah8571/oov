-- Affiliate/influencer tracking system
-- Adds signup attribution, commission rates, and a ledger for payouts

-- 1. Add signup promo code columns to users (first-touch, never overwritten)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signup_promo_code TEXT,
  ADD COLUMN IF NOT EXISTS signup_promo_redeemed_at TIMESTAMPTZ;

COMMENT ON COLUMN users.signup_promo_code IS 'First promo code used at signup — never overwritten (affiliate source)';
COMMENT ON COLUMN users.signup_promo_redeemed_at IS 'When the signup promo code was redeemed';

-- 2. Add commission rate to promo_codes (e.g. 0.20 = 20%)
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS influencer_label TEXT,
  ADD COLUMN IF NOT EXISTS payout_email TEXT;

COMMENT ON COLUMN promo_codes.commission_rate IS 'Commission rate for this affiliate (e.g. 0.20 = 20% of renewal revenue)';
COMMENT ON COLUMN promo_codes.influencer_label IS 'Human-readable name of the influencer/affiliate';
COMMENT ON COLUMN promo_codes.payout_email IS 'Wise email for commission payouts';

-- 3. Commission ledger — tracks what is owed per renewal payment
CREATE TABLE IF NOT EXISTS commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code TEXT NOT NULL,
  user_id UUID NOT NULL,
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,
  invoice_amount_cents INTEGER NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL,
  commission_cents INTEGER NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, paid, cancelled
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE commission_ledger IS 'Tracks affiliate commissions owed per renewal invoice';

CREATE INDEX IF NOT EXISTS idx_commission_promo ON commission_ledger(promo_code);
CREATE INDEX IF NOT EXISTS idx_commission_user ON commission_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_status ON commission_ledger(status);

-- 4. Monthly commission report — aggregates what's owed per influencer per month
CREATE OR REPLACE VIEW monthly_commission_report
WITH (security_invoker = true) AS
SELECT
  cl.promo_code,
  pc.influencer_label,
  date_trunc('month', cl.created_at)::DATE AS month,
  COUNT(*) AS renewal_count,
  SUM(cl.invoice_amount_cents) AS total_invoice_cents,
  AVG(cl.commission_rate) AS avg_commission_rate,
  SUM(cl.commission_cents) AS total_owed_cents,
  COUNT(*) FILTER (WHERE cl.status = 'paid') AS paid_count,
  SUM(cl.commission_cents) FILTER (WHERE cl.status = 'pending') AS pending_cents,
  SUM(cl.commission_cents) FILTER (WHERE cl.status = 'paid') AS paid_cents
FROM commission_ledger cl
LEFT JOIN promo_codes pc ON pc.code = cl.promo_code
GROUP BY cl.promo_code, pc.influencer_label, date_trunc('month', cl.created_at)
ORDER BY month DESC, total_owed_cents DESC;

COMMENT ON VIEW monthly_commission_report IS 'Per-influencer monthly commission summary';

-- 5. Row-Level Security — only admins can read commission data
ALTER TABLE commission_ledger ENABLE ROW LEVEL SECURITY;

-- Admins can read everything
DROP POLICY IF EXISTS "Admins can read commission ledger" ON commission_ledger;
CREATE POLICY "Admins can read commission ledger"
  ON commission_ledger
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.email LIKE '%@plantingmoon.com'
    )
  );

-- Backend service role can insert (handled via supabase service_role key)
-- No insert policy needed for authenticated — backend uses service_role
